// FairArena Backend — Production-ready with Redis limits, resource gating,
// SSRF protection, webhook listener, graceful shutdown.

import express, { type Request, type Response } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import dns from 'node:dns'
import http from 'node:http'
import crypto from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { AddressInfo } from 'node:net'
import {
  createSession, destroySession, writeToSession, resizeSession,
  getSessionExpiryMs, getSessionCountForIp, isDockerAvailable,
  sessionCount, cleanupOrphanContainers, destroyAllSessions,
} from './docker/manager.js'
import { OS_IMAGES } from './docker/images.js'
import { claimSession, releaseSession, dailyRemainingSeconds } from './redis.js'
import { getResources, isOverloaded, isKillOverloaded, overloadThreshold, killThreshold } from './resources.js'

// ---- Config ------------------------------------------------------------------

const PORT     = process.env.PORT     || 4000
const NODE_ENV = process.env.NODE_ENV || 'development'

const WS_MSG_RATE_LIMIT = Math.max(5,      Number(process.env.WS_MSG_RATE_LIMIT ?? 60))
const WS_CONN_IDLE_MS   = Math.max(30_000, Number(process.env.WS_CONN_IDLE_MS   ?? 10 * 60_000))
const MAX_PER_IP = 1  // Redis enforces this globally

// Allow proxying to localhost/private IPs — for self-hosted deployments only
const ALLOW_PRIVATE_PROXY = process.env.ALLOW_PRIVATE_PROXY === 'true'

const ALLOWED_ORIGINS =
  NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ?? 'https://fairarena.app').split(',').map((s) => s.trim())
    : [
        'http://localhost:5173', 'http://127.0.0.1:5173',
        'http://localhost:5174', 'http://localhost:4000', 'http://127.0.0.1:4000',
      ]

// ---- App ---------------------------------------------------------------------

const app = express()
app.set('trust proxy', 1)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }))

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error('CORS policy violation'))
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Allow-Private-Host'],
  exposedHeaders: ['X-RateLimit-Limit','X-RateLimit-Remaining'],
}))

const clientIp = (req: http.IncomingMessage | Request): string =>
  ((req as Request).headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
  (req as Request).socket?.remoteAddress ?? 'unknown'

app.use(rateLimit({
  windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many requests — slow down.' },
  keyGenerator: (req) => clientIp(req),
}))

app.use(express.json({ limit: '512kb' }))
app.use(express.text({ type: ['text/*', 'application/xml', 'application/x-www-form-urlencoded'], limit: '512kb' }))

// ---- SSRF Guard --------------------------------------------------------------

const PRIVATE_RE = [
  /^localhost$/i, /^127\./, /^0\.0\.0\.0$/, /^10\./,
  /^192\.168\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^100\.64\./,
  /^169\.254\./, /^0\./, /^::1$/, /^fc00/i, /^fe80/i, /^fd/i,
]
const isPrivate = (h: string) => PRIVATE_RE.some((re) => re.test(h))

async function isSafeHost(hostname: string, allowPrivate: boolean): Promise<boolean> {
  if (!hostname) return false
  if (isPrivate(hostname)) return allowPrivate
  try {
    const addrs = await dns.promises.resolve(hostname)
    return !addrs.some((a) => !allowPrivate && isPrivate(a))
  } catch { return false }
}

const STRIP_OUT = new Set([
  'host','connection','upgrade','proxy-authorization','proxy-connection',
  'transfer-encoding','te','trailer','keep-alive',
  'x-forwarded-for','x-real-ip','x-forwarded-host','x-forwarded-proto',
])
function sanitizeReqHeaders(raw: Record<string,string>): Record<string,string> {
  const out: Record<string,string> = {}
  for (const [k,v] of Object.entries(raw)) {
    const l = k.toLowerCase()
    if (STRIP_OUT.has(l) || /x-env|x-secret|x-internal|x-debug/i.test(l)) continue
    out[k] = v
  }
  return out
}

const STRIP_RESP = new Set(['x-powered-by','server','via','x-aspnet-version','x-runtime'])
function sanitizeRespHeaders(h: Headers): Record<string,string> {
  const out: Record<string,string> = {}
  h.forEach((v,k) => { if (!STRIP_RESP.has(k.toLowerCase())) out[k] = v })
  return out
}

// ---- Webhook in-memory store -------------------------------------------------

interface WebhookEvent {
  id: string; receivedAt: number; method: string
  headers: Record<string,string>; query: Record<string,string>
  body: unknown; bodyRaw: string
}
interface WebhookChannel {
  id: string; name: string; createdAt: number; expiresAt: number; events: WebhookEvent[]
  listeners: Set<Response>
}
const webhooks = new Map<string, WebhookChannel>()
const WH_TTL_MS = 60 * 60_000
const WH_MAX = 200

// Webhook create rate limiter — prevent generating thousands of channels
const whCreateLimiter = rateLimit({
  windowMs: 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Webhook channel creation rate limit exceeded. Wait a minute.' },
  keyGenerator: (req) => clientIp(req),
})

setInterval(() => {
  const now = Date.now()
  for (const [id, ch] of webhooks.entries()) {
    if (now > ch.expiresAt) {
      ch.listeners.forEach((r) => { try { r.end() } catch {} })
      webhooks.delete(id)
    }
  }
}, 5 * 60_000).unref()

// ---- Curl parser -------------------------------------------------------------

export type ParsedCurl = {
  url: string; method: string
  headers: Record<string,string>
  body?: string; followRedirects: boolean
}

function shellTokenize(input: string): string[] {
  const tokens: string[] = []; let cur = '', inS = false, inD = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === "'" && !inD) { inS = !inS; continue }
    if (ch === '"' && !inS) { inD = !inD; continue }
    if (ch === '\\' && i+1 < input.length) {
      if (input[i+1] === '\n') { i++; continue }
      if (inD || (!inS)) { cur += input[++i]; continue }
    }
    if ((ch === ' ' || ch === '\t') && !inS && !inD) {
      if (cur) { tokens.push(cur); cur = '' }; continue
    }
    cur += ch
  }
  if (cur) tokens.push(cur)
  return tokens
}

