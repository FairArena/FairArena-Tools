// FairArena Backend — Production-ready with Redis limits, resource gating,
// SSRF protection, webhook listener, graceful shutdown.

import express, { type Request, type Response as ExpressResponse } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import dns from 'node:dns';
import os from 'node:os';
import hpp from 'hpp';
import bcryptjs from 'bcryptjs';
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { AddressInfo } from 'node:net';
import {
  createSession,
  destroySession,
  writeToSession,
  resizeSession,
  getSessionExpiryMs,
  getSessionCountForIp,
  isDockerAvailable,
  sessionCount,
  cleanupOrphanContainers,
  destroyAllSessions,
  getSession,
} from './docker/manager.js';
import { OS_IMAGES } from './docker/images.js';
import { claimSession, releaseSession, dailyRemainingSeconds, unclaimSession } from './redis.js';
import {
  getResources,
  isOverloaded,
  isKillOverloaded,
  overloadThreshold,
  killThreshold,
} from './resources.js';
import { arcjetMiddleware } from './arcjet.middleware.js';

// ---- Config ------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 4000);
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// WebSocket and connection tuning
// Message rate limit: number of incoming WS messages allowed per window.
// Relaxed default to reduce false positives for bursty clients. Operators can
// still tune with env vars `WS_MSG_RATE_LIMIT` and `WS_MSG_WINDOW_MS`.
const WS_MSG_RATE_LIMIT = Math.max(10, Number(process.env.WS_MSG_RATE_LIMIT ?? 5000));
const WS_MSG_WINDOW_MS = Number(process.env.WS_MSG_WINDOW_MS ?? 15_000);
const WS_CONN_IDLE_MS = Math.max(30_000, Number(process.env.WS_CONN_IDLE_MS ?? 10 * 60_000));

// Session limits (Redis-enforced per-IP)
const MAX_PER_IP = Number(process.env.MAX_SESSIONS_PER_IP ?? 1);

// Global limits and rate limits
const GLOBAL_RATE_LIMIT_WINDOW_MS = Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS ?? 60_000);
const GLOBAL_RATE_LIMIT = Number(process.env.GLOBAL_RATE_LIMIT ?? 120);

const PROXY_RATE_WINDOW_MS = Number(process.env.PROXY_RATE_WINDOW_MS ?? 60_000);
const PROXY_RATE_LIMIT = Number(process.env.PROXY_RATE_LIMIT ?? 30);

// Small helper to parse boolean-ish env values (1/true/yes)
function parseEnvBool(name: string, def = false): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return /^(1|true|yes)$/i.test(v.trim());
}

// Allow operator to completely disable creation of new terminal sessions
const DISABLE_NEW_SESSIONS = parseEnvBool('DISABLE_NEW_SESSIONS', false);

// Allow proxying to localhost/private IPs — for self-hosted deployments only
const ALLOW_PRIVATE_PROXY = process.env.ALLOW_PRIVATE_PROXY === 'true';

const ALLOWED_ORIGINS =
  NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ?? 'https://fairarena.app').split(',').map((s) => s.trim())
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://localhost:4000',
        'http://127.0.0.1:4000',
      ];

// ---- App ---------------------------------------------------------------------

const app = express();
app.use(hpp());
app.set('trust proxy', 1);
app.use(arcjetMiddleware);

// Security headers: enable a reasonably strict CSP and other protections.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://www.googletagmanager.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https://fra.cloud.appwrite.io'],
        connectSrc: ["'self'", 'wss:', 'https://fra.cloud.appwrite.io'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  }),
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error('CORS policy violation'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Allow-Private-Host'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  }),
);

const clientIp = (req: http.IncomingMessage | Request): string =>
  ((req as Request).headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
  (req as Request).socket?.remoteAddress ??
  'unknown';

app.use(
  rateLimit({
    windowMs: GLOBAL_RATE_LIMIT_WINDOW_MS,
    limit: GLOBAL_RATE_LIMIT,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests — slow down.' },
    keyGenerator: (req) => clientIp(req),
  }),
);

app.use(express.json({ limit: '512kb' }));
app.use(
  express.text({
    type: ['text/*', 'application/xml', 'application/x-www-form-urlencoded'],
    limit: '512kb',
  }),
);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ---- DNS resolver cache + rate limit -------------------------------------
const DNS_CACHE_TTL_MS = Math.max(15_000, Number(process.env.DNS_CACHE_TTL_MS ?? 60_000));
type DnsCacheEntry = { ts: number; result: unknown };
const dnsCache = new Map<string, DnsCacheEntry>();

const dnsLimiter = rateLimit({
  windowMs: Number(process.env.DNS_RATE_WINDOW_MS ?? 60_000),
  limit: Number(process.env.DNS_RATE_LIMIT ?? 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'DNS lookup rate limit exceeded. Try again later.' },
  keyGenerator: (req) => clientIp(req),
});

const domainSchema = z.object({
  domain: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  types: z
    .array(
      z.enum([
        'A',
        'AAAA',
        'CNAME',
        'MX',
        'TXT',
        'NS',
        'SOA',
        'SRV',
        'PTR',
        'CAA',
        'DNSKEY',
        'DS',
        'ALL',
      ]),
    )
    .optional(),
  resolver: z.string().optional(),
});

async function performDnsLookups(domain: string, types?: string[], resolver?: string) {
  const out: Record<string, unknown> = {};
  // Node's DNS ResolveOptions requires a `ttl` boolean; include it explicitly
  const resolverOptions: dns.ResolveOptions = {
    ttl: false,
    ...(resolver ? { server: resolver } : {}),
  };

  const doResolve = async (t: string) => {
    try {
      if (t === 'A') out.A = await dns.promises.resolve4(domain, resolverOptions);
      else if (t === 'AAAA') out.AAAA = await dns.promises.resolve6(domain, resolverOptions);
      else if (t === 'CNAME') out.CNAME = await dns.promises.resolveCname(domain);
      else if (t === 'MX') out.MX = await dns.promises.resolveMx(domain);
      else if (t === 'TXT') out.TXT = await dns.promises.resolveTxt(domain);
      else if (t === 'NS') out.NS = await dns.promises.resolveNs(domain);
      else if (t === 'SOA') out.SOA = await dns.promises.resolveSoa(domain);
      else if (t === 'SRV') {
        // SRV records need service._protocol.domain format
        // For now, try common services
        const services = [
          '_http._tcp',
          '_https._tcp',
          '_sip._tcp',
          '_sip._udp',
          '_xmpp-client._tcp',
        ];
        const srvResults: any[] = [];
        for (const service of services) {
          try {
            const records = await dns.promises.resolveSrv(`${service}.${domain}`);
            srvResults.push(...records.map((r) => ({ ...r, service })));
          } catch {}
        }
        out.SRV = srvResults.length > 0 ? srvResults : [];
      } else if (t === 'PTR') {
        // For PTR, we need an IP address
        if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
          const reversed = domain.split('.').reverse().join('.') + '.in-addr.arpa';
          out.PTR = await dns.promises.resolvePtr(reversed);
        } else {
          out.PTR = { error: 'PTR lookups require an IP address' };
        }
      } else if (t === 'CAA') {
        try {
          // CAA records might not be supported in all Node.js versions
          const records = await dns.promises.resolveCaa(domain);
          out.CAA = records;
        } catch (err) {
          out.CAA = { error: 'CAA records not supported or not found' };
        }
      } else if (t === 'DNSKEY' || t === 'DS') {
        // DNSSEC records - these might require additional libraries
        out[t] = { error: 'DNSSEC records require special handling' };
      }
    } catch (err) {
      out[t] = { error: (err as Error).message };
    }
  };

  const want = types && types.length ? types : ['A', 'AAAA', 'CNAME', 'MX', 'TXT'];
  await Promise.all(want.map(doResolve));
  return out;
}

// ---- SSRF Guard --------------------------------------------------------------

const PRIVATE_RE = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^100\.64\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00/i,
  /^fe80/i,
  /^fd/i,
];
const isPrivate = (h: string) => PRIVATE_RE.some((re) => re.test(h));

async function isSafeHost(hostname: string, allowPrivate: boolean): Promise<boolean> {
  if (!hostname) return false;
  if (isPrivate(hostname)) return allowPrivate;
  try {
    const addrs = await dns.promises.resolve(hostname);
    return !addrs.some((a) => !allowPrivate && isPrivate(a));
  } catch {
    return false;
  }
}

const STRIP_OUT = new Set([
  'host',
  'connection',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  'transfer-encoding',
  'te',
  'trailer',
  'keep-alive',
  'x-forwarded-for',
  'x-real-ip',
  'x-forwarded-host',
  'x-forwarded-proto',
]);
function sanitizeReqHeaders(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const l = k.toLowerCase();
    if (STRIP_OUT.has(l) || /x-env|x-secret|x-internal|x-debug/i.test(l)) continue;
    out[k] = v;
  }
  return out;
}

const STRIP_RESP = new Set(['x-powered-by', 'server', 'via', 'x-aspnet-version', 'x-runtime']);
function sanitizeRespHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    if (!STRIP_RESP.has(k.toLowerCase())) out[k] = v;
  });
  return out;
}

// ---- Webhook in-memory store -------------------------------------------------

interface WebhookEvent {
  id: string;
  receivedAt: number;
  method: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  bodyRaw: string;
}
interface WebhookChannel {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  events: WebhookEvent[];
  listeners: Set<ExpressResponse>;
}
const webhooks = new Map<string, WebhookChannel>();
const WH_TTL_MS = Math.max(60_000, Number(process.env.WH_TTL_MS ?? 60 * 60_000));
const WH_MAX = Math.max(10, Number(process.env.WH_MAX ?? 200));
const WH_CREATE_LIMIT = Math.max(1, Number(process.env.WH_CREATE_LIMIT ?? 10));
const WH_MAX_CHANNELS = Math.max(1, Number(process.env.WH_MAX_CHANNELS ?? 10));

// Webhook create rate limiter — prevent generating thousands of channels
const whCreateLimiter = rateLimit({
  windowMs: Number(process.env.WH_CREATE_WINDOW_MS ?? 60_000),
  limit: WH_CREATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Webhook channel creation rate limit exceeded. Wait a minute.' },
  keyGenerator: (req) => clientIp(req),
});

setInterval(() => {
  const now = Date.now();
  for (const [id, ch] of webhooks.entries()) {
    if (now > ch.expiresAt) {
      ch.listeners.forEach((r) => {
        try {
          r.end();
        } catch {}
      });
      webhooks.delete(id);
    }
  }
}, 5 * 60_000).unref();

// ---- Curl parser -------------------------------------------------------------

export type ParsedCurl = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  followRedirects: boolean;
};

function shellTokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = '',
    inS = false,
    inD = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'" && !inD) {
      inS = !inS;
      continue;
    }
    if (ch === '"' && !inS) {
      inD = !inD;
      continue;
    }
    if (ch === '\\' && i + 1 < input.length) {
      if (input[i + 1] === '\n') {
        i++;
        continue;
      }
      if (inD || !inS) {
        cur += input[++i];
        continue;
      }
    }
    if ((ch === ' ' || ch === '\t') && !inS && !inD) {
      if (cur) {
        tokens.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

export function parseCurl(cmd: string): ParsedCurl {
  const tokens = shellTokenize(cmd.replace(/\\\s*\n\s*/g, ' ').trim());
  if (!tokens.length || tokens[0].toLowerCase() !== 'curl')
    throw new Error('Command must start with `curl`');

  let url = '',
    method = '';
  const headers: Record<string, string> = {};
  let body: string | undefined,
    followRedirects = true;

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-X' || t === '--request') {
      method = (tokens[++i] ?? '').toUpperCase();
      continue;
    }
    if (t === '-H' || t === '--header') {
      const raw = tokens[++i] ?? '';
      const c = raw.indexOf(':');
      if (c > 0) headers[raw.slice(0, c).trim()] = raw.slice(c + 1).trim();
      continue;
    }
    if (['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode'].includes(t)) {
      body = tokens[++i] ?? '';
      if (!headers['Content-Type'] && !headers['content-type'])
        headers['Content-Type'] = 'application/json';
      continue;
    }
    if (t === '--json') {
      body = tokens[++i] ?? '';
      headers['Content-Type'] = 'application/json';
      headers['Accept'] = 'application/json';
      continue;
    }
    if (t === '-u' || t === '--user') {
      headers['Authorization'] = 'Basic ' + Buffer.from(tokens[++i] ?? '').toString('base64');
      continue;
    }
    if (t === '-A' || t === '--user-agent') {
      headers['User-Agent'] = tokens[++i] ?? '';
      continue;
    }
    if (t === '--oauth2-bearer') {
      headers['Authorization'] = `Bearer ${tokens[++i] ?? ''}`;
      continue;
    }
    if (t === '-L' || t === '--location') {
      followRedirects = true;
      continue;
    }
    if (t === '--no-location') {
      followRedirects = false;
      continue;
    }
    if (t === '-G' || t === '--get') {
      method = 'GET';
      continue;
    }
    if (t.startsWith('-')) {
      if (/^-[bcefkKmoOpqQrRsStTvwyz]$/.test(t)) i++;
      continue;
    }
    if (!url) url = t;
  }

  if (!url) throw new Error('Could not find URL in curl command');
  if (!/^https?:\/\//i.test(url)) throw new Error('Only http:// and https:// URLs are allowed');
  if (!method) method = body ? 'POST' : 'GET';
  return { url, method, headers, body, followRedirects };
}

// ---- Routes ------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  const r = getResources();
  res.json({
    status: 'ok',
    docker: isDockerAvailable(),
    sessions: sessionCount(),
    overloaded: isOverloaded(),
    cpu: r.cpuPercent,
    mem: r.memPercent,
    ts: Date.now(),
  });
});

app.get('/api/server-stats', (_req, res) => {
  const r = getResources();
  // Never expose raw memory bytes or exact counts — only safe percentages
  res.json({
    cpu: r.cpuPercent,
    mem: r.memPercent,
    overloaded: r.overloaded,
    overloadThreshold: overloadThreshold(),
    killThreshold: killThreshold(),
    sessions: sessionCount(),
    maxSessions: Number(process.env.MAX_SESSIONS ?? 3),
  });
});

// Server-Sent Events: live resource stats stream.
// One persistent connection per tab replaces the 15-second polling loop, halving
// unnecessary HTTP overhead and eliminating the React re-renders in TerminalPane
// caused by setState() firing while the user is typing.
app.get('/api/stats/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // tell nginx not to buffer SSE
  res.flushHeaders();

  const buildPayload = () => {
    const r = getResources();
    return JSON.stringify({
      cpu: r.cpuPercent,
      mem: r.memPercent,
      overloaded: r.overloaded,
      overloadThreshold: overloadThreshold(),
      killThreshold: killThreshold(),
      sessions: sessionCount(),
      maxSessions: Number(process.env.MAX_SESSIONS ?? 3),
    });
  };

  // Send immediately so the client has data before the first interval fires
  res.write(`data: ${buildPayload()}\n\n`);

  const iv = setInterval(() => {
    try {
      res.write(`data: ${buildPayload()}\n\n`);
    } catch {
      clearInterval(iv);
    }
  }, 4_000);

  // Keep-alive comment every 25 s — prevents proxies/load-balancers from
  // closing idle connections before the client disconnects naturally.
  const hb = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(hb);
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(iv);
    clearInterval(hb);
  });
});

// Public, non-sensitive runtime config useful for the frontend
app.get('/api/config', (_req, res) => {
  res.json({
    webhook: {
      ttlMs: WH_TTL_MS,
      maxEvents: WH_MAX,
      createLimit: WH_CREATE_LIMIT,
      maxChannels: WH_MAX_CHANNELS,
    },
    limits: {
      maxSessions: Number(process.env.MAX_SESSIONS ?? 3),
      maxSessionsPerIp: MAX_PER_IP,
    },
    rates: {
      globalWindowMs: GLOBAL_RATE_LIMIT_WINDOW_MS,
      globalLimit: GLOBAL_RATE_LIMIT,
      proxyWindowMs: PROXY_RATE_WINDOW_MS,
      proxyLimit: PROXY_RATE_LIMIT,
    },
    thresholds: { overloadThreshold: overloadThreshold(), killThreshold: killThreshold() },
    disableNewSessions: DISABLE_NEW_SESSIONS,
  });
});

app.get('/api/my-quota', async (req, res) => {
  const ip = clientIp(req);
  const remainSec = await dailyRemainingSeconds(ip);
  res.json({
    dailyRemainingSeconds: remainSec,
    dailyLimitSeconds: Math.max(60, Number(process.env.DAILY_LIMIT_MS ?? 60 * 60_000)) / 1000,
    sessionsActive: getSessionCountForIp(ip),
  });
});

app.get('/api/os-images', (_req, res) => res.json(OS_IMAGES));

// Parse a curl command into structured fields
app.post('/api/curl/parse', (req, res) => {
  const { cmd } = req.body as { cmd?: string };
  if (typeof cmd !== 'string' || !cmd.trim())
    return res.status(400).json({ error: 'Provide a `cmd` field.' });
  try {
    return res.json(parseCurl(cmd));
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

// ---- Curl/HTTP proxy ---------------------------------------------------------

const curlLimiter = rateLimit({
  windowMs: PROXY_RATE_WINDOW_MS,
  limit: PROXY_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'API proxy rate limit exceeded. Wait a minute.' },
  keyGenerator: (req) => clientIp(req),
});

const requestSchema = z.object({
  url: z.string().url().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).default('GET'),
  // Accept a simple string->string map for headers. Provide explicit
  // key/value string schemas to satisfy the TypeScript/Zod overloads.
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().optional(),
  curl: z.string().optional(),
  followRedirects: z.boolean().default(true),
  timeoutMs: z.number().min(500).max(30_000).default(15_000),
});

app.post('/api/request/run', curlLimiter, async (req, res) => {
  try {
    const p = requestSchema.parse(req.body);
    const allowPrivate = ALLOW_PRIVATE_PROXY && req.headers['x-allow-private-host'] === 'true';

    let url: string,
      method: string,
      headers: Record<string, string>,
      body: string | undefined,
      followRedirects: boolean;

    if (p.curl) {
      const parsed = parseCurl(p.curl);
      ({ url, method, headers, body, followRedirects } = parsed);
    } else if (p.url) {
      url = p.url;
      method = p.method;
      // Zod may infer a loose record type; cast to the expected string->string map.
      headers = p.headers as Record<string, string>;
      body = p.body;
      followRedirects = p.followRedirects;
    } else {
      return res.status(400).json({ error: 'Provide either `url` or `curl` field.' });
    }

    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL.' });
    }

    if (!['http:', 'https:'].includes(urlObj.protocol))
      return res.status(400).json({ error: 'Only http and https URLs are allowed.' });

    if (!(await isSafeHost(urlObj.hostname, allowPrivate)))
      return res
        .status(400)
        .json({ error: 'Requests to private or internal IP ranges are blocked.' });

    const safeHeaders = sanitizeReqHeaders({ 'User-Agent': 'FairArena/2.0', ...headers });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), p.timeoutMs);
    let fetchRes: any;
    const t0 = Date.now();
    try {
      fetchRes = await fetch(url, {
        method,
        headers: safeHeaders,
        redirect: followRedirects ? 'follow' : 'manual',
        ...(body && !['GET', 'HEAD'].includes(method) ? { body } : {}),
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === 'AbortError')
        return res.status(504).json({ error: `Request timed out after ${p.timeoutMs} ms.` });
      return res.status(502).json({ error: `Network error: ${(err as Error).message}` });
    }
    clearTimeout(timer);

    const elapsed = Date.now() - t0;
    const ct = fetchRes.headers?.get?.('content-type') ?? '';
    const rawText = await (fetchRes.text ? fetchRes.text() : '')
      .catch(() => '')
      .then((t: string) => String(t));
    const truncated = rawText.slice(0, 1_048_576);

    let parsedBody: unknown = truncated;
    if (ct.includes('application/json') || ct.includes('+json')) {
      try {
        parsedBody = JSON.parse(truncated);
      } catch {}
    }

    return res.status(200).json({
      ok: fetchRes?.ok ?? false,
      status: fetchRes?.status ?? 0,
      statusText: fetchRes?.statusText ?? '',
      headers: sanitizeRespHeaders(fetchRes?.headers ?? new Headers()),
      body: parsedBody,
      bodyRaw: truncated,
      contentType: ct,
      elapsed,
      size: rawText.length,
      redirected: fetchRes?.redirected ?? false,
      finalUrl: fetchRes?.url && fetchRes.url !== url ? fetchRes.url : undefined,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.issues?.[0]?.message ?? 'Invalid request' });
    console.error('[proxy]', (err as Error).message);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
});

