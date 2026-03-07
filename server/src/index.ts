// ─── FairArena Backend ────────────────────────────────────────────────────────
// Production-ready Express + WebSocket server for the terminal and curl proxy.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import dns from 'node:dns'
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { AddressInfo } from 'node:net'
import {
  createSession,
  destroySession,
  writeToSession,
  resizeSession,
  getSessionExpiryMs,
  isDockerAvailable,
  sessionCount,
} from './docker/manager.js'
import { OS_IMAGES } from './docker/images.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000
const NODE_ENV = process.env.NODE_ENV || 'development'

const ALLOWED_ORIGINS =
  NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ?? 'https://fairarena.app').split(',')
    : ['http://localhost:5173', 'http://127.0.0.1:5173']

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express()
app.set('trust proxy', 1)

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

// CORS
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
      cb(new Error('CORS policy violation'))
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

// Global rate limit: 120 req/min per IP
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
  }),
)

app.use(express.json({ limit: '256kb' }))

// ─── SSRF Guard ───────────────────────────────────────────────────────────────

const PRIVATE_IP_RE = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00/i,
  /^fe80/i,
]

async function isSafeHost(hostname: string): Promise<boolean> {
  if (!hostname) return false
  try {
    const { address } = await dns.promises.lookup(hostname)
    return !PRIVATE_IP_RE.some((re) => re.test(address))
  } catch {
    return false
  }
}

// ─── Curl parser ──────────────────────────────────────────────────────────────

type ParsedCurl = {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

/** Best-effort shell-token tokeniser that handles single/double quoted args */
function shellTokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue }
    if (ch === '\\' && (inDouble || (!inSingle && !inDouble)) && i + 1 < input.length) {
      current += input[++i]; continue
    }
    if (ch === ' ' && !inSingle && !inDouble) {
      if (current) { tokens.push(current); current = '' }
      continue
    }
    current += ch
  }
  if (current) tokens.push(current)
  return tokens
}

function parseCurl(cmd: string): ParsedCurl {
  const tokens = shellTokenize(cmd.trim())
  if (!tokens.length || tokens[0].toLowerCase() !== 'curl') {
    throw new Error('Command must start with `curl`')
  }

  let url = ''
  let method = 'GET'
  const headers: Record<string, string> = {}
  let body: string | undefined

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i]

    if (tok === '-X' || tok === '--request') {
      method = (tokens[++i] ?? '').toUpperCase(); continue
    }
    if (tok === '-H' || tok === '--header') {
      const raw = tokens[++i] ?? ''
      const colon = raw.indexOf(':')
      if (colon > 0) {
        headers[raw.slice(0, colon).trim()] = raw.slice(colon + 1).trim()
      }
      continue
    }
    if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
      body = tokens[++i] ?? ''
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
      if (method === 'GET') method = 'POST'
      continue
    }
    if (tok === '-u' || tok === '--user') {
      const creds = tokens[++i] ?? ''
      headers['Authorization'] = 'Basic ' + Buffer.from(creds).toString('base64')
      continue
    }
    if (tok === '-A' || tok === '--user-agent') {
      headers['User-Agent'] = tokens[++i] ?? ''; continue
    }
    if (tok.startsWith('-')) continue // skip unknown flags
    if (!url && /^https?:\/\//i.test(tok)) url = tok
  }

  if (!url) throw new Error('Could not find URL in curl command')
  if (!/^https?:\/\//i.test(url)) throw new Error('Only http and https URLs are allowed')

  return { url, method, headers, body }
}

// ─── REST Routes ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    docker: isDockerAvailable(),
    sessions: sessionCount(),
    ts: Date.now(),
  })
})

app.get('/api/os-images', (_req, res) => {
  res.json(OS_IMAGES)
})

// Strict rate limit for the curl proxy: 30 req/min
const curlLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Curl proxy rate limit exceeded. Wait a minute.' },
})

const curlSchema = z.object({
  url: z.string().url().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).default('GET'),
  headers: z.record(z.string()).default({}),
  body: z.string().optional(),
  curl: z.string().optional(),
})

app.post('/api/request/run', curlLimiter, async (req, res) => {
  try {
    const payload = curlSchema.parse(req.body)

    let url: string
    let method: string
    let headers: Record<string, string>
    let body: string | undefined

    // Support both raw curl string and structured payload
    if (payload.curl) {
      const parsed = parseCurl(payload.curl)
      url = parsed.url
      method = parsed.method
      headers = parsed.headers
      body = parsed.body
    } else if (payload.url) {
      url = payload.url
      method = payload.method
      headers = payload.headers
      body = payload.body
    } else {
      return res.status(400).json({ error: 'Provide either `url` or `curl` field.' })
    }

    const urlObj = new URL(url)
    const safe = await isSafeHost(urlObj.hostname)
    if (!safe) {
      return res.status(400).json({
        error: 'Requests to private/internal hosts are blocked for security.',
      })
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const startMs = Date.now()

    const fetchOptions: RequestInit = {
      method,
      headers: { 'User-Agent': 'FairArena/1.0', ...headers },
      signal: controller.signal,
      redirect: 'follow',
    }

    if (body && !['GET', 'HEAD'].includes(method)) {
      fetchOptions.body = body
    }

    const response = await fetch(url, fetchOptions)
    clearTimeout(timer)

    const elapsed = Date.now() - startMs
    const ct = response.headers.get('content-type') ?? ''
    const rawText = await response.text()
    const truncated = rawText.slice(0, 32_768)

    let parsedBody: unknown = truncated
    if (ct.includes('application/json')) {
      try { parsedBody = JSON.parse(truncated) } catch { parsedBody = truncated }
    }

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: parsedBody,
      bodyRaw: truncated,
      elapsed,
      size: rawText.length,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid request' })
    }
    if ((err as Error).name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out after 15 seconds.' })
    }
    console.error('[curl proxy]', err)
    return res.status(500).json({ error: 'Unexpected error running request.' })
  }
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ─── HTTP + WebSocket Server ──────────────────────────────────────────────────

const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })

// Strict WS rate limit: max 5 sessions per IP per minute
const wsSessionMap = new Map<string, number>()
function canOpenSession(ip: string): boolean {
  const count = wsSessionMap.get(ip) ?? 0
  if (count >= 5) return false
  wsSessionMap.set(ip, count + 1)
  setTimeout(() => {
    const cur = wsSessionMap.get(ip) ?? 0
    if (cur <= 1) wsSessionMap.delete(ip)
    else wsSessionMap.set(ip, cur - 1)
  }, 60_000)
  return true
}

// Upgrade handler: only allow /terminal path
server.on('upgrade', (req, socket, head) => {
  const path = req.url?.split('?')[0]
  if (path !== '/terminal') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
    socket.destroy()
    return
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    (req.socket.remoteAddress ?? 'unknown')

  if (!canOpenSession(ip)) {
    socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

// ─── WebSocket terminal handler ───────────────────────────────────────────────

type WsMessage =
  | { type: 'start'; osId: string; cols?: number; rows?: number }
  | { type: 'stdin'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' }
  | { type: 'kill' }

function sendWs(ws: WebSocket, msg: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

wss.on('connection', (ws) => {
  let sessionId: string | null = null

  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping()
  }, 30_000)

  ws.on('message', async (raw) => {
    let msg: WsMessage
    try {
      msg = JSON.parse(raw.toString()) as WsMessage
    } catch {
      sendWs(ws, { type: 'error', message: 'Invalid message format.' })
      return
    }

    if (msg.type === 'ping') {
      sendWs(ws, { type: 'pong' })
      return
    }

    if (msg.type === 'start') {
      if (sessionId) {
        sendWs(ws, { type: 'error', message: 'Session already started.' })
        return
      }

      if (!isDockerAvailable()) {
        sendWs(ws, {
          type: 'error',
          message:
            'Docker is not available on this server. The terminal feature requires Docker to be installed and running.',
        })
        ws.close()
        return
      }

      sessionId = uuidv4()

      sendWs(ws, { type: 'status', message: 'Starting container…' })

      try {
        const session = await createSession(sessionId, msg.osId ?? 'ubuntu')

        if (msg.cols && msg.rows) {
          resizeSession(sessionId, msg.cols, msg.rows)
        }

        session.emitter.on('data', (data: string) => {
          sendWs(ws, { type: 'stdout', data })
        })

        session.emitter.on('exit', (code: number) => {
          sendWs(ws, { type: 'exit', code })
          ws.close()
        })

        sendWs(ws, {
          type: 'ready',
          sessionId,
          expiresIn: getSessionExpiryMs(sessionId),
        })
      } catch (err) {
        sendWs(ws, { type: 'error', message: (err as Error).message })
        sessionId = null
        ws.close()
      }
      return
    }

    if (!sessionId) {
      sendWs(ws, { type: 'error', message: 'No active session. Send {type:"start"} first.' })
      return
    }

    if (msg.type === 'stdin') {
      if (typeof msg.data !== 'string' || msg.data.length > 4096) return
      writeToSession(sessionId, msg.data)
      return
    }

    if (msg.type === 'resize') {
      const cols = Math.max(10, Math.min(500, msg.cols ?? 80))
      const rows = Math.max(3, Math.min(200, msg.rows ?? 24))
      resizeSession(sessionId, cols, rows)
      return
    }

    if (msg.type === 'kill') {
      destroySession(sessionId)
      sessionId = null
      sendWs(ws, { type: 'killed' })
      ws.close()
      return
    }
  })

  ws.on('close', () => {
    clearInterval(heartbeat)
    if (sessionId) {
      destroySession(sessionId)
      sessionId = null
    }
  })

  ws.on('error', (err) => {
    console.error('[ws]', err.message)
    if (sessionId) {
      destroySession(sessionId)
      sessionId = null
    }
  })
})

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  const addr = server.address() as AddressInfo | null
  const port = addr?.port ?? PORT
  console.log(`\n🚀 FairArena API  →  http://localhost:${port}`)
  console.log(`🔌 Terminal WS   →  ws://localhost:${port}/terminal`)
  console.log(`🐳 Docker        →  ${isDockerAvailable() ? 'available ✓' : 'NOT FOUND ✗ (terminal disabled)'}`)
  console.log(`🌍 Environment   →  ${NODE_ENV}\n`)
})