export function parseCurl(cmd: string): ParsedCurl {
  const tokens = shellTokenize(cmd.replace(/\\\s*\n\s*/g, ' ').trim())
  if (!tokens.length || tokens[0].toLowerCase() !== 'curl')
    throw new Error('Command must start with `curl`')

  let url = '', method = ''
  const headers: Record<string,string> = {}
  let body: string | undefined, followRedirects = true

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '-X' || t === '--request') { method = (tokens[++i]??'').toUpperCase(); continue }
    if (t === '-H' || t === '--header') {
      const raw = tokens[++i]??''; const c = raw.indexOf(':')
      if (c > 0) headers[raw.slice(0,c).trim()] = raw.slice(c+1).trim()
      continue
    }
    if (['-d','--data','--data-raw','--data-binary','--data-urlencode'].includes(t)) {
      body = tokens[++i]??''
      if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json'
      continue
    }
    if (t === '--json') {
      body = tokens[++i]??''; headers['Content-Type'] = 'application/json'; headers['Accept'] = 'application/json'; continue
    }
    if (t === '-u' || t === '--user') {
      headers['Authorization'] = 'Basic ' + Buffer.from(tokens[++i]??'').toString('base64'); continue
    }
    if (t === '-A' || t === '--user-agent') { headers['User-Agent'] = tokens[++i]??''; continue }
    if (t === '--oauth2-bearer') { headers['Authorization'] = `Bearer ${tokens[++i]??''}`; continue }
    if (t === '-L' || t === '--location') { followRedirects = true; continue }
    if (t === '--no-location') { followRedirects = false; continue }
    if (t === '-G' || t === '--get') { method = 'GET'; continue }
    if (t.startsWith('-')) { if (/^-[bcefkKmoOpqQrRsStTvwyz]$/.test(t)) i++; continue }
    if (!url) url = t
  }

  if (!url) throw new Error('Could not find URL in curl command')
  if (!/^https?:\/\//i.test(url)) throw new Error('Only http:// and https:// URLs are allowed')
  if (!method) method = body ? 'POST' : 'GET'
  return { url, method, headers, body, followRedirects }
}

// ---- Routes ------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  const r = getResources()
  res.json({ status:'ok', docker:isDockerAvailable(), sessions:sessionCount(),
    overloaded:isOverloaded(), cpu:r.cpuPercent, mem:r.memPercent, ts:Date.now() })
})