// ---- DNS propagation checker endpoint --------------------------------------
app.post('/api/dns/propagation', dnsLimiter, async (req, res) => {
  try {
    const payload = z
      .object({
        domain: z
          .string()
          .min(1)
          .transform((s) => s.trim()),
        types: z
          .array(
            z.enum([
              'A',
              'AAAA',
              'CNAME',
              'MX',
              'TXT',
              'NS',
              'SOA',
              'SRV',
              'PTR',
              'CAA',
              'DNSKEY',
              'DS',
              'ALL',
            ]),
          )
          .optional(),
      })
      .parse(req.body);

    let domain = payload.domain;
    try {
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(domain) || domain.includes('/')) {
        const u = new URL(domain);
        domain = u.hostname;
      }
    } catch {}

    if (/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(domain)) {
      return res.status(400).json({ error: 'Private or loopback hosts are not allowed.' });
    }

    const resolvers = [
      { name: 'Google', server: '8.8.8.8' },
      { name: 'Cloudflare', server: '1.1.1.1' },
      { name: 'Quad9', server: '9.9.9.9' },
      { name: 'OpenDNS', server: '208.67.222.222' },
    ];

    const results: Record<string, any> = {};
    const types = payload.types || ['A'];

    for (const resolver of resolvers) {
      try {
        const result = await performDnsLookups(domain, types, resolver.server);
        results[resolver.name] = { server: resolver.server, data: result };
      } catch (err) {
        results[resolver.name] = { server: resolver.server, error: (err as Error).message };
      }
    }

    return res.json({ domain, types, results });
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.issues.map((e: z.ZodIssue) => e.message).join('; ') });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ---- DNS resolve endpoint ---------------------------------------------------
app.post('/api/dns/resolve', dnsLimiter, async (req, res) => {
  try {
    const payload = domainSchema.parse(req.body);
    let domain = payload.domain;

    // If the caller provided a full URL (https://example.com/path), extract hostname
    try {
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(domain) || domain.includes('/')) {
        const u = new URL(domain);
        domain = u.hostname;
      }
    } catch {
      // fallback to using the raw domain — validation below will catch invalid hostnames
    }

    // Basic domain validation: disallow private IPs or localhost
    if (/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(domain)) {
      return res.status(400).json({ error: 'Private or loopback hosts are not allowed.' });
    }

    const cacheKey = `${domain}:${(payload.types || []).join(',')}:${payload.resolver || 'default'}`;
    const cached = dnsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < DNS_CACHE_TTL_MS) {
      return res.json({ cached: true, fromCache: true, data: cached.result });
    }

    const result = await performDnsLookups(domain, payload.types, payload.resolver);
    dnsCache.set(cacheKey, { ts: Date.now(), result });
    return res.json({ cached: false, data: result });
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.issues.map((e: z.ZodIssue) => e.message).join('; ') });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ---- Webhook routes ----------------------------------------------------------

app.post('/api/webhook/create', whCreateLimiter, (req, res) => {
  const id = crypto.randomBytes(12).toString('hex');
  const now = Date.now();
  const name = (req.body as Record<string, unknown>)?.name as string | undefined;
  webhooks.set(id, {
    id,
    name:
      typeof name === 'string' && name.trim()
        ? name.trim().slice(0, 64)
        : `channel-${id.slice(0, 6)}`,
    createdAt: now,
    expiresAt: now + WH_TTL_MS,
    events: [],
    listeners: new Set(),
  });
  res.json({
    id,
    url: `/api/webhook/${id}/incoming`,
    expiresIn: WH_TTL_MS,
    expiresAt: now + WH_TTL_MS,
    createdAt: now,
  });
});

app.all('/api/webhook/:id/incoming', (req, res) => {
  const ch = webhooks.get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found or expired.' });
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? '');
  let parsedBody: unknown = rawBody;
  if ((req.headers['content-type'] ?? '').includes('application/json')) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {}
  }
  const event: WebhookEvent = {
    id: uuidv4(),
    receivedAt: Date.now(),
    method: req.method,
    headers: sanitizeReqHeaders(req.headers as Record<string, string>),
    query: req.query as Record<string, string>,
    body: parsedBody,
    bodyRaw: rawBody.slice(0, 65_536),
  };
  if (ch.events.length >= WH_MAX) ch.events.shift();
  ch.events.push(event);
  const data = JSON.stringify({ type: 'event', event });
  ch.listeners.forEach((sse) => {
    try {
      sse.write(`data: ${data}\n\n`);
    } catch {}
  });
  return res.status(200).json({ ok: true });
});

app.get('/api/webhook/:id/listen', (req, res: ExpressResponse) => {
  const ch = webhooks.get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found.' });
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx / reverse-proxy buffering
  res.flushHeaders();

  // ── Send a named "connected" event immediately ───────────────────────────────
  // Without any initial body bytes the Vite dev proxy (and many CDNs) will buffer
  // the response until the first real event, keeping EventSource.readyState at
  // CONNECTING forever. A named event also lets the client detect "live" reliably
  // without depending on EventSource.onopen (which some browsers fire late or not
  // at all when proxied).
  res.write(`event: connected\ndata: ${JSON.stringify({ channelId: req.params.id })}\n\n`);

  // Replay persisted events to the new subscriber
  for (const event of ch.events) res.write(`data: ${JSON.stringify({ type: 'event', event })}\n\n`);

  // 25-second SSE comment heartbeats prevent network intermediaries from dropping
  // idle connections (most proxies time out after 30-60 s with no traffic).
  const hb = setInterval(() => {
    try {
      res.write(': hb\n\n');
    } catch {
      clearInterval(hb);
    }
  }, 25_000);

  ch.listeners.add(res);
  req.on('close', () => {
    clearInterval(hb);
    ch.listeners.delete(res);
  });
});

app.get('/api/webhook/:id/events', (req, res) => {
  const ch = webhooks.get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found.' });
  res.json({ events: ch.events });
});

// Clear all events in a channel
app.delete('/api/webhook/:id/events', (req, res) => {
  const ch = webhooks.get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found.' });
  ch.events = [];
  return res.json({ ok: true });
});

// Rename a channel
app.patch('/api/webhook/:id/name', (req, res) => {
  const ch = webhooks.get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found.' });
  const name = (req.body as Record<string, unknown>)?.name as string | undefined;
  if (typeof name !== 'string' || !name.trim())
    return res.status(400).json({ error: 'Provide a `name` field.' });
  ch.name = name.trim().slice(0, 64);
  return res.json({ ok: true, name: ch.name });
});

// Get channel metadata
app.get('/api/webhook/:id/info', (req, res) => {
  const ch = webhooks.get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'Webhook channel not found.' });
  return res.json({
    id: ch.id,
    name: ch.name,
    createdAt: ch.createdAt,
    expiresAt: ch.expiresAt,
    eventCount: ch.events.length,
  });
});

app.delete('/api/webhook/:id', (req, res) => {
  const ch = webhooks.get(req.params.id);
  if (ch) {
    ch.listeners.forEach((r) => {
      try {
        r.end();
      } catch {}
    });
    webhooks.delete(req.params.id);
  }
  res.json({ ok: true });
});

// ---- Rate Limit Tester endpoint -----------------------------------------------

interface RateLimitTestRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  headers: Record<string, string>;
  body?: string;
  requestsPerMinute: number;
  durationSeconds: number;
  noCorsBypass?: boolean;
}

interface RateLimitTestResponse {
  testId: string;
  results: Array<{
    requestNumber: number;
    timestamp: number;
    status: number | null;
    latency: number;
    success: boolean;
    error?: string;
    retryAfter?: number;
  }>;
  stats: {
    // Basic counts
    total: number;
    successful: number;
    failed: number;
    successRate: number;

    // Latency statistics
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    stdDevLatency: number;
    varianceLatency: number;
    medianLatency: number;
    p25Latency: number;
    p50Latency: number;
    p75Latency: number;
    p90Latency: number;
    p95Latency: number;
    p99Latency: number;
    p99_9Latency: number;

    // Throughput metrics
    requestsPerSecond: number;
    totalTestDuration: number;

    // Error analysis
    errorDistribution: Record<string, number>;
    mostCommonError: { error: string; count: number } | null;

    // Status codes
    statusCodeDistribution: Record<number, number>;

    // Outliers and trend
    stdDevCount: number;
    outlierCount: number;
    outlierPercentage: number;
    latencyTrend: 'improving' | 'stable' | 'degrading';

    // Time-based metrics
    timeToFirstFailureMs: number | null;
    meanTimeToFailureMs: number | null;

    // Header detection
    retryAfterHeaders: number[];

    // Response time histogram buckets (for charting)
    latencyHistogram: Array<{ bucket: string; count: number }>;
  };
  duration: number;
}

const rateLimitTestLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown',
  skip: (req) => process.env.BYPASS_LIMITS === 'true',
});