app.get('/api/server-stats', (_req, res) => {
  const r = getResources()
  // Never expose raw memory bytes or exact counts — only safe percentages
  res.json({
    cpu: r.cpuPercent,
    mem: r.memPercent,
    overloaded: r.overloaded,
    overloadThreshold: overloadThreshold(),
    killThreshold: killThreshold(),
    sessions: sessionCount(),
    maxSessions: Number(process.env.MAX_SESSIONS ?? 3),
  })
})

app.get('/api/my-quota', async (req, res) => {
  const ip = clientIp(req)
  const remainSec = await dailyRemainingSeconds(ip)
  res.json({
    dailyRemainingSeconds: remainSec,
    dailyLimitSeconds: Math.max(60, Number(process.env.DAILY_LIMIT_MS ?? 60*60_000)) / 1000,
    sessionsActive: getSessionCountForIp(ip),
  })
})

app.get('/api/os-images', (_req, res) => res.json(OS_IMAGES))

// Parse a curl command into structured fields
app.post('/api/curl/parse', (req, res) => {
  const { cmd } = req.body as { cmd?: string }
  if (typeof cmd !== 'string' || !cmd.trim())
    return res.status(400).json({ error: 'Provide a `cmd` field.' })
  try { return res.json(parseCurl(cmd)) }
  catch (err) { return res.status(400).json({ error: (err as Error).message }) }
})

// ---- Curl/HTTP proxy ---------------------------------------------------------

const curlLimiter = rateLimit({
  windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'API proxy rate limit exceeded. Wait a minute.' },
  keyGenerator: (req) => clientIp(req),
})

const requestSchema = z.object({
  url: z.string().url().optional(),
  method: z.enum(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']).default('GET'),
  headers: z.record(z.string()).default({}),
  body: z.string().optional(),
  curl: z.string().optional(),
  followRedirects: z.boolean().default(true),
  timeoutMs: z.number().min(500).max(30_000).default(15_000),
})

app.post('/api/request/run', curlLimiter, async (req, res) => {
  try {
    const p = requestSchema.parse(req.body)
    const allowPrivate = ALLOW_PRIVATE_PROXY && req.headers['x-allow-private-host'] === 'true'

    let url: string, method: string, headers: Record<string,string>,
        body: string | undefined, followRedirects: boolean

    if (p.curl) {
      const parsed = parseCurl(p.curl)
      ;({ url, method, headers, body, followRedirects } = parsed)
    } else if (p.url) {
      url = p.url; method = p.method; headers = p.headers
      body = p.body; followRedirects = p.followRedirects
    } else {
      return res.status(400).json({ error: 'Provide either `url` or `curl` field.' })
    }

    let urlObj: URL
    try { urlObj = new URL(url) } catch { return res.status(400).json({ error: 'Invalid URL.' }) }

    if (!['http:','https:'].includes(urlObj.protocol))
      return res.status(400).json({ error: 'Only http and https URLs are allowed.' })

    if (!(await isSafeHost(urlObj.hostname, allowPrivate)))
      return res.status(400).json({ error: 'Requests to private or internal IP ranges are blocked.' })

    const safeHeaders = sanitizeReqHeaders({ 'User-Agent': 'FairArena/2.0', ...headers })
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), p.timeoutMs)
    const t0 = Date.now()

    let response: globalThis.Response
    try {
      response = await fetch(url, {
        method, headers: safeHeaders, signal: ctrl.signal,
        redirect: followRedirects ? 'follow' : 'manual',
        ...(body && !['GET','HEAD'].includes(method) ? { body } : {}),
      })
    } catch (err) {
      clearTimeout(timer)
      if ((err as Error).name === 'AbortError')
        return res.status(504).json({ error: `Request timed out after ${p.timeoutMs} ms.` })
      return res.status(502).json({ error: `Network error: ${(err as Error).message}` })
    }
    clearTimeout(timer)

    const elapsed = Date.now() - t0
    const ct = response.headers.get('content-type') ?? ''
    const rawText = await response.text()
    const truncated = rawText.slice(0, 1_048_576)

    let parsedBody: unknown = truncated
    if (ct.includes('application/json') || ct.includes('+json')) {
      try { parsedBody = JSON.parse(truncated) } catch {}
    }

    return res.status(200).json({
      ok: response.ok, status: response.status, statusText: response.statusText,
      headers: sanitizeRespHeaders(response.headers),
      body: parsedBody, bodyRaw: truncated, contentType: ct,
      elapsed, size: rawText.length, redirected: response.redirected,
      finalUrl: response.url !== url ? response.url : undefined,
    })
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid request' })
    console.error('[proxy]', (err as Error).message)
    return res.status(500).json({ error: 'Unexpected server error.' })
  }
})