app.post('/api/rate-limit/test', rateLimitTestLimiter, async (req, res: ExpressResponse) => {
  try {
    const payload = req.body as Partial<RateLimitTestRequest>;

    // Validation
    if (typeof payload.url !== 'string' || !payload.url.trim()) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const method = payload.method || 'GET';
    const headers = payload.headers || {};
    const body = payload.body || '';
    const requestsPerMinute = Math.max(1, Math.min(100, payload.requestsPerMinute || 10));
    const durationSeconds = Math.max(1, Math.min(600, payload.durationSeconds || 60));

    // Validate URL (basic SSRF protection)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(payload.url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Only HTTP(S) URLs are supported' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const results: RateLimitTestResponse['results'] = [];
    const interval = 60000 / requestsPerMinute;
    const totalRequests = Math.floor((durationSeconds * 1000) / interval);
    const testId = crypto.randomBytes(8).toString('hex');

    let requestNumber = 0;

    for (let i = 0; i < totalRequests; i++) {
      requestNumber++;
      const startTime = performance.now();

      try {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            'User-Agent': 'FairArena-RateLimitTester/1.0',
            ...headers,
          },
          signal: AbortSignal.timeout(30000), // 30 second timeout per request
        };

        if (body && method !== 'GET' && method !== 'HEAD') {
          fetchOptions.body = body;
        }

        const response = await fetch(payload.url, fetchOptions);
        const latency = performance.now() - startTime;
        const retryAfter = response.headers.get('Retry-After');

        results.push({
          requestNumber,
          timestamp: Date.now(),
          status: response.status,
          latency,
          success: response.ok,
          retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
        });
      } catch (error) {
        const latency = performance.now() - startTime;
        results.push({
          requestNumber,
          timestamp: Date.now(),
          status: null,
          latency,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Wait before next request
      if (i < totalRequests - 1) {
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    // Calculate statistics
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const latencies = results.map((r) => r.latency).sort((a, b) => a - b);
    const statusCodeDist: Record<number, number> = {};
    const errorDist: Record<string, number> = {};
    const retryAfters: number[] = [];

    results.forEach((result) => {
      if (result.status !== null) {
        statusCodeDist[result.status] = (statusCodeDist[result.status] || 0) + 1;
      }
      if (result.error) {
        errorDist[result.error] = (errorDist[result.error] || 0) + 1;
      }
      if (result.retryAfter) {
        retryAfters.push(result.retryAfter);
      }
    });

    // Percentile calculation helper
    const calculatePercentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    // Standard deviation and variance
    const mean = latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 0;
    const variance =
      latencies.length > 0
        ? latencies.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / latencies.length
        : 0;
    const stdDev = Math.sqrt(variance);

    // Outlier detection (> 2 standard deviations from mean)
    const outliers = latencies.filter((l) => Math.abs(l - mean) > 2 * stdDev);
    const outlierCount = outliers.length;
    const outlierPercentage = (outlierCount / latencies.length) * 100;

    // Trend detection (split first half vs second half latencies)
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (latencies.length > 1) {
      const mid = Math.floor(latencies.length / 2);
      const firstHalf = latencies.slice(0, mid);
      const secondHalf = latencies.slice(mid);
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
      const diff = firstHalfAvg - secondHalfAvg;
      if (diff > secondHalfAvg * 0.1)
        trend = 'improving'; // 10% improvement
      else if (diff < -secondHalfAvg * 0.1) trend = 'degrading'; // 10% degradation
    }

    // Time to first failure
    const firstFailure = results.find((r) => !r.success);
    const timeToFirstFailure = firstFailure ? firstFailure.timestamp - results[0].timestamp : null;

    // Mean time to failure (average time between failures)
    const failureIndices = results.map((r, i) => (r.success ? -1 : i)).filter((i) => i >= 0);
    let meanTimeToFailure: number | null = null;
    if (failureIndices.length > 0) {
      let totalTimeBetweenFailures = 0;
      for (let i = 1; i < failureIndices.length; i++) {
        const idx1 = failureIndices[i - 1];
        const idx2 = failureIndices[i];
        totalTimeBetweenFailures += results[idx2].timestamp - results[idx1].timestamp;
      }
      meanTimeToFailure = totalTimeBetweenFailures / Math.max(1, failureIndices.length - 1);
    }

    // Latency histogram buckets (for charting)
    const buckets = [0, 50, 100, 200, 500, 1000, 2000, 5000, Infinity];
    const histogramBuckets: Array<{ bucket: string; count: number }> = [];
    for (let i = 0; i < buckets.length - 1; i++) {
      const bucketName =
        buckets[i + 1] === Infinity ? `${buckets[i]}ms+` : `${buckets[i]}-${buckets[i + 1]}ms`;
      const count = latencies.filter((l) => l >= buckets[i] && l < buckets[i + 1]).length;
      histogramBuckets.push({ bucket: bucketName, count });
    }

    const mostCommonError =
      Object.entries(errorDist).length > 0
        ? Object.entries(errorDist).reduce((a, b) => (b[1] > a[1] ? b : a))
        : null;

    const totalDuration =
      results.length > 0
        ? (results[results.length - 1].timestamp - results[0].timestamp) / 1000
        : 0;

    const response: RateLimitTestResponse = {
      testId,
      results,
      stats: {
        total: results.length,
        successful,
        failed,
        successRate: (successful / results.length) * 100,
        avgLatency: mean,
        minLatency: latencies.length > 0 ? latencies[0] : 0,
        maxLatency: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
        stdDevLatency: stdDev,
        varianceLatency: variance,
        medianLatency: calculatePercentile(latencies, 50),
        p25Latency: calculatePercentile(latencies, 25),
        p50Latency: calculatePercentile(latencies, 50),
        p75Latency: calculatePercentile(latencies, 75),
        p90Latency: calculatePercentile(latencies, 90),
        p95Latency: calculatePercentile(latencies, 95),
        p99Latency: calculatePercentile(latencies, 99),
        p99_9Latency: calculatePercentile(latencies, 99.9),
        requestsPerSecond: totalDuration > 0 ? results.length / totalDuration : 0,
        totalTestDuration: totalDuration,
        errorDistribution: errorDist,
        mostCommonError: mostCommonError
          ? { error: mostCommonError[0], count: mostCommonError[1] }
          : null,
        statusCodeDistribution: statusCodeDist,
        stdDevCount: outlierCount,
        outlierCount,
        outlierPercentage,
        latencyTrend: trend,
        timeToFirstFailureMs: timeToFirstFailure,
        meanTimeToFailureMs: meanTimeToFailure,
        retryAfterHeaders: [...new Set(retryAfters)].sort((a, b) => a - b),
        latencyHistogram: histogramBuckets,
      },
      duration: results.length * interval,
    };

    res.json(response);
  } catch (error) {
    console.error('Rate limit test error:', error);
    res.status(500).json({ error: 'Failed to run rate limit test', details: String(error) });
  }
});

// ---- URL Shortener API (farena.me integration) --------------------------------

// Validation schema for URL shortener
const CreateShortUrlSchema = z.object({
  originalUrl: z.string().url('Invalid URL format'),
  customCode: z.string().max(20).optional(),
  expiryHours: z.number().min(1).max(48, 'Max 48 hours allowed'),
  maxUsages: z.number().positive().optional(),
  notes: z.string().max(200).optional(),
  tags: z.array(z.string().trim().min(3, 'Each tag must be at least 3 characters').max(40)).max(12).optional(),
  secret: z.string().trim().min(1).max(128).optional(),
  snappiApiKey: z.string().optional(), // For future: allow client to provide farena.me API key
});

const UrlShortenerAnalyticsQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).default(50),
});

const DEFAULT_SNAPP_SELECT = {
  id: true,
  shortcode: true,
  originalUrl: true,
  createdAt: true,
  expiresAt: true,
  disabled: true,
  userId: true,
  groupId: true,
  maxUsages: true,
  hit: true,
  used: true,
  notes: true,
  tag: {
    select: {
      name: true,
      slug: true,
      notes: true,
    },
  },
} as const;

const DEFAULT_USAGE_SELECT = {
  id: true,
  timestamp: true,
  snappId: true,
  ownerId: true,
  language: true,
  userAgent: true,
  referrer: true,
  device: true,
  country: true,
  region: true,
  city: true,
  os: true,
  browser: true,
  cpu: true,
} as const;

function slugifyTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function hashShortenerSecret(secret: string): Promise<string> {
  const normalized = secret.trim();
  // If already a bcrypt hash, return as-is
  if (/^\$2[aby]\$\d{2}\$.{53}$/i.test(normalized)) {
    return normalized;
  }
  // Hash with bcrypt (rounds: 12 provides good security/performance balance)
  const hashed = await bcryptjs.hash(normalized, 12);
  return hashed;
}

function buildTagConnectOrCreate(tags?: string[]): { connectOrCreate: Array<{ where: { slug: string }, create: { name: string, slug: string, notes: string | null } }> } | undefined {
  if (!tags || tags.length === 0) return undefined;

  const unique = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return undefined;

  return {
    connectOrCreate: unique.map((tag) => {
      const slug = slugifyTag(tag);
      return {
        where: { slug },
        create: {
          name: tag,
          slug,
          notes: null,
        },
      };
    }),
  };
}

function encodeQueryArg(q: unknown): string {
  return encodeURIComponent(JSON.stringify(q));
}