// ---- Webhook routes ----------------------------------------------------------

app.post('/api/webhook/create', whCreateLimiter, (req, res) => {
  const id = crypto.randomBytes(12).toString('hex')
  const now = Date.now()
  const name = (req.body as Record<string, unknown>)?.name as string | undefined
  webhooks.set(id, {
    id,
    name: (typeof name === 'string' && name.trim()) ? name.trim().slice(0, 64) : `channel-${id.slice(0, 6)}`,
    createdAt: now,
    expiresAt: now + WH_TTL_MS,
    events: [],
    listeners: new Set(),
  })
  res.json({ id, url: `/api/webhook/${id}/incoming`, expiresIn: WH_TTL_MS, expiresAt: now + WH_TTL_MS, createdAt: now })
})

app.all('/api/webhook/:id/incoming', (req, res) => {
  const ch = webhooks.get(req.params.id)
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found or expired.' })
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? '')
  let parsedBody: unknown = rawBody
  if ((req.headers['content-type']??'').includes('application/json')) {
    try { parsedBody = JSON.parse(rawBody) } catch {}
  }
  const event: WebhookEvent = {
    id: uuidv4(), receivedAt: Date.now(), method: req.method,
    headers: sanitizeReqHeaders(req.headers as Record<string,string>),
    query: req.query as Record<string,string>, body: parsedBody,
    bodyRaw: rawBody.slice(0, 65_536),
  }
  if (ch.events.length >= WH_MAX) ch.events.shift()
  ch.events.push(event)
  const data = JSON.stringify({ type: 'event', event })
  ch.listeners.forEach((sse) => { try { sse.write(`data: ${data}\n\n`) } catch {} })
  return res.status(200).json({ ok: true })
})

app.get('/api/webhook/:id/listen', (req, res: Response) => {
  const ch = webhooks.get(req.params.id)
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found.' })
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')    // disable nginx / reverse-proxy buffering
  res.flushHeaders()

  // ── Send a named "connected" event immediately ───────────────────────────────
  // Without any initial body bytes the Vite dev proxy (and many CDNs) will buffer
  // the response until the first real event, keeping EventSource.readyState at
  // CONNECTING forever. A named event also lets the client detect "live" reliably
  // without depending on EventSource.onopen (which some browsers fire late or not
  // at all when proxied).
  res.write(`event: connected\ndata: ${JSON.stringify({ channelId: req.params.id })}\n\n`)

  // Replay persisted events to the new subscriber
  for (const event of ch.events)
    res.write(`data: ${JSON.stringify({ type: 'event', event })}\n\n`)

  // 25-second SSE comment heartbeats prevent network intermediaries from dropping
  // idle connections (most proxies time out after 30-60 s with no traffic).
  const hb = setInterval(() => {
    try { res.write(': hb\n\n') } catch { clearInterval(hb) }
  }, 25_000)

  ch.listeners.add(res)
  req.on('close', () => { clearInterval(hb); ch.listeners.delete(res) })
})

app.get('/api/webhook/:id/events', (req, res) => {
  const ch = webhooks.get(req.params.id)
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found.' })
  res.json({ events: ch.events })
})

// Clear all events in a channel
app.delete('/api/webhook/:id/events', (req, res) => {
  const ch = webhooks.get(req.params.id)
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found.' })
  ch.events = []
  return res.json({ ok: true })
})

// Rename a channel
app.patch('/api/webhook/:id/name', (req, res) => {
  const ch = webhooks.get(req.params.id)
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found.' })
  const name = (req.body as Record<string, unknown>)?.name as string | undefined
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Provide a `name` field.' })
  ch.name = name.trim().slice(0, 64)
  return res.json({ ok: true, name: ch.name })
})

// Get channel metadata
app.get('/api/webhook/:id/info', (req, res) => {
  const ch = webhooks.get(req.params.id)
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found.' })
  return res.json({ id: ch.id, name: ch.name, createdAt: ch.createdAt, expiresAt: ch.expiresAt, eventCount: ch.events.length })
})