function normalizeTagStrings(tagData: unknown): string[] {
  if (!Array.isArray(tagData)) return [];

  return tagData
    .map((tag) => {
      if (typeof tag === 'string') return tag;
      if (tag && typeof tag === 'object') {
        const obj = tag as Record<string, unknown>;
        return typeof obj.slug === 'string'
          ? obj.slug
          : typeof obj.name === 'string'
            ? obj.name
            : null;
      }
      return null;
    })
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function summarizeUsageDimension(rows: Array<Record<string, unknown>>, field: string): Array<{ key: string, count: number }> {
  const buckets = new Map<string, number>();

  for (const row of rows) {
    const raw = row[field];
    const key = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : 'Unknown';
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

// Helper function to generate random shortcode
function generateRandomShortcode(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Rate limiter for URL shortener
const urlShortenerLimiter = rateLimit({
  windowMs: 60_000,
  max: 10, // 10 URLs per minute per IP
  message: 'Too many URL shortening requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.BYPASS_LIMITS === 'true',
});

app.post('/api/url-shortener/create', urlShortenerLimiter, async (req, res) => {
  try {
    const validation = CreateShortUrlSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const {
      originalUrl,
      customCode,
      expiryHours,
      maxUsages,
      notes,
      tags,
      secret,
      snappiApiKey,
    } = validation.data;
    const farenaMeApiKey = snappiApiKey || process.env.SNAPP_LI_API_KEY || process.env.FARENA_ME_API_KEY;

    // Check if API key is configured
    if (!farenaMeApiKey) {
      console.error('[url-shortener] No API key found in environment');
      return res.status(503).json({
        error: 'URL shortener service is not configured',
        message: 'farena.me API key is not set on the server',
      });
    }
    // Generate shortcode if not provided
    const shortcode = customCode || generateRandomShortcode(6);

    // Calculate expiry timestamp
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
    const userId = process.env.FARENA_ME_USER_ID;
    const tag = buildTagConnectOrCreate(tags);
    const hashedSecret = secret ? await hashShortenerSecret(secret) : undefined;

    // Prepare farena.me API payload using docs-aligned SnappCreateArgs shape
    const payload = {
      data: {
        shortcode,
        originalUrl,
        userId,
        ...(maxUsages !== undefined && { maxUsages }),
        ...(notes && { notes }),
        ...(hashedSecret && { secret: hashedSecret }),
        ...(tag && { tag }),
        expiresAt,
      },
      select: DEFAULT_SNAPP_SELECT,
    };

    // Call actual farena.me API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${farenaMeApiKey}`,
    };

    let farenaMeResponse = await fetch('https://farena.me/api/snapp/create', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (farenaMeResponse.status === 403) {
      farenaMeResponse = await fetch('https://farena.me/api/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
    }

    // Handle farena.me API errors
    if (!farenaMeResponse.ok) {
      const errorBody = await farenaMeResponse.text();
      console.error('[url-shortener] farena.me API error:', farenaMeResponse.status, errorBody);
      
      if (farenaMeResponse.status === 401 || farenaMeResponse.status === 403) {
        return res.status(503).json({
          error: 'Authentication failed',
          message: 'Invalid or expired farena.me API key. Please contact administrator.',
        });
      }
      
      if (farenaMeResponse.status === 409) {
        return res.status(409).json({
          error: 'Shortcode already exists',
          message: `The shortcode "${shortcode}" is already taken. Please choose a different one.`,
        });
      }

      if (farenaMeResponse.status === 422) {
        let details: unknown;
        try {
          details = JSON.parse(errorBody);
        } catch {
          details = errorBody;
        }
        return res.status(422).json({
          error: 'Invalid request',
          message: 'Invalid parameters sent to URL shortener service',
          details,
        });
      }

      return res.status(farenaMeResponse.status).json({
        error: 'URL shortener service error',
        message: `farena.me API returned status ${farenaMeResponse.status}`,
      });
    }

    // Parse successful response
    const farenaMeData = await farenaMeResponse.json();
    const createdUrl = farenaMeData.data || farenaMeData;

    // Validate response has required fields - map to expected field names
    if (!createdUrl) {
      console.error('[url-shortener] Invalid response from farena.me:', farenaMeData);
      return res.status(502).json({
        error: 'Invalid response from service',
        message: 'URL shortener returned invalid data',
      });
    }

    // Extract fields - handle various possible field names from API
    const responseId = createdUrl.id || createdUrl._id;
    const responseCode = createdUrl.code || createdUrl.shortcode;
    const responseUrl = createdUrl.url || createdUrl.originalUrl;
    const responseCreated = createdUrl.createdAt || createdUrl.created_at || new Date().toISOString();

    if (!responseCode) {
      console.error('[url-shortener] Invalid response from farena.me - missing code:', farenaMeData);
      return res.status(502).json({
        error: 'Invalid response from service',
        message: 'URL shortener returned invalid data',
      });
    }

    const normalizedTags = normalizeTagStrings(createdUrl.tag ?? createdUrl.tags ?? tags ?? []);

    // Success response
    res.status(201).json({
      success: true,
      data: {
        id: responseId,
        shortcode: responseCode,
        originalUrl: responseUrl || originalUrl,
        createdAt: responseCreated,
        expiresAt: createdUrl.expiration || expiresAt,
        maxUsages: createdUrl.maxClicks || createdUrl.maxUsages || maxUsages || null,
        hit: createdUrl.hit ?? 0,
        used: createdUrl.used ?? 0,
        secret: null,
        hasSecret: Boolean(createdUrl.secret || hashedSecret),
        notes: createdUrl.description || createdUrl.notes || notes || null,
        tags: normalizedTags,
        tag: createdUrl.tag || normalizedTags.map((slug) => ({ name: slug, slug })),
        disabled: createdUrl.disabled || false,
        shortUrl: `https://farena.me/${responseCode}`,
      },
      message: 'Short URL created successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('[url-shortener] Request timeout');
        return res.status(504).json({
          error: 'Service timeout',
          message: 'URL shortener service took too long to respond',
        });
      }
      console.error('[url-shortener] Error:', error.message);
      return res.status(500).json({
        error: 'Failed to create short URL',
        message: error.message,
      });
    }
    console.error('[url-shortener] Unknown error:', error);
    res.status(500).json({
      error: 'Failed to create short URL',
      message: 'Unknown error occurred',
    });
  }
});

app.get('/api/url-shortener/:id/analytics', urlShortenerLimiter, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'URL id is required',
    });
  }

  const parsedQuery = UrlShortenerAnalyticsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsedQuery.error.issues,
    });
  }

  const apiKey = process.env.SNAPP_LI_API_KEY || process.env.FARENA_ME_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'URL shortener service is not configured',
      message: 'farena.me API key is not set on the server',
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  try {
    const snappQuery = encodeQueryArg({
      where: { id },
      select: DEFAULT_SNAPP_SELECT,
    });

    const snappResponse = await fetch(`https://farena.me/api/snapp/findUnique?q=${snappQuery}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!snappResponse.ok) {
      const errorBody = await snappResponse.text();
      return res.status(snappResponse.status).json({
        error: 'Failed to fetch short URL metrics',
        message: `snapp.findUnique failed with status ${snappResponse.status}`,
        details: errorBody,
      });
    }

    const snappPayload = await snappResponse.json();
    const snapp = snappPayload?.data;

    if (!snapp) {
      return res.status(404).json({
        error: 'Not found',
        message: `No short URL found with id "${id}"`,
      });
    }

    const usageFindManyQuery = encodeQueryArg({
      where: { snappId: id },
      orderBy: { timestamp: 'desc' },
      take: parsedQuery.data.take,
      select: DEFAULT_USAGE_SELECT,
    });

    const usageCountQuery = encodeQueryArg({
      where: { snappId: id },
    });

    const [usageListResult, usageCountResult] = await Promise.allSettled([
      fetch(`https://farena.me/api/usage/findMany?q=${usageFindManyQuery}`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://farena.me/api/usage/count?q=${usageCountQuery}`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    let usageRows: Array<Record<string, unknown>> = [];
    let usageTotal = 0;
    let usageWarning: string | null = null;

    if (usageListResult.status === 'fulfilled' && usageListResult.value.ok) {
      const usagePayload = await usageListResult.value.json();
      usageRows = Array.isArray(usagePayload?.data) ? usagePayload.data : [];
    } else {
      usageWarning = 'Usage detail feed is unavailable for this API key.';
    }

    if (usageCountResult.status === 'fulfilled' && usageCountResult.value.ok) {
      const usageCountPayload = await usageCountResult.value.json();
      usageTotal = typeof usageCountPayload?.data === 'number' ? usageCountPayload.data : usageRows.length;
    } else {
      usageTotal = usageRows.length;
      usageWarning = usageWarning ?? 'Usage count feed is unavailable for this API key.';
    }

    const countryBreakdown = summarizeUsageDimension(usageRows, 'country').slice(0, 10);
    const browserBreakdown = summarizeUsageDimension(usageRows, 'browser').slice(0, 10);
    const osBreakdown = summarizeUsageDimension(usageRows, 'os').slice(0, 10);
    const deviceBreakdown = summarizeUsageDimension(usageRows, 'device').slice(0, 10);
    const referrerBreakdown = summarizeUsageDimension(usageRows, 'referrer').slice(0, 10);

    const byDayMap = new Map<string, number>();
    for (const row of usageRows) {
      const timestamp = row.timestamp;
      if (typeof timestamp !== 'string') continue;
      const dayKey = timestamp.slice(0, 10);
      byDayMap.set(dayKey, (byDayMap.get(dayKey) ?? 0) + 1);
    }

    const timeline = [...byDayMap.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const maxUsages = typeof snapp.maxUsages === 'number' ? snapp.maxUsages : null;
    const used = typeof snapp.used === 'number' ? snapp.used : 0;
    const remainingUsages = maxUsages && maxUsages > 0 ? Math.max(0, maxUsages - used) : null;

    return res.json({
      success: true,
      data: {
        snapp,
        metrics: {
          totalHits: typeof snapp.hit === 'number' ? snapp.hit : 0,
          totalUsed: used,
          usageCount: usageTotal,
          maxUsages,
          remainingUsages,
          countryBreakdown,
          browserBreakdown,
          osBreakdown,
          deviceBreakdown,
          referrerBreakdown,
          timeline,
          recentUsage: usageRows,
          warning: usageWarning,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Service timeout',
        message: 'Metrics service took too long to respond',
      });
    }

    console.error('[url-shortener] analytics error:', error);
    return res.status(500).json({
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

app.use((_req, res: ExpressResponse) => res.status(404).json({ error: 'Not found' }));

// ---- HTTP + WebSocket Server -------------------------------------------------

const server = http.createServer(app);
// Enable permessage-deflate so clients (and reverse proxies) that request
// compression (permessage-deflate) can negotiate successfully.
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true });
const clipSyncWss = new WebSocketServer({ noServer: true, perMessageDeflate: true });

// ---- ClipSync relay ---------------------------------------------------------

const CLIPSYNC_MAX_ROOMS = Math.max(10, Number(process.env.CLIPSYNC_MAX_ROOMS ?? 500));
const CLIPSYNC_MAX_PEERS = Math.max(2, Number(process.env.CLIPSYNC_MAX_PEERS ?? 10));
const CLIPSYNC_ROOM_INACTIVE_TTL_MS = Math.max(
  60_000,
  Number(process.env.CLIPSYNC_ROOM_INACTIVE_TTL_MS ?? 10 * 60_000),
);
const CLIPSYNC_ROOM_TOTAL_TTL_MS = Math.max(
  5 * 60_000,
  Number(process.env.CLIPSYNC_ROOM_TOTAL_TTL_MS ?? 30 * 60_000),
);
const CLIPSYNC_MAX_ROOMS_PER_IP = Math.max(1, Number(process.env.CLIPSYNC_MAX_ROOMS_PER_IP ?? 2));
// ~5 MB raw file after base64 encoding (~1.37×) + JSON + AES overhead
const CLIPSYNC_MSG_MAX_B64 = Math.max(
  65_536,
  Number(process.env.CLIPSYNC_MSG_MAX_B64 ?? 7_000_000),
);

interface ClipSyncPeer {
  ws: WebSocket;
  deviceId: string;
  deviceName: string;
  joinedAt: number;
}
interface ClipSyncRoom {
  id: string;
  joinCode: string;
  peers: Map<string, ClipSyncPeer>;
  // deviceId of the room owner (creator)
  ownerDeviceId?: string;
  // pending join requests: deviceId -> peer (ws connected but not yet accepted)
  pendingRequests?: Map<string, ClipSyncPeer>;
  // room control flags
  acceptingNewJoins: boolean;
  displayCode?: string; // optional visual display code (owner can rotate)
  // rate limiting: track join attempts per IP for anti-brute-force
  joinAttempts?: Map<string, number[]>;
  createdAt: number;
  lastActivityAt: number;
}

const clipRooms = new Map<string, ClipSyncRoom>();
const clipRoomByCode = new Map<string, string>();
const clipRoomsByIp = new Map<string, Set<string>>();

function generateClipJoinCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const arr = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i += 1) out += chars[arr[i] % chars.length];
  return out;
}

function clipPeerList(r: ClipSyncRoom) {
  return [...r.peers.values()].map((p) => ({ deviceId: p.deviceId, deviceName: p.deviceName }));
}

function clipBroadcast(r: ClipSyncRoom, msg: object, excludeId?: string) {
  const data = JSON.stringify(msg);
  for (const p of r.peers.values()) {
    if (p.deviceId === excludeId) continue;
    if (p.ws.readyState === WebSocket.OPEN) {
      try {
        p.ws.send(data);
      } catch {
        /* closed */
      }
    }
  }
}

function clipNotifyOwnerPendingRemoved(
  r: ClipSyncRoom,
  pendingDeviceId: string,
  reason: 'left' | 'approved' | 'rejected' | 'missing' = 'left',
) {
  if (!r.ownerDeviceId) return;
  const owner = r.peers.get(r.ownerDeviceId);
  if (!owner || owner.ws.readyState !== WebSocket.OPEN) return;
  try {
    owner.ws.send(
      JSON.stringify({
        type: 'pending_request_removed',
        deviceId: pendingDeviceId,
        reason,
      }),
    );
  } catch {
    /* ignore */
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, r] of clipRooms.entries()) {
    const isInactive = now - r.lastActivityAt > CLIPSYNC_ROOM_INACTIVE_TTL_MS;
    const isExpired = now - r.createdAt > CLIPSYNC_ROOM_TOTAL_TTL_MS;
    if (r.peers.size === 0 || isInactive || isExpired) {
      clipRoomByCode.delete(r.joinCode);
      clipRooms.delete(id);
      for (const set of clipRoomsByIp.values()) {
        set.delete(id);
      }
    }
  }
}, 5 * 60_000).unref();

// Track every live WebSocket so we can close them all on overload-kill
const activeWs = new Set<WebSocket>();

// ---- Overload kill-all ------------------------------------------------------
// When CPU or RAM exceeds KILL_THRESHOLD %, destroy every session and disconnect
// every WebSocket client so one spike cannot permanently sink the host.
setInterval(
  () => {
    if (isKillOverloaded()) {
      const count = activeWs.size;
      if (count > 0 || sessionCount() > 0) {
        console.warn(
          `[overload] Kill threshold (${killThreshold()}%) breached — evicting ${count} connection(s).`,
        );
        destroyAllSessions();
        for (const ws of activeWs) {
          try {
            ws.send(
              JSON.stringify({
                type: 'error',
                overloaded: true,
                message: `Server is critically overloaded. Your session was terminated to protect other users.`,
              }),
            );
            ws.close();
          } catch {
            /* already closed */
          }
        }
        activeWs.clear();
      }
    }
  },
  Number(process.env.OVERLOAD_CHECK_MS ?? 5_000),
).unref();

server.on('upgrade', (req, socket, head) => {
  const upgradePath = req.url?.split('?')[0];

  if (upgradePath === '/clipsync') {
    const csOrigin = req.headers.origin ?? '';
    if (NODE_ENV === 'production' && csOrigin && !ALLOWED_ORIGINS.includes(csOrigin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    clipSyncWss.handleUpgrade(req, socket, head, (ws) => clipSyncWss.emit('connection', ws, req));
    return;
  }

  if (upgradePath !== '/terminal') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  const origin = req.headers.origin ?? '';
  if (NODE_ENV === 'production' && origin && !ALLOWED_ORIGINS.includes(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  const ip = clientIp(req);
  if (isOverloaded()) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
    return;
  }
  // NOTE: we intentionally do not block upgrade here based on per-IP session
  // counts because the client may be attaching to an existing session. The
  // per-IP session limits are enforced at start-time via `claimSession`.
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

// ---- WebSocket handler -------------------------------------------------------

type WsMsg =
  | { type: 'start'; osId: string; cols?: number; rows?: number }
  | { type: 'stdin'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' }
  | { type: 'kill' }
  | { type: 'attach'; sessionId: string };

function sendWs(ws: WebSocket, msg: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {}
  }
}

wss.on('connection', (ws, req) => {
  activeWs.add(ws);
  ws.once('close', () => activeWs.delete(ws));
  ws.once('error', () => activeWs.delete(ws));

  const ip = clientIp(req as http.IncomingMessage);
  let sessionId: string | null = null;
  let sessionStartedAt = 0;
  let lastThrottleAt = 0;
  let isOwner = false;
  let claimedButNotStarted = false;

  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }, 25_000);

  let idleTimer = setTimeout(() => {
    sendWs(ws, { type: 'error', message: 'Connection closed due to inactivity.' });
    ws.close();
  }, WS_CONN_IDLE_MS);

  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      sendWs(ws, { type: 'error', message: 'Connection closed due to inactivity.' });
      ws.close();
    }, WS_CONN_IDLE_MS);
  };

  let msgCount = 0;
  let throttleLogged = false;
  const msgReset = setInterval(() => {
    msgCount = 0;
    throttleLogged = false;
  }, WS_MSG_WINDOW_MS);

  ws.on('message', async (raw) => {
    if (++msgCount > WS_MSG_RATE_LIMIT) {
      const now = Date.now();
      const cool = Number(process.env.WS_THROTTLE_COOLDOWN_MS ?? 1000);
      // Only emit a single server-side log per-window to avoid flooding logs
      // when a user is pasting or holding keys. We still send a soft status
      // message to the client but only at most once per cooldown interval.
      if (!throttleLogged) {
        throttleLogged = true;
        console.warn('[ws] throttle', {
          ip,
          msgCount,
          limit: WS_MSG_RATE_LIMIT,
          windowMs: WS_MSG_WINDOW_MS,
        });
      }
      if (now - lastThrottleAt > cool) {
        lastThrottleAt = now;
        sendWs(ws, {
          type: 'status',
          message: 'Message rate limit exceeded; input is being throttled briefly.',
        });
      }
      return;
    }
    resetIdle();

    let msg: WsMsg;
    try {
      msg = JSON.parse(raw.toString()) as WsMsg;
    } catch {
      sendWs(ws, { type: 'error', message: 'Invalid JSON.' });
      return;
    }

    if (msg.type === 'ping') {
      sendWs(ws, { type: 'pong' });
      return;
    }

    if (msg.type === 'start') {
      if (sessionId) {
        sendWs(ws, { type: 'error', message: 'Session already started.' });
        return;
      }

      if (DISABLE_NEW_SESSIONS) {
        sendWs(ws, { type: 'error', message: 'New terminal sessions are disabled by operator.' });
        ws.close();
        return;
      }

      if (isOverloaded()) {
        const r = getResources();
        sendWs(ws, {
          type: 'error',
          overloaded: true,
          cpu: r.cpuPercent,
          mem: r.memPercent,
          message: `Server is at capacity (CPU ${r.cpuPercent}%, RAM ${r.memPercent}%). Try again later.`,
        });
        ws.close();
        return;
      }

      if (!isDockerAvailable()) {
        sendWs(ws, { type: 'error', message: 'Docker is not available on this server.' });
        ws.close();
        return;
      }

      const tentativeId = uuidv4();
      const claimErr = await claimSession(ip, tentativeId);
      if (claimErr) {
        sendWs(ws, { type: 'error', message: claimErr });
        ws.close();
        return;
      }
      sessionId = tentativeId;
      isOwner = true;
      claimedButNotStarted = true;
      sendWs(ws, { type: 'status', message: 'Starting container...' });

      try {
        const session = await createSession(sessionId!, msg.osId ?? 'ubuntu', ip);
        // Only mark the start timestamp after successful container creation
        sessionStartedAt = session.startedAt ?? Date.now();
        claimedButNotStarted = false;
        if (msg.cols && msg.rows) resizeSession(sessionId, msg.cols, msg.rows);

        // Batch PTY stdout: accumulate chunks for one event-loop tick with
        // setImmediate then flush as a single WS frame.  This coalesces the
        // many small buffers that node-pty emits (sometimes 4–16 bytes each)
        // into one large payload, cutting WS frame count by 10-50× during
        // burst output (top, cat, ls) and eliminating the socket back-pressure
        // that causes the terminal to appear 'stuck' or laggy.
        let stdoutBuf = '';
        let flushPending = false;
        const flushStdout = () => {
          flushPending = false;
          if (stdoutBuf) {
            sendWs(ws, { type: 'stdout', data: stdoutBuf });
            stdoutBuf = '';
          }
        };
        session.emitter.on('data', (data: string) => {
          stdoutBuf += data;
          if (!flushPending) {
            flushPending = true;
            setImmediate(flushStdout);
          }
        });
        session.emitter.on('exit', (code: number) => {
          // Flush any remaining output before sending exit
          if (stdoutBuf) {
            sendWs(ws, { type: 'stdout', data: stdoutBuf });
            stdoutBuf = '';
          }
          sendWs(ws, { type: 'exit', code });
          ws.close();
        });
        session.emitter.on('expiry-warning', ({ remainingMs }: { remainingMs: number }) => {
          sendWs(ws, {
            type: 'expiry-warning',
            remainingMs,
            message: `Session expires in ${Math.round(remainingMs / 60_000)} minute(s).`,
          });
        });

        sendWs(ws, { type: 'ready', sessionId, expiresIn: getSessionExpiryMs(sessionId!) });
      } catch (err) {
        // If we claimed the active-session key but failed to actually start the
        // container, unclaim it so the user's slot isn't leaked.
        if (claimedButNotStarted && sessionId) {
          try {
            await unclaimSession(ip, sessionId);
          } catch {}
        } else if (sessionStartedAt > 0 && sessionId && isOwner) {
          await releaseSession(ip, sessionId, sessionStartedAt);
        }
        sendWs(ws, { type: 'error', message: (err as Error).message });
        sessionId = null;
        isOwner = false;
        claimedButNotStarted = false;
        ws.close();
      }
      return;
    }

    if (msg.type === 'attach') {
      // Attach to an existing session by id. Only allowed from the same IP
      // that created the session to avoid cross-user hijacking.
      const sid = (msg as any).sessionId as string | undefined;
      if (!sid) {
        sendWs(ws, { type: 'error', message: 'No sessionId provided for attach.' });
        return;
      }
      const existing = getSession(sid);
      if (!existing) {
        sendWs(ws, { type: 'error', message: 'Session not found.' });
        return;
      }
      if (existing.ip !== ip) {
        sendWs(ws, { type: 'error', message: 'Attach denied: IP mismatch.' });
        return;
      }
      // Mark this connection as a non-owner attach; do not unclaim or release on close.
      sessionId = sid;
      sessionStartedAt = existing.startedAt;
      isOwner = false;

      let attachBuf = '';
      let attachFlushPending = false;
      const flushAttach = () => {
        attachFlushPending = false;
        if (attachBuf) {
          sendWs(ws, { type: 'stdout', data: attachBuf });
          attachBuf = '';
        }
      };
      existing.emitter.on('data', (data: string) => {
        attachBuf += data;
        if (!attachFlushPending) {
          attachFlushPending = true;
          setImmediate(flushAttach);
        }
      });
      existing.emitter.on('exit', (code: number) => {
        if (attachBuf) {
          sendWs(ws, { type: 'stdout', data: attachBuf });
          attachBuf = '';
        }
        sendWs(ws, { type: 'exit', code });
        ws.close();
      });
      existing.emitter.on('expiry-warning', ({ remainingMs }: { remainingMs: number }) => {
        sendWs(ws, {
          type: 'expiry-warning',
          remainingMs,
          message: `Session expires in ${Math.round(remainingMs / 60_000)} minute(s).`,
        });
      });
      sendWs(ws, { type: 'ready', sessionId, expiresIn: getSessionExpiryMs(sessionId) });
      return;
    }

    if (!sessionId) {
      // Log so operators can see stray messages (usually premature resize from client)
      console.log('[ws] message before session ready', { ip, type: (msg as any).type });
      sendWs(ws, { type: 'error', message: 'No active session. Send {type:"start"} first.' });
      return;
    }

    if (msg.type === 'stdin') {
      if (typeof msg.data !== 'string' || msg.data.length > 4096) return;
      writeToSession(sessionId, msg.data);
      return;
    }

    if (msg.type === 'resize') {
      resizeSession(
        sessionId,
        Math.max(10, Math.min(500, msg.cols ?? 80)),
        Math.max(3, Math.min(200, msg.rows ?? 24)),
      );
      return;
    }

    if (msg.type === 'kill') {
      const id = sessionId,
        ts = sessionStartedAt;
      destroySession(id);
      if (isOwner && ts > 0 && id) await releaseSession(ip, id, ts);
      sessionId = null;
      sendWs(ws, { type: 'killed' });
      ws.close();
      return;
    }
  });

  const cleanup = async () => {
    clearInterval(heartbeat);
    clearInterval(msgReset);
    clearTimeout(idleTimer);
    // Capture and immediately null sessionId to prevent double-cleanup if
    // both 'close' and 'error' events fire (e.g. forced disconnect).
    const sid = sessionId;
    const startedAt = sessionStartedAt;
    const owner = isOwner;
    const claimedNotStarted = claimedButNotStarted;
    sessionId = null;
    isOwner = false;
    claimedButNotStarted = false;

    if (sid) {
      destroySession(sid);
      if (claimedNotStarted) {
        // Container never started — just free the Redis claim slot without
        // charging the user's daily quota.
        try {
          await unclaimSession(ip, sid);
        } catch {}
      } else if (owner && startedAt > 0) {
        await releaseSession(ip, sid, startedAt);
      }
    }
  };

  ws.on('close', cleanup);
  ws.on('error', (err) => {
    console.error('[ws]', err.message);
    cleanup();
  });
});