app.delete('/api/webhook/:id', (req, res) => {
  const ch = webhooks.get(req.params.id)
  if (ch) { ch.listeners.forEach((r) => { try { r.end() } catch {} }); webhooks.delete(req.params.id) }
  res.json({ ok: true })
})

app.use((_req, res: Response) => res.status(404).json({ error: 'Not found' }))

// ---- HTTP + WebSocket Server -------------------------------------------------

const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })

// Track every live WebSocket so we can close them all on overload-kill
const activeWs = new Set<WebSocket>()

// ---- Overload kill-all ------------------------------------------------------
// When CPU or RAM exceeds KILL_THRESHOLD %, destroy every session and disconnect
// every WebSocket client so one spike cannot permanently sink the host.
setInterval(() => {
  if (isKillOverloaded()) {
    const count = activeWs.size
    if (count > 0 || sessionCount() > 0) {
      console.warn(`[overload] Kill threshold (${killThreshold()}%) breached — evicting ${count} connection(s).`)
      destroyAllSessions()
      for (const ws of activeWs) {
        try {
          ws.send(JSON.stringify({
            type: 'error',
            overloaded: true,
            message: `Server is critically overloaded. Your session was terminated to protect other users.`,
          }))
          ws.close()
        } catch { /* already closed */ }
      }
      activeWs.clear()
    }
  }
}, Number(process.env.OVERLOAD_CHECK_MS ?? 5_000)).unref()

server.on('upgrade', (req, socket, head) => {
  if (req.url?.split('?')[0] !== '/terminal') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); return
  }
  const origin = req.headers.origin ?? ''
  if (NODE_ENV === 'production' && origin && !ALLOWED_ORIGINS.includes(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return
  }
  const ip = clientIp(req)
  if (isOverloaded()) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); socket.destroy(); return
  }
  if (getSessionCountForIp(ip) >= MAX_PER_IP) {
    socket.write('HTTP/1.1 429 Too Many Sessions\r\n\r\n'); socket.destroy(); return
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
})

// ---- WebSocket handler -------------------------------------------------------

type WsMsg =
  | { type: 'start'; osId: string; cols?: number; rows?: number }
  | { type: 'stdin'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' }
  | { type: 'kill' }

function sendWs(ws: WebSocket, msg: object): void {
  if (ws.readyState === WebSocket.OPEN) { try { ws.send(JSON.stringify(msg)) } catch {} }
}

wss.on('connection', (ws, req) => {
  activeWs.add(ws)
  ws.once('close', () => activeWs.delete(ws))
  ws.once('error', () => activeWs.delete(ws))

  const ip = clientIp(req as http.IncomingMessage)
  let sessionId: string | null = null
  let sessionStartedAt = 0

  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping()
  }, 25_000)

  let idleTimer = setTimeout(() => {
    sendWs(ws, { type: 'error', message: 'Connection closed due to inactivity.' })
    ws.close()
  }, WS_CONN_IDLE_MS)

  const resetIdle = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      sendWs(ws, { type: 'error', message: 'Connection closed due to inactivity.' })
      ws.close()
    }, WS_CONN_IDLE_MS)
  }

  let msgCount = 0
  const msgReset = setInterval(() => { msgCount = 0 }, 10_000)

  ws.on('message', async (raw) => {
    if (++msgCount > WS_MSG_RATE_LIMIT) {
      sendWs(ws, { type: 'error', message: 'Message rate limit exceeded.' }); return
    }
    resetIdle()

    let msg: WsMsg
    try { msg = JSON.parse(raw.toString()) as WsMsg }
    catch { sendWs(ws, { type: 'error', message: 'Invalid JSON.' }); return }

    if (msg.type === 'ping') { sendWs(ws, { type: 'pong' }); return }

    if (msg.type === 'start') {
      if (sessionId) { sendWs(ws, { type: 'error', message: 'Session already started.' }); return }

      if (isOverloaded()) {
        const r = getResources()
        sendWs(ws, {
          type: 'error', overloaded: true, cpu: r.cpuPercent, mem: r.memPercent,
          message: `Server is at capacity (CPU ${r.cpuPercent}%, RAM ${r.memPercent}%). Try again later.`,
        })
        ws.close(); return
      }

      if (!isDockerAvailable()) {
        sendWs(ws, { type: 'error', message: 'Docker is not available on this server.' })
        ws.close(); return
      }

      const tentativeId = uuidv4()
      const claimErr = await claimSession(ip, tentativeId)
      if (claimErr) { sendWs(ws, { type: 'error', message: claimErr }); ws.close(); return }

      sessionId = tentativeId
      sessionStartedAt = Date.now()
      sendWs(ws, { type: 'status', message: 'Starting container...' })

      try {
        const session = await createSession(sessionId, msg.osId ?? 'ubuntu', ip)
        if (msg.cols && msg.rows) resizeSession(sessionId, msg.cols, msg.rows)

        session.emitter.on('data', (data: string) => sendWs(ws, { type: 'stdout', data }))
        session.emitter.on('exit', (code: number) => { sendWs(ws, { type: 'exit', code }); ws.close() })
        session.emitter.on('expiry-warning', ({ remainingMs }: { remainingMs: number }) => {
          sendWs(ws, { type: 'expiry-warning', remainingMs,
            message: `Session expires in ${Math.round(remainingMs / 60_000)} minute(s).` })
        })

        sendWs(ws, { type: 'ready', sessionId, expiresIn: getSessionExpiryMs(sessionId) })
      } catch (err) {
        await releaseSession(ip, sessionStartedAt)
        sendWs(ws, { type: 'error', message: (err as Error).message })
        sessionId = null; ws.close()
      }
      return
    }

    if (!sessionId) {
      sendWs(ws, { type: 'error', message: 'No active session. Send {type:"start"} first.' }); return
    }

    if (msg.type === 'stdin') {
      if (typeof msg.data !== 'string' || msg.data.length > 4096) return
      writeToSession(sessionId, msg.data); return
    }

    if (msg.type === 'resize') {
      resizeSession(sessionId,
        Math.max(10, Math.min(500, msg.cols ?? 80)),
        Math.max(3,  Math.min(200, msg.rows ?? 24)))
      return
    }

    if (msg.type === 'kill') {
      const id = sessionId, ts = sessionStartedAt
      destroySession(id)
      await releaseSession(ip, ts)
      sessionId = null
      sendWs(ws, { type: 'killed' }); ws.close(); return
    }
  })

  const cleanup = async () => {
    clearInterval(heartbeat); clearInterval(msgReset); clearTimeout(idleTimer)
    if (sessionId) {
      destroySession(sessionId)
      await releaseSession(ip, sessionStartedAt)
      sessionId = null
    }
  }

  ws.on('close', cleanup)
  ws.on('error', (err) => { console.error('[ws]', err.message); cleanup() })
})

// ---- Graceful shutdown -------------------------------------------------------

let isShuttingDown = false

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`\n[shutdown] ${signal} — destroying all sessions...`)
  destroyAllSessions()
  server.close(() => { console.log('[shutdown] Closed. Exiting.'); process.exit(0) })
  setTimeout(() => { console.error('[shutdown] Forced exit.'); process.exit(1) }, 10_000).unref()
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT',  () => gracefulShutdown('SIGINT'))
process.on('uncaughtException', (err) => console.error('[uncaught]', err.message))
process.on('unhandledRejection', (r) => console.error('[unhandled rejection]', r))

// ---- Start -------------------------------------------------------------------

if (isDockerAvailable()) cleanupOrphanContainers()

server.listen(PORT, () => {
  const port = (server.address() as AddressInfo | null)?.port ?? PORT
  console.log(`\nFairArena API    -> http://localhost:${port}`)
  console.log(`Terminal WS      -> ws://localhost:${port}/terminal`)
  console.log(`Docker           -> ${isDockerAvailable() ? 'available' : 'NOT FOUND (terminal disabled)'}`)
  console.log(`Overload gate    -> >${overloadThreshold()}% CPU/RAM blocks new sessions`)
  console.log(`Kill threshold   -> >${killThreshold()}% CPU/RAM evicts all sessions`)
  console.log(`Max sessions     -> ${process.env.MAX_SESSIONS ?? 3} global / ${process.env.MAX_SESSIONS_PER_IP ?? 1} per IP`)
  console.log(`Environment      -> ${NODE_ENV}\n`)
})