// ---- ClipSync WebSocket handler --------------------------------------------

clipSyncWss.on('connection', (ws, req) => {
  activeWs.add(ws);
  ws.once('close', () => activeWs.delete(ws));
  ws.once('error', () => activeWs.delete(ws));

  const ip = clientIp(req as http.IncomingMessage);

  let room: ClipSyncRoom | null = null;
  let deviceId = uuidv4();
  let deviceName = 'Device';
  let joined = false;
  let isPending = false; // Track if peer is pending approval (can signal but not send messages)

  const hb = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }, 25_000);

  let msgCount = 0;
  const msgReset = setInterval(() => {
    msgCount = 0;
  }, 10_000);

  const reply = (msg: object) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        /* closed */
      }
    }
  };

  ws.on('message', (raw) => {
    if (raw instanceof Buffer && raw.length > CLIPSYNC_MSG_MAX_B64 + 256) {
      reply({ type: 'error', message: 'Message too large.' });
      return;
    }
    if (++msgCount > 120) {
      reply({ type: 'error', message: 'Rate limit exceeded.' });
      return;
    }

    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'ping') {
      reply({ type: 'pong' });
      return;
    }

    if (msg.type === 'join') {
      if (joined) return;
      const now = Date.now();
      const roomCode = String(msg.roomId ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
      if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
        reply({ type: 'error', message: 'Invalid room code. Use a 6-character code.' });
        return;
      }
      
      // Accept persisted device ID from client (for tab switching & reconnection)
      // If client sends deviceId, use it; otherwise generate a new one
      const clientDeviceId = msg.deviceId ? String(msg.deviceId).slice(0, 100) : null;
      if (clientDeviceId && /^[a-z0-9_-]+$/i.test(clientDeviceId)) {
        deviceId = clientDeviceId;
      } else {
        deviceId = uuidv4();
      }
      
      deviceName = String(msg.deviceName ?? 'Device')
        .replace(/[<>"&]/g, '')
        .slice(0, 50);

      const resolvedRoomId = clipRoomByCode.get(roomCode);
      let r = resolvedRoomId ? clipRooms.get(resolvedRoomId) : undefined;
      if (!r) {
        const activeRoomsForIp = clipRoomsByIp.get(ip) ?? new Set<string>();
        if (activeRoomsForIp.size >= CLIPSYNC_MAX_ROOMS_PER_IP) {
          reply({ type: 'error', message: `You can host up to ${CLIPSYNC_MAX_ROOMS_PER_IP} active rooms from this IP.` });
          return;
        }
        if (clipRooms.size >= CLIPSYNC_MAX_ROOMS) {
          reply({ type: 'error', message: 'Server room limit reached. Try again later.' });
          return;
        }
        const internalId = uuidv4();
        r = {
          id: internalId,
          joinCode: roomCode,
          peers: new Map(),
          acceptingNewJoins: true,
          displayCode: roomCode,
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
        };
        clipRooms.set(internalId, r);
        clipRoomByCode.set(roomCode, internalId);
        activeRoomsForIp.add(internalId);
        clipRoomsByIp.set(ip, activeRoomsForIp);
      }

      // Check if room is accepting new joins
      if (!r.acceptingNewJoins && r.ownerDeviceId && r.ownerDeviceId !== deviceId) {
        reply({ type: 'error', message: 'Room is not accepting new members at this time.' });
        return;
      }

      // Rate limiting: track join attempts per IP (anti-brute-force)
      // EXCEPTION: Owner reconnecting is always allowed (no rate limit)
      const clientIp = ip;
      const isOwnerReconnect = r.ownerDeviceId && r.ownerDeviceId === deviceId;
      if (!isOwnerReconnect) {
        if (!r.joinAttempts) r.joinAttempts = new Map();
        const attempts = r.joinAttempts.get(clientIp) ?? [];
        const recentAttempts = attempts.filter((t) => now - t < 60_000); // keep last 60s
        if (recentAttempts.length >= 5) {
          reply({ type: 'error', message: 'Too many join attempts. Try again in 60 seconds.' });
          return;
        }
        recentAttempts.push(now);
        r.joinAttempts.set(clientIp, recentAttempts);
      }
      if (r.peers.size >= CLIPSYNC_MAX_PEERS) {
        reply({ type: 'error', message: `Room is full (max ${CLIPSYNC_MAX_PEERS} devices).` });
        return;
      }

      // Determine acceptance: creator becomes owner and is auto-accepted.
      const isCreator = !r.ownerDeviceId;
      if (isCreator) {
        r.ownerDeviceId = deviceId;
      }

      const hasKey = Boolean(msg.hasKey);
      const ecdhPub = msg.ecdhPub === undefined ? null : String(msg.ecdhPub);

      // SECURITY: Reject key-based invites — only PIN-mode joins allowed
      if (hasKey) {
        reply({ type: 'error', message: 'Key-based invites are no longer supported. Use PIN-only mode.' });
        return;
      }
      if (ecdhPub && ecdhPub.length > 2048) {
        reply({ type: 'error', message: 'Invalid key exchange payload.' });
        return;
      }

      // If there is no owner online yet, accept immediately (first peer becomes owner).
      // Otherwise create a pending request and notify the owner.
      const ownerPeer = r.ownerDeviceId ? r.peers.get(r.ownerDeviceId) : undefined;
      if (!ownerPeer || ownerPeer.ws.readyState !== WebSocket.OPEN || r.ownerDeviceId === deviceId) {
        r.peers.set(deviceId, { ws, deviceId, deviceName, joinedAt: Date.now() });
        room = r;
        joined = true;
      } else {
        // ensure pendingRequests map exists
        if (!r.pendingRequests) r.pendingRequests = new Map();
        r.pendingRequests.set(deviceId, { ws, deviceId, deviceName, joinedAt: Date.now() });
        room = r;
        joined = false;
        isPending = true;

        // Notify the owner about the join request (include ECDH pubKey if provided)
        try {
          ownerPeer.ws.send(
            JSON.stringify({ type: 'join_request', from: deviceId, deviceName, ecdhPub }),
          );
        } catch {
          /* ignore */
        }

        // Tell requester they are pending approval
        reply({ type: 'pending', message: 'Awaiting owner approval.' });
        return;
      }
      r.lastActivityAt = Date.now();

      reply({
        type: 'joined',
        deviceId,
        roomId: r.id,
        roomCode: r.joinCode,
        ownerDeviceId: r.ownerDeviceId,
        displayCode: r.displayCode,
        acceptingNewJoins: r.acceptingNewJoins,
        peerCount: r.peers.size,
        peers: clipPeerList(r),
      });
      clipBroadcast(
        r,
        {
          type: 'peer_joined',
          deviceId,
          deviceName,
          peerCount: r.peers.size,
          peers: clipPeerList(r),
        },
        deviceId,
      );
      return;
    }

    if (!room) {
      reply({ type: 'error', message: 'Join a room first.' });
      return;
    }

    // Check if peer is actually in the room (source of truth)
    // Accounts for peers that were approved and moved from pending to peers
    const isActuallyInRoom = room.peers.has(deviceId) || isPending;

    if (!isActuallyInRoom) {
      reply({ type: 'error', message: 'Join a room first.' });
      return;
    }

    room.lastActivityAt = Date.now();

    if (msg.type === 'relay') {
      // Only fully joined peers can send messages; pending peers cannot
      // Update joined flag if peer is in peers list (handles approval transition)
      if (room.peers.has(deviceId) && !joined) {
        joined = true;
        isPending = false;
      }
      if (!joined) {
        reply({ type: 'error', message: 'You must be approved by the owner to send messages.' });
        return;
      }
      const payload = String(msg.payload ?? '');
      if (!payload || payload.length < 8) {
        reply({ type: 'error', message: 'Invalid payload.' });
        return;
      }
      if (payload.length > CLIPSYNC_MSG_MAX_B64) {
        reply({ type: 'error', message: 'Payload too large (max ~5 MB).' });
        return;
      }
      // Blind relay — server never decrypts or stores the payload
      clipBroadcast(
        room,
        { type: 'message', payload, sender: deviceId, senderName: deviceName, ts: Date.now() },
        deviceId,
      );
      return;
    }

    // Owner approval messages
    if (msg.type === 'approve') {
      const toId = String(msg.to ?? '');
      if (!room || room.ownerDeviceId !== deviceId) {
        reply({ type: 'error', message: 'Only the room owner can approve requests.' });
        return;
      }
      const pending = room.pendingRequests?.get(toId);
      if (!pending) {
        reply({ type: 'pending_request_removed', deviceId: toId, reason: 'missing' });
        return;
      }
      // Move pending into peers
      room.pendingRequests?.delete(toId);
      clipNotifyOwnerPendingRemoved(room, toId, 'approved');
      room.peers.set(toId, pending);
      // Notify the newly-joined peer
      try {
        pending.ws.send(
          JSON.stringify({ 
            type: 'joined', 
            deviceId: toId, 
            roomId: room.id, 
            roomCode: room.joinCode,
            ownerDeviceId: room.ownerDeviceId,
            displayCode: room.displayCode,
            acceptingNewJoins: room.acceptingNewJoins,
            peerCount: room.peers.size, 
            peers: clipPeerList(room) 
          }),
        );
      } catch {
        /* ignore */
      }
      // Broadcast peer_joined to ALL existing peers (including owner)
      const allPeers = [...room.peers.values()];
      const joinedMsg = JSON.stringify({ type: 'peer_joined', deviceId: toId, deviceName: pending.deviceName, peerCount: room.peers.size, peers: clipPeerList(room) });
      for (const p of allPeers) {
        if (p.deviceId !== toId && p.ws.readyState === WebSocket.OPEN) {
          try {
            p.ws.send(joinedMsg);
          } catch {}
        }
      }
      reply({ type: 'approved', message: `Approved ${pending.deviceName}` });
      return;
    }

    if (msg.type === 'reject') {
      const toId = String(msg.to ?? '');
      if (!room || room.ownerDeviceId !== deviceId) {
        reply({ type: 'error', message: 'Only the room owner can reject requests.' });
        return;
      }
      const pending = room.pendingRequests?.get(toId);
      if (!pending) {
        reply({ type: 'pending_request_removed', deviceId: toId, reason: 'missing' });
        return;
      }
      room.pendingRequests?.delete(toId);
      clipNotifyOwnerPendingRemoved(room, toId, 'rejected');
      try {
        pending.ws.send(JSON.stringify({ type: 'rejected', message: 'Owner rejected join request.' }));
        pending.ws.close();
      } catch {
        /* ignore */
      }
      return;
    }

    // Unencrypted broadcast (used for ECDH public key exchange — server is blind router)
    // Both pending and joined peers can signal
    if (msg.type === 'signal') {
      if (msg.data === undefined || msg.data === null) return;
      // If this is a key request, forward only to the owner to avoid leaking
      // the ECDH public key to all participants. Otherwise relay as before.
      try {
        const d = msg.data as any;
        if (d && d.meta === 'key_req' && room && room.ownerDeviceId) {
          const owner = room.peers.get(room.ownerDeviceId);
          if (owner && owner.ws.readyState === WebSocket.OPEN) {
            owner.ws.send(JSON.stringify({ type: 'signal', from: deviceId, data: msg.data }));
            return;
          }
        }
      } catch {}
      // Broadcast to only peers, not pending joiners
      const allPeers = room.peers.values();
      for (const p of allPeers) {
        if (p.deviceId !== deviceId && p.ws.readyState === WebSocket.OPEN) {
          try {
            p.ws.send(JSON.stringify({ type: 'signal', from: deviceId, data: msg.data }));
          } catch {}
        }
      }
      return;
    }

    // Direct message to a specific peer (used for ECDH-wrapped AES key delivery or key rotation)
    if (msg.type === 'dm') {
      const toId = String(msg.to ?? '');
      if (!toId || msg.data === undefined) return;
      // DMs can be sent to peers or pending peers (for key wrapping)
      const target = room.peers.get(toId) || room.pendingRequests?.get(toId);
      if (target && target.ws.readyState === WebSocket.OPEN) {
        try {
          target.ws.send(JSON.stringify({ type: 'dm', from: deviceId, data: msg.data }));
        } catch {
          /* closed */
        }
      }
      return;
    }

    // Key rotation: owner broadcasts new wrapped key to all peers
    if (msg.type === 'rotate_key') {
      if (!room || room.ownerDeviceId !== deviceId) {
        reply({ type: 'error', message: 'Only the room owner can rotate the key.' });
        return;
      }
      if (!msg.data) return;
      // Broadcast the new wrapped key to all peers
      const rotationMsg = JSON.stringify({ type: 'key_rotated', from: deviceId, data: msg.data });
      for (const p of room.peers.values()) {
        if (p.ws.readyState === WebSocket.OPEN) {
          try {
            p.ws.send(rotationMsg);
          } catch {}
        }
      }
      reply({ type: 'ok', message: 'Key rotated and broadcast to all peers.' });
      return;
    }

    // Owner can kick a peer out of the room
    if (msg.type === 'kick') {
      const toId = String(msg.to ?? '');
      if (!room || room.ownerDeviceId !== deviceId) {
        reply({ type: 'error', message: 'Only the room owner can kick peers.' });
        return;
      }
      if (toId === deviceId) {
        reply({ type: 'error', message: 'You cannot kick yourself.' });
        return;
      }
      const target = room.peers.get(toId);
      if (!target) {
        reply({ type: 'error', message: 'Peer not found in room.' });
        return;
      }
      // Remove the peer and close their connection
      room.peers.delete(toId);
      try {
        target.ws.send(JSON.stringify({ type: 'kicked', message: 'You were removed from the room by the owner.' }));
        target.ws.close();
      } catch {
        /* ignore */
      }
      // Notify remaining peers
      room.lastActivityAt = Date.now();
      clipBroadcast(room, {
        type: 'peer_left',
        deviceId: toId,
        peerCount: room.peers.size,
        peers: clipPeerList(room),
      });
      reply({ type: 'ok', message: 'Peer removed from room.' });
      return;
    }

    // Owner can toggle whether the room accepts new join requests
    if (msg.type === 'toggle_accepts_joins') {
      if (!room || room.ownerDeviceId !== deviceId) {
        reply({ type: 'error', message: 'Only the room owner can change this setting.' });
        return;
      }
      room.acceptingNewJoins = !room.acceptingNewJoins;
      room.lastActivityAt = Date.now();
      // Notify all peers of the setting change
      const settingMsg = JSON.stringify({
        type: 'room_setting_changed',
        setting: 'acceptingNewJoins',
        value: room.acceptingNewJoins,
      });
      clipBroadcast(room, JSON.parse(settingMsg));
      reply({ type: 'ok', message: `Room now ${room.acceptingNewJoins ? 'accepting' : 'not accepting'} new join requests.` });
      return;
    }

    // Owner can rotate/regenerate the room display code (visual invite code)
    if (msg.type === 'rotate_room_code') {
      if (!room || room.ownerDeviceId !== deviceId) {
        reply({ type: 'error', message: 'Only the room owner can rotate the room code.' });
        return;
      }
      const oldCode = room.joinCode;
      let newCode = oldCode;
      for (let i = 0; i < 10 && newCode === oldCode; i += 1) {
        const candidate = generateClipJoinCode();
        if (!clipRoomByCode.has(candidate)) newCode = candidate;
      }
      if (newCode === oldCode) {
        reply({ type: 'error', message: 'Failed to rotate room code. Try again.' });
        return;
      }
      clipRoomByCode.delete(oldCode);
      room.joinCode = newCode;
      room.displayCode = newCode;
      clipRoomByCode.set(newCode, room.id);
      room.lastActivityAt = Date.now();
      // Notify all peers that the code has rotated
      const codeMsg = JSON.stringify({
        type: 'room_code_rotated',
        newCode: room.joinCode,
        roomCode: room.joinCode,
        message: 'Owner rotated the 6-character join code. Existing connections remain unchanged.',
      });
      clipBroadcast(room, JSON.parse(codeMsg));
      reply({ type: 'ok', message: `New room code: ${room.joinCode}` });
      return;
    }
  });

  const cleanup = () => {
    clearInterval(hb);
    clearInterval(msgReset);
    if (room) {
      // Remove from active peers if present
      const wasOwner = room.ownerDeviceId === deviceId;
      room.peers.delete(deviceId);

      // Remove if was pending
      if (room.pendingRequests && room.pendingRequests.has(deviceId)) {
        room.pendingRequests.delete(deviceId);
        clipNotifyOwnerPendingRemoved(room, deviceId, 'left');
      }

      room.lastActivityAt = Date.now();
      clipBroadcast(room, {
        type: 'peer_left',
        deviceId,
        deviceName,
        peerCount: room.peers.size,
        peers: clipPeerList(room),
      });

      // If the owner disconnected, clear owner and accept pending requests
      if (wasOwner) {
        room.ownerDeviceId = undefined;
        if (room.pendingRequests && room.pendingRequests.size > 0) {
          for (const [pid, p] of room.pendingRequests.entries()) {
            room.peers.set(pid, p);
            try {
              p.ws.send(
                JSON.stringify({ 
                  type: 'joined', 
                  deviceId: pid, 
                  roomId: room.id, 
                  roomCode: room.joinCode,
                  ownerDeviceId: room.ownerDeviceId,
                  displayCode: room.displayCode,
                  acceptingNewJoins: room.acceptingNewJoins,
                  peerCount: room.peers.size, 
                  peers: clipPeerList(room) 
                }),
              );
            } catch {}
          }
          room.pendingRequests.clear();
          clipBroadcast(room, { type: 'peer_joined', peerCount: room.peers.size, peers: clipPeerList(room) }, undefined);
        }
      }

      if (room.peers.size === 0) {
        const rid = room.id;
        setTimeout(() => {
          const r = clipRooms.get(rid);
          if (r?.peers.size === 0) {
            clipRoomByCode.delete(r.joinCode);
            clipRooms.delete(rid);
            for (const set of clipRoomsByIp.values()) {
              set.delete(rid);
            }
          }
        }, 60_000);
      }
    }
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

// ---- Graceful shutdown -------------------------------------------------------

let isShuttingDown = false;

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[shutdown] ${signal} — destroying all sessions...`);
  destroyAllSessions();
  server.close(() => {
    console.log('[shutdown] Closed. Exiting.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[shutdown] Forced exit.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => console.error('[uncaught]', err.message));
process.on('unhandledRejection', (r) => console.error('[unhandled rejection]', r));

// ---- Start -------------------------------------------------------------------

if (isDockerAvailable()) cleanupOrphanContainers();

server.listen(PORT, () => {
  const port = (server.address() as AddressInfo | null)?.port ?? PORT;
  console.log(`\nFairArena API    -> http://localhost:${port}`);
  console.log(`Terminal WS      -> ws://localhost:${port}/terminal`);
  console.log(`ClipSync WS      -> ws://localhost:${port}/clipsync`);
  console.log(
    `Docker           -> ${isDockerAvailable() ? 'available' : 'NOT FOUND (terminal disabled)'}`,
  );
  console.log(`Overload gate    -> >${overloadThreshold()}% CPU/RAM blocks new sessions`);
  console.log(`Kill threshold   -> >${killThreshold()}% CPU/RAM evicts all sessions`);
  console.log(
    `Max sessions     -> ${process.env.MAX_SESSIONS ?? 3} global / ${process.env.MAX_SESSIONS_PER_IP ?? 1} per IP`,
  );
  console.log(`Disable new sess -> ${DISABLE_NEW_SESSIONS ? 'YES' : 'no'}`);
  console.log(`Environment      -> ${NODE_ENV}\n`);
});
