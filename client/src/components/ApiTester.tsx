// Full Postman-like API tester
// Features: params, headers, auth (bearer/basic/apikey), body (json/text/form/xml),
// cURL import, request history (localStorage), webhook listener (SSE), server status.

import {
  useState, useCallback, useEffect, useRef, useId, useMemo,
} from 'react'
import {
  Plus, Trash2, Send, Copy, ChevronDown, CheckCircle2, XCircle,
  Clock, FileText, History, Webhook, Download, Upload, RefreshCw,
  Globe, Eye, EyeOff, Pencil,
} from 'lucide-react'
import type {
  ApiRequest, ApiResponse, HttpMethod, KeyValue, AuthConfig,
  BodyType, HistoryEntry, WebhookEvent,
} from '../types/index.js'

// ---- Constants ---------------------------------------------------------------

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT:     'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PATCH:   'bg-purple-500/15 text-purple-400 border-purple-500/30',
  DELETE:  'bg-red-500/15 text-red-400 border-red-500/30',
  HEAD:    'bg-slate-500/15 text-slate-400 border-slate-500/30',
  OPTIONS: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
}
const HTTP_METHODS: HttpMethod[] = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']
const BODY_TYPES: BodyType[] = ['none','json','text','form','xml']
const HISTORY_KEY = 'fa_request_history'
const MAX_HISTORY = 100

// Re-exported from useTerminalSession so both sides stay in sync.
const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

// ── Header name suggestions (Postman-style) ──────────────────────────────────
const COMMON_HEADERS = [
  'Accept', 'Accept-Encoding', 'Accept-Language', 'Authorization',
  'Cache-Control', 'Connection', 'Content-Encoding', 'Content-Length',
  'Content-Type', 'Cookie', 'DNT', 'Host', 'If-Modified-Since',
  'If-None-Match', 'Origin', 'Pragma', 'Referer', 'TE', 'Upgrade-Insecure-Requests',
  'User-Agent', 'X-Api-Key', 'X-Auth-Token', 'X-Forwarded-For', 'X-Forwarded-Host',
  'X-Request-ID', 'X-Requested-With', 'X-Trace-Id',
]

const COMMON_CONTENT_TYPES = [
  'application/json', 'application/x-www-form-urlencoded',
  'application/xml', 'application/octet-stream', 'application/pdf',
  'multipart/form-data', 'text/html', 'text/plain', 'text/xml',
]

// ── Postman Collection v2.1 converters ───────────────────────────────────────

type PostmanCollection = {
  info?: { name?: string; schema?: string }
  item?: unknown[]
}

function fromPostmanCollection(json: unknown): HistoryEntry[] {
  try {
    const col = json as PostmanCollection
    if (!Array.isArray(col.item)) return []

    const mapItem = (item: unknown): HistoryEntry | null => {
      const it = item as {
        name?: string; request?: unknown; item?: unknown[]
      }
      if (!it?.request) return null  // folder without request

      const req = it.request as {
        method?: string
        url?: { raw?: string; query?: { key: string; value: string; disabled?: boolean }[] } | string
        header?: { key: string; value: string; disabled?: boolean }[]
        body?: { mode?: string; raw?: string; urlencoded?: { key: string; value: string; disabled?: boolean }[] }
        auth?: {
          type?: string
          bearer?: { key: string; value: string }[]
          basic?:  { key: string; value: string }[]
          apikey?: { key: string; value: string }[]
        }
      }

      const rawUrl = typeof req.url === 'string' ? req.url : (req.url?.raw ?? '')
      const method = ((req.method ?? 'GET').toUpperCase()) as HttpMethod
      const headers: KeyValue[] = (req.header ?? []).map(
        (h) => ({ ...newKv(h.key, h.value), enabled: h.disabled !== true }),
      )
      const urlQueryParams: KeyValue[] = typeof req.url === 'object'
        ? (req.url?.query ?? []).map(
            (q) => ({ ...newKv(q.key, q.value), enabled: q.disabled !== true }),
          )
        : []

      let bodyType: BodyType = 'none'
      let body = ''
      let formData: KeyValue[] = []

      if (req.body?.mode === 'raw') {
        body = req.body.raw ?? ''
        const lang = (req.body as Record<string, unknown> & { options?: { raw?: { language?: string } } })
          ?.options?.raw?.language ?? ''
        if (lang === 'json') bodyType = 'json'
        else if (lang === 'xml') bodyType = 'xml'
        else bodyType = 'text'
        // Auto-detect if language hint absent
        if (!lang) { try { JSON.parse(body); bodyType = 'json' } catch { bodyType = 'text' } }
      } else if (req.body?.mode === 'urlencoded') {
        bodyType = 'form'
        formData = (req.body.urlencoded ?? []).map(
          (d) => ({ ...newKv(d.key, d.value), enabled: d.disabled !== true }),
        )
      }

      let auth: AuthConfig = { type: 'none' }
      if (req.auth?.type === 'bearer') {
        auth = { type: 'bearer', token: req.auth.bearer?.find((b) => b.key === 'token')?.value ?? '' }
      } else if (req.auth?.type === 'basic') {
        auth = {
          type: 'basic',
          username: req.auth.basic?.find((b) => b.key === 'username')?.value ?? '',
          password: req.auth.basic?.find((b) => b.key === 'password')?.value ?? '',
        }
      } else if (req.auth?.type === 'apikey') {
        auth = {
          type: 'apikey',
          apiKeyIn: (req.auth.apikey?.find((b) => b.key === 'in')?.value ?? 'header') as 'header' | 'query',
          apiKeyName:  req.auth.apikey?.find((b) => b.key === 'key')?.value ?? '',
          apiKeyValue: req.auth.apikey?.find((b) => b.key === 'value')?.value ?? '',
        }
      }

      return {
        id: crypto.randomUUID(),
        name: it.name ?? rawUrl,
        timestamp: Date.now(),
        request: {
          id: crypto.randomUUID(),
          name: it.name ?? rawUrl,
          url: rawUrl, method, params: urlQueryParams,
          headers, auth, bodyType, body, formData,
        },
        response: null,
      }
    }

    const flatten = (items: unknown[]): HistoryEntry[] =>
      items.flatMap((i) => {
        const it = i as { item?: unknown[] }
        if (Array.isArray(it.item)) return flatten(it.item)  // recurse folders
        const entry = mapItem(i)
        return entry ? [entry] : []
      })

    return flatten(col.item)
  } catch { return [] }
}

function toPostmanCollection(name: string, entries: HistoryEntry[]) {
  return {
    info: {
      name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: entries.map((e) => {
      const req = e.request

      let urlObj: unknown = req.url
      try {
        const u = new URL(req.url.includes('://') ? req.url : `https://${req.url}`)
        urlObj = {
          raw: req.url,
          protocol: u.protocol.replace(':', ''),
          host: u.hostname.split('.'),
          path: u.pathname.split('/').filter(Boolean),
          query: [
            ...u.searchParams.entries(),
            ...req.params.filter((p) => p.enabled && p.key).map((p) => [p.key, p.value] as [string, string]),
          ].map(([k, v]) => ({ key: k, value: v })),
        }
      } catch { /* keep raw string */ }

      const pmBody: unknown = (() => {
        if (req.bodyType === 'none') return undefined
        if (req.bodyType === 'form') return {
          mode: 'urlencoded',
          urlencoded: req.formData.map((d) => ({
            key: d.key, value: d.value, type: 'text', disabled: !d.enabled,
          })),
        }
        return {
          mode: 'raw',
          raw: req.body,
          options: { raw: { language: req.bodyType === 'json' ? 'json' : req.bodyType === 'xml' ? 'xml' : 'text' } },
        }
      })()

      const pmAuth: unknown = (() => {
        if (req.auth.type === 'none') return undefined
        if (req.auth.type === 'bearer') return {
          type: 'bearer',
          bearer: [{ key: 'token', value: req.auth.token ?? '', type: 'string' }],
        }
        if (req.auth.type === 'basic') return {
          type: 'basic',
          basic: [
            { key: 'username', value: req.auth.username ?? '', type: 'string' },
            { key: 'password', value: req.auth.password ?? '', type: 'string' },
          ],
        }
        if (req.auth.type === 'apikey') return {
          type: 'apikey',
          apikey: [
            { key: 'key',   value: req.auth.apiKeyName  ?? '', type: 'string' },
            { key: 'value', value: req.auth.apiKeyValue ?? '', type: 'string' },
            { key: 'in',    value: req.auth.apiKeyIn    ?? 'header', type: 'string' },
          ],
        }
      })()

      return {
        name: e.name,
        request: {
          method: req.method,
          header: req.headers.filter((h) => h.enabled && h.key).map((h) => ({ key: h.key, value: h.value })),
          url: urlObj,
          ...(pmAuth ? { auth: pmAuth } : {}),
          ...(pmBody ? { body: pmBody } : {}),
        },
        response: [],
      }
    }),
  }
}

function newKv(key = '', value = ''): KeyValue {
  return { id: crypto.randomUUID(), key, value, enabled: true }
}

function freshRequest(): ApiRequest {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Request',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    method: 'GET',
    params: [],
    headers: [newKv('Accept','application/json')],
    auth: { type: 'none' },
    bodyType: 'none',
    body: '',
    formData: [],
  }
}

// ---- Syntax highlight --------------------------------------------------------

function highlightJson(json: string): string {
  return json
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (m) => {
        let cls = 'json-num'
        if (/^"/.test(m)) cls = /:$/.test(m) ? 'json-key' : 'json-str'
        else if (/true|false/.test(m)) cls = 'json-bool'
        else if (/null/.test(m)) cls = 'json-null'
        return `<span class="${cls}">${m}</span>`
      },
    )
}

function statusColor(s: number) {
  if (s < 200) return 'text-slate-400'
  if (s < 300) return 'text-emerald-400'
  if (s < 400) return 'text-blue-400'
  if (s < 500) return 'text-amber-400'
  return 'text-red-400'
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n/1024).toFixed(1)} KB`
  return `${(n/1048576).toFixed(2)} MB`
}

function fmtDate(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
}

// ---- Build curl from request -------------------------------------------------

function buildCurl(req: ApiRequest): string {
  const parts = ['curl']
  if (req.method !== 'GET') parts.push(`-X ${req.method}`)

  const allHeaders: Record<string,string> = {}
  req.headers.filter((h) => h.enabled && h.key).forEach((h) => { allHeaders[h.key] = h.value })

  // Auth headers
  if (req.auth.type === 'bearer' && req.auth.token)
    allHeaders['Authorization'] = `Bearer ${req.auth.token}`
  if (req.auth.type === 'basic' && (req.auth.username || req.auth.password))
    allHeaders['Authorization'] = 'Basic ' + btoa(`${req.auth.username ?? ''}:${req.auth.password ?? ''}`)
  if (req.auth.type === 'apikey' && req.auth.apiKeyIn === 'header' && req.auth.apiKeyName)
    allHeaders[req.auth.apiKeyName] = req.auth.apiKeyValue ?? ''

  Object.entries(allHeaders).forEach(([k, v]) => parts.push(`-H "${k}: ${v}"`))

  if (req.bodyType !== 'none' && req.body && !['GET','HEAD'].includes(req.method))
    parts.push(`-d '${req.body.replace(/'/g,"\\'")}' `)

  // Build URL with params
  const url = buildUrl(req)
  parts.push(`"${url}"`)
  return parts.join(' \\\n  ')
}

function buildUrl(req: ApiRequest): string {
  const activeParams = req.params.filter((p) => p.enabled && p.key)
  if (activeParams.length === 0) return req.url

  // Merge with params already in URL
  try {
    const u = new URL(req.url.includes('://') ? req.url : `https://${req.url}`)
    activeParams.forEach((p) => u.searchParams.append(p.key, p.value))
    // Preserve original scheme if present
    return req.url.startsWith('http') ? u.toString() : u.toString().replace('https://', '')
  } catch {
    const qs = activeParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    return `${req.url}${req.url.includes('?') ? '&' : '?'}${qs}`
  }
}

function buildPayload(req: ApiRequest) {
  const headers: Record<string,string> = {}
  req.headers.filter((h) => h.enabled && h.key).forEach((h) => { headers[h.key] = h.value })

  if (req.auth.type === 'bearer' && req.auth.token)
    headers['Authorization'] = `Bearer ${req.auth.token}`
  if (req.auth.type === 'basic')
    headers['Authorization'] = 'Basic ' + btoa(`${req.auth.username ?? ''}:${req.auth.password ?? ''}`)
  if (req.auth.type === 'apikey' && req.auth.apiKeyIn === 'header' && req.auth.apiKeyName)
    headers[req.auth.apiKeyName] = req.auth.apiKeyValue ?? ''

  const params: Record<string,string> = {}
  if (req.auth.type === 'apikey' && req.auth.apiKeyIn === 'query' && req.auth.apiKeyName)
    params[req.auth.apiKeyName] = req.auth.apiKeyValue ?? ''

  if (req.bodyType === 'json') headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  if (req.bodyType === 'xml')  headers['Content-Type'] = headers['Content-Type'] ?? 'application/xml'
  if (req.bodyType === 'text') headers['Content-Type'] = headers['Content-Type'] ?? 'text/plain'
  if (req.bodyType === 'form') headers['Content-Type'] = headers['Content-Type'] ?? 'application/x-www-form-urlencoded'

  let body: string | undefined
  if (req.bodyType === 'form' && req.formData.length > 0) {
    body = req.formData.filter((r) => r.enabled && r.key)
      .map((r) => `${encodeURIComponent(r.key)}=${encodeURIComponent(r.value)}`).join('&')
  } else if (req.bodyType !== 'none' && req.body) {
    body = req.body
  }

  return { headers, body, params }
}

// ---- localStorage history ----------------------------------------------------

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') }
  catch { return [] }
}
function saveHistory(h: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-MAX_HISTORY))) } catch {}
}

// ---- Shared components -------------------------------------------------------

function KVEditor({
  rows, label, onChange,
  placeholderKey = 'Key', placeholderVal = 'Value',
  keySuggestions, valueSuggestions,
}: {
  rows: KeyValue[]; label: string; onChange: (r: KeyValue[]) => void
  placeholderKey?: string; placeholderVal?: string
  keySuggestions?: string[]; valueSuggestions?: string[]
}) {
  const uid = useId()
  const keyListId  = keySuggestions  ? `${uid}-ksugg` : undefined
  const valListId  = valueSuggestions ? `${uid}-vsugg` : undefined

  const update = (id: string, f: keyof KeyValue, v: string | boolean) =>
    onChange(rows.map((r) => r.id === id ? { ...r, [f]: v } : r))
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id))
  const add = () => onChange([...rows, newKv()])

  // Dynamic value suggestions: if current key is Content-Type / Accept, offer MIME types
  const getValSuggestions = (key: string) => {
    const k = key.toLowerCase()
    if (k === 'content-type' || k === 'accept') return COMMON_CONTENT_TYPES
    if (k === 'authorization') return ['Bearer ', 'Basic ', 'Digest ', 'AWS4-HMAC-SHA256 ']
    if (k === 'cache-control') return ['no-cache', 'no-store', 'max-age=0', 'public', 'private']
    return valueSuggestions
  }

  return (
    <div>
      {keySuggestions && keyListId && (
        <datalist id={keyListId}>
          {keySuggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <button onClick={add} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
          <Plus className="w-3 h-3" />Add
        </button>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => {
          const dynValSugg = getValSuggestions(row.key)
          const dynValListId = dynValSugg ? `${uid}-vd-${row.id}` : valListId
          return (
            <div key={row.id} className="flex items-center gap-1.5 group">
              <input type="checkbox" checked={row.enabled}
                onChange={(e) => update(row.id,'enabled',e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-brand-500 shrink-0"
                aria-label={`Enable ${label} row ${i+1}`} />
              <input value={row.key} onChange={(e) => update(row.id,'key',e.target.value)}
                list={keyListId}
                placeholder={placeholderKey}
                aria-label={`${label} key ${i+1}`}
                className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60 font-mono" />
              {dynValSugg && <datalist id={dynValListId}>{dynValSugg.map((s) => <option key={s} value={s} />)}</datalist>}
              <input value={row.value} onChange={(e) => update(row.id,'value',e.target.value)}
                list={dynValListId}
                placeholder={placeholderVal}
                aria-label={`${label} value ${i+1}`}
                className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60 font-mono" />
              <button onClick={() => remove(row.id)}
                className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                aria-label="Remove row"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )
        })}
        {rows.length === 0 && (
          <p className="text-xs text-slate-600 py-2 text-center">No {label.toLowerCase()} — click Add</p>
        )}
      </div>
    </div>
  )
}

function Tab({ label, active, onClick, badge }: { label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
        active ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-300'
      }`}>
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] bg-brand-500/20 text-brand-400 rounded-full leading-none">{badge}</span>
      )}
    </button>
  )
}

// ---- Auth panel --------------------------------------------------------------

function AuthPanel({ auth, onChange }: { auth: AuthConfig; onChange: (a: AuthConfig) => void }) {
  const [showPw, setShowPw] = useState(false)
  const set = <K extends keyof AuthConfig>(k: K, v: AuthConfig[K]) => onChange({ ...auth, [k]: v })

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Auth Type</label>
        <div className="flex flex-wrap gap-2">
          {(['none','bearer','basic','apikey'] as const).map((t) => (
            <button key={t} onClick={() => set('type', t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                auth.type === t
                  ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                  : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
              }`}>
              {t === 'none' ? 'No Auth' : t === 'bearer' ? 'Bearer Token' : t === 'basic' ? 'Basic Auth' : 'API Key'}
            </button>
          ))}
        </div>
      </div>

      {auth.type === 'bearer' && (
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Token</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={auth.token ?? ''}
              onChange={(e) => set('token', e.target.value)}
              placeholder="eyJhbGci..."
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 pr-10 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500/60" />
            <button onClick={() => setShowPw(!showPw)}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Username</label>
            <input value={auth.username ?? ''} onChange={(e) => set('username', e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-brand-500/60" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={auth.password ?? ''}
                onChange={(e) => set('password', e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 pr-10 text-sm text-slate-200 font-mono focus:outline-none focus:border-brand-500/60" />
              <button onClick={() => setShowPw(!showPw)}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {auth.type === 'apikey' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Key name</label>
              <input value={auth.apiKeyName ?? ''} onChange={(e) => set('apiKeyName', e.target.value)}
                placeholder="X-API-Key"
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-brand-500/60" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Value</label>
              <input type={showPw ? 'text' : 'password'} value={auth.apiKeyValue ?? ''}
                onChange={(e) => set('apiKeyValue', e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-brand-500/60" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Add to</label>
            <div className="flex gap-2">
              {(['header','query'] as const).map((loc) => (
                <button key={loc} onClick={() => set('apiKeyIn', loc)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    auth.apiKeyIn === loc
                      ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                      : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
                  }`}>
                  {loc === 'header' ? 'Header' : 'Query Param'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setShowPw(!showPw)}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
            {showPw ? <><EyeOff className="w-3 h-3" />Hide value</> : <><Eye className="w-3 h-3" />Show value</>}
          </button>
        </div>
      )}

      {auth.type === 'none' && (
        <p className="text-xs text-slate-600 py-2">No authentication will be added to this request.</p>
      )}
    </div>
  )
}

// ---- Body panel --------------------------------------------------------------

function BodyPanel({ bodyType, body, formData, onChange }: {
  bodyType: BodyType; body: string; formData: KeyValue[]
  onChange: (b: Partial<{ bodyType: BodyType; body: string; formData: KeyValue[] }>) => void
}) {
  const placeholder: Record<BodyType, string> = {
    none: '', json: '{\n  "key": "value"\n}', text: 'Request body...',
    form: '', xml: '<?xml version="1.0"?>\n<root>\n  <key>value</key>\n</root>',
    binary: '',
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {BODY_TYPES.map((bt) => (
          <button key={bt} onClick={() => onChange({ bodyType: bt })}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              bodyType === bt
                ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
            }`}>
            {bt === 'none' ? 'None' : bt.toUpperCase()}
          </button>
        ))}
      </div>

      {bodyType === 'form' && (
        <KVEditor rows={formData} label="Form Fields"
          onChange={(rows) => onChange({ formData: rows })} placeholderKey="field" placeholderVal="value" />
      )}

      {bodyType !== 'none' && bodyType !== 'form' && (
        <textarea value={body} onChange={(e) => onChange({ body: e.target.value })}
          placeholder={placeholder[bodyType]}
          rows={10} spellCheck={false}
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500/60 resize-none" />
      )}

      {bodyType === 'none' && (
        <p className="text-xs text-slate-600 py-2 text-center">No body will be sent with this request.</p>
      )}
    </div>
  )
}

// ---- cURL Import panel -------------------------------------------------------

function CurlImportPanel({ onImport }: { onImport: (parsed: Partial<ApiRequest>) => void }) {
  const [cmd, setCmd] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const parse = async () => {
    setErr(null)
    try {
      const res = await fetch(API_BASE + '/api/curl/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd }),
      })
      const data = await res.json() as { error?: string; url?: string; method?: string; headers?: Record<string,string>; body?: string }
      if (!res.ok || data.error) { setErr(data.error ?? 'Parse failed'); return }

      const headers: KeyValue[] = Object.entries(data.headers ?? {}).map(([k,v]) => newKv(k, v))
      onImport({
        url: data.url ?? '',
        method: (data.method ?? 'GET') as HttpMethod,
        headers,
        bodyType: data.body ? 'json' : 'none',
        body: data.body ?? '',
      })
      setCmd('')
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Paste a cURL command and import it into the request builder.</p>
      <textarea value={cmd} onChange={(e) => setCmd(e.target.value)}
        placeholder={'curl -X POST https://api.example.com/endpoint \\\n  -H "Content-Type: application/json" \\\n  -d \'{"key": "value"}\''}
        rows={8} spellCheck={false}
        className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500/60 resize-none" />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button onClick={parse} disabled={!cmd.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all">
        <Download className="w-4 h-4" />Import cURL
      </button>
    </div>
  )
}

// ---- Webhook panel -----------------------------------------------------------

function WebhookPanel() {
  const [webhookId, setWebhookId] = useState<string | null>(null)
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [copied, setCopied] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const webhookUrl = webhookId
    ? `${API_BASE || window.location.origin}/api/webhook/${webhookId}/incoming`
    : null

  const create = async () => {
    setLoading(true)
    try {
      const res = await fetch(API_BASE + '/api/webhook/create', { method: 'POST' })
      const data = await res.json() as { id: string }
      setWebhookId(data.id)
      setEvents([])
      setSelectedEvent(null)
    } catch {} finally { setLoading(false) }
  }

  const destroy = async () => {
    if (!webhookId) return
    esRef.current?.close()
    esRef.current = null
    await fetch(`${API_BASE}/api/webhook/${webhookId}`, { method: 'DELETE' }).catch(() => {})
    setWebhookId(null); setEvents([]); setSelectedEvent(null)
  }

  useEffect(() => {
    if (!webhookId) { esRef.current?.close(); esRef.current = null; return }
    const es = new EventSource(API_BASE + `/api/webhook/${webhookId}/listen`)
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const { event } = JSON.parse(e.data) as { event: WebhookEvent }
        setEvents((prev) => [...prev, event])
      } catch {}
    }
    return () => { es.close(); esRef.current = null }
  }, [webhookId])

  const copy = async () => {
    if (!webhookUrl) return
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4 h-full">
      {!webhookId ? (
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <Webhook className="w-12 h-12 text-slate-700" />
          <div className="text-center">
            <p className="text-sm text-slate-400 font-medium mb-1">Webhook Tester</p>
            <p className="text-xs text-slate-600 max-w-xs">
              Generate a unique URL and start receiving HTTP requests in real-time. Perfect for testing webhooks.
            </p>
          </div>
          <button onClick={create} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate Webhook URL
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* URL bar */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-400">Your webhook URL</span>
              <span className="text-xs px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded font-mono">LIVE</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-brand-300 bg-slate-900/60 rounded-lg px-3 py-2 break-all">{webhookUrl}</code>
              <button onClick={copy}
                className={`shrink-0 p-2 rounded-lg transition-colors ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                title="Copy URL"><Copy className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-600 mt-2">Send any HTTP request to this URL. It expires in 1 hour.</p>
          </div>

          {/* Event list */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Incoming requests ({events.length})
            </span>
            <div className="flex gap-2">
              <button onClick={() => setEvents([])}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                <Trash2 className="w-3 h-3" />Clear
              </button>
              <button onClick={destroy}
                className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1">
                <XCircle className="w-3 h-3" />Delete
              </button>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-600 gap-2">
              <Globe className="w-8 h-8 opacity-30" />
              <p className="text-xs">Waiting for requests...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-hidden">
              <div className="overflow-y-auto space-y-1.5">
                {[...events].reverse().map((ev) => (
                  <button key={ev.id} onClick={() => setSelectedEvent(ev)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                      selectedEvent?.id === ev.id
                        ? 'bg-brand-500/10 border-brand-500/40'
                        : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600'
                    }`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold font-mono ${
                        ev.method === 'GET' ? 'text-emerald-400' : ev.method === 'POST' ? 'text-blue-400' : 'text-amber-400'
                      }`}>{ev.method}</span>
                      <span className="text-xs text-slate-500">{fmtDate(ev.receivedAt)}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {ev.headers['content-type'] ?? 'No content-type'}
                    </p>
                  </button>
                ))}
              </div>
              {selectedEvent && (
                <div className="overflow-y-auto bg-slate-900/60 border border-slate-700/40 rounded-xl p-3">
                  <p className="text-xs font-medium text-slate-400 mb-2">
                    {selectedEvent.method} — {new Date(selectedEvent.receivedAt).toLocaleTimeString()}
                  </p>
                  {Object.keys(selectedEvent.query).length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] uppercase text-slate-600 mb-1">Query</p>
                      {Object.entries(selectedEvent.query).map(([k,v]) => (
                        <div key={k} className="text-xs font-mono"><span className="text-brand-300">{k}</span>: {v}</div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] uppercase text-slate-600 mb-1">Body</p>
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
                    {typeof selectedEvent.body === 'object'
                      ? JSON.stringify(selectedEvent.body, null, 2)
                      : String(selectedEvent.bodyRaw || '(empty)')}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Response viewer ---------------------------------------------------------

type RespTab = 'body' | 'headers' | 'raw' | 'curl'

function ResponseViewer({ response, curlCmd }: { response: ApiResponse; curlCmd: string }) {
  const [tab, setTab] = useState<RespTab>('body')
  const [copied, setCopied] = useState(false)

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const prettyBody = typeof response.body === 'object' && response.body !== null
    ? JSON.stringify(response.body, null, 2)
    : String(response.bodyRaw ?? response.body ?? '')

  const downloadBody = () => {
    const blob = new Blob([prettyBody], { type: response.contentType || 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'response'
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className={`flex items-center gap-1.5 font-bold text-lg font-mono ${statusColor(response.status)}`}>
          {response.ok ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {response.status}
          <span className="text-sm font-normal text-slate-400">{response.statusText}</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3 h-3" />{response.elapsed} ms
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <FileText className="w-3 h-3" />{fmtBytes(response.size)}
        </span>
        {response.redirected && response.finalUrl && (
          <span className="text-xs text-amber-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />Redirected
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={downloadBody}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <Download className="w-3.5 h-3.5" />Save
          </button>
          <button onClick={() => copy(prettyBody)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <Copy className={`w-3.5 h-3.5 ${copied ? 'text-green-400' : ''}`} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-3 border-b border-slate-700/40">
        {(['body','headers','raw','curl'] as RespTab[]).map((t) => (
          <Tab key={t} label={t === 'curl' ? 'cURL' : t.charAt(0).toUpperCase()+t.slice(1)}
            active={tab === t} onClick={() => setTab(t)}
            badge={t === 'headers' ? Object.keys(response.headers).length : undefined} />
        ))}
      </div>

      <div className="flex-1 overflow-auto min-h-0 rounded-xl bg-slate-900/70 border border-slate-700/40">
        {tab === 'body' && (
          <pre className="p-4 text-xs font-mono leading-relaxed overflow-auto whitespace-pre-wrap break-all"
            dangerouslySetInnerHTML={{ __html: highlightJson(prettyBody) }} />
        )}
        {tab === 'headers' && (
          <div className="divide-y divide-slate-800">
            {Object.entries(response.headers).map(([k,v]) => (
              <div key={k} className="flex gap-4 px-4 py-2 hover:bg-slate-800/40 transition-colors">
                <span className="text-xs font-mono text-brand-300 w-48 shrink-0 truncate">{k}</span>
                <span className="text-xs font-mono text-slate-300 break-all">{v}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'raw' && (
          <pre className="p-4 text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
            {response.bodyRaw}
          </pre>
        )}
        {tab === 'curl' && (
          <pre className="p-4 text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
            {curlCmd}
          </pre>
        )}
      </div>
    </div>
  )
}

// ---- History sidebar ---------------------------------------------------------

function HistorySidebar({
  history, onSelect, onClear, onClose, onDelete, onRename,
}: {
  history: HistoryEntry[]; onSelect: (e: HistoryEntry) => void
  onClear: () => void; onClose: () => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}) {
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const filtered = history.filter(
    (e) => e.name.toLowerCase().includes(search.toLowerCase()) ||
           e.request.url.toLowerCase().includes(search.toLowerCase()),
  ).slice().reverse()

  const commitRename = () => {
    if (editingId && editingName.trim()) onRename(editingId, editingName.trim())
    setEditingId(null)
    setEditingName('')
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border-r border-slate-700/50 w-72 shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <span className="text-sm font-semibold text-slate-200">History</span>
        <div className="flex gap-2">
          <button onClick={onClear} className="text-xs text-slate-500 hover:text-red-400" title="Clear all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="px-3 py-2 border-b border-slate-700/40">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search history..."
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-8">No history yet</p>
        ) : (
          filtered.map((e) => (
            <div key={e.id} className="border-b border-slate-700/20 group">
              {editingId === e.id ? (
                /* ── Inline rename input ── */
                <div className="px-4 py-2 flex items-center gap-2">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(ev) => setEditingName(ev.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') commitRename()
                      if (ev.key === 'Escape') { setEditingId(null); setEditingName('') }
                    }}
                    className="flex-1 bg-slate-800 border border-brand-500/60 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              ) : (
                /* ── Normal item ── */
                <div className="flex items-stretch">
                  <button onClick={() => onSelect(e)}
                    className="flex-1 text-left px-4 py-3 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded border ${METHOD_COLORS[e.request.method]}`}>
                        {e.request.method}
                      </span>
                      <span className="text-xs text-slate-500">{fmtDate(e.timestamp)}</span>
                      {e.response && (
                        <span className={`text-xs font-mono ml-auto ${statusColor(e.response.status)}`}>
                          {e.response.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{e.request.url}</p>
                    <p className="text-[10px] text-slate-600 truncate mt-0.5">{e.name}</p>
                  </button>
                  {/* Per-item actions (visible on hover) */}
                  <div className="flex flex-col justify-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingId(e.id); setEditingName(e.name) }}
                      className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDelete(e.id)}
                      className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---- Main Component ----------------------------------------------------------

type ReqTab = 'params' | 'headers' | 'auth' | 'body' | 'curl' | 'webhook'

export function ApiTester() {
  const [request, setRequest] = useState<ApiRequest>(freshRequest)
  const [activeTab, setActiveTab]   = useState<ReqTab>('params')
  const [response, setResponse]     = useState<ApiResponse | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showMethod, setShowMethod] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory]       = useState<HistoryEntry[]>(loadHistory)
  const [requestName, setRequestName] = useState('Untitled Request')

  const setField = useCallback(<K extends keyof ApiRequest>(k: K, v: ApiRequest[K]) =>
    setRequest((prev) => ({ ...prev, [k]: v })), [])

  const curlPreview = useMemo(() => buildCurl(request), [request])

  const handleSend = async () => {
    if (!request.url.trim()) return
    setLoading(true); setError(null)

    try {
      const { headers, body, params } = buildPayload(request)

      // Merge auth query params into URL
      let url = buildUrl(request)
      if (Object.keys(params).length > 0) {
        try {
          const u = new URL(url.includes('://') ? url : `https://${url}`)
          Object.entries(params).forEach(([k,v]) => u.searchParams.append(k,v))
          url = u.toString()
        } catch {}
      }

      const res = await fetch(API_BASE + '/api/request/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method: request.method, headers, body }),
      })
      const data = await res.json() as ApiResponse & { error?: string }

      if (!res.ok && data.error) {
        setError(data.error)
      } else {
        setResponse(data)
        // Save to history
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          name: requestName,
          timestamp: Date.now(),
          request: { ...request, id: crypto.randomUUID() },
          response: data,
        }
        const newHistory = [...history, entry]
        setHistory(newHistory)
        saveHistory(newHistory)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleImportCurl = (parsed: Partial<ApiRequest>) => {
    setRequest((prev) => ({ ...prev, ...parsed }))
    setActiveTab('headers')
  }

  const handleSelectHistory = (e: HistoryEntry) => {
    setRequest(e.request)
    setResponse(e.response)
    setRequestName(e.name)
    setShowHistory(false)
  }

  const handleClearHistory = () => {
    setHistory([]); saveHistory([])
  }

  const handleDeleteHistory = (id: string) => {
    const next = history.filter((e) => e.id !== id)
    setHistory(next); saveHistory(next)
  }

  const handleRenameHistory = (id: string, name: string) => {
    const next = history.map((e) => e.id === id ? { ...e, name } : e)
    setHistory(next); saveHistory(next)
  }

  // ── Collection import / export ──────────────────────────────────────────────
  const importFileRef = useRef<HTMLInputElement>(null)

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as unknown
        let imported: HistoryEntry[]
        // Postman collection v2.1
        if (
          json &&
          typeof json === 'object' &&
          'info' in (json as object) &&
          ((json as { info?: { schema?: string } }).info?.schema ?? '').includes('getpostman.com')
        ) {
          imported = fromPostmanCollection(json)
        } else if (Array.isArray(json)) {
          // Native history backup
          imported = (json as HistoryEntry[]).filter((x) => !!x?.id && !!x?.request)
        } else {
          return
        }
        if (imported.length === 0) return
        // Stamp fresh IDs so imported entries never collide with existing history
        const stamped = imported.map((x) => ({ ...x, id: crypto.randomUUID(), timestamp: x.timestamp || Date.now() }))
        const merged = [...history, ...stamped].slice(-MAX_HISTORY)
        setHistory(merged); saveHistory(merged)
      } catch { /* malformed file — silently ignore */ }
    }
    reader.readAsText(file)
    e.target.value = ''   // allow re-importing same file
  }

  const handleExportCollection = () => {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const colName = `FairArena Collection — ${dateStr}`
    const col = toPostmanCollection(colName, history)
    const blob = new Blob([JSON.stringify(col, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `faircollection-${Date.now()}.postman_collection.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const urlSuggestions = useMemo(
    () => [...new Set(history.map((e) => e.request.url))].slice(-30).reverse(),
    [history],
  )

  const activeParamsCount = request.params.filter((p) => p.enabled && p.key).length
  const activeHeadersCount = request.headers.filter((h) => h.enabled && h.key).length

  return (
    <div className="flex h-full min-h-0 gap-0 animate-fade-in">
      {/* History sidebar */}
      {showHistory && (
        <HistorySidebar
          history={history}
          onSelect={handleSelectHistory}
          onClear={handleClearHistory}
          onClose={() => setShowHistory(false)}
          onDelete={handleDeleteHistory}
          onRename={handleRenameHistory}
        />
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 gap-3 h-full">
        {/* Top bar: history + name + URL */}
        <div className="flex items-center gap-2">
          {/* Hidden file input for collection import */}
          <input
            ref={importFileRef}
            type="file"
            accept=".json,.postman_collection.json"
            className="hidden"
            onChange={handleImportFile}
          />

          <button onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-xl border transition-all shrink-0 ${
              showHistory
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
            }`}
            title="Request history" aria-label="Toggle history">
            <History className="w-4 h-4" />
          </button>

          {/* Import Postman collection */}
          <button
            onClick={() => importFileRef.current?.click()}
            className="p-2 rounded-xl border bg-slate-900/60 border-slate-700/50 text-slate-400 hover:text-slate-200 transition-all shrink-0"
            title="Import Postman collection (.json)">
            <Upload className="w-4 h-4" />
          </button>

          {/* Export collection */}
          <button
            onClick={handleExportCollection}
            disabled={history.length === 0}
            className="p-2 rounded-xl border bg-slate-900/60 border-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
            title={history.length === 0 ? 'No history to export' : `Export ${history.length} request${history.length !== 1 ? 's' : ''} as Postman collection`}>
            <Download className="w-4 h-4" />
          </button>

          <div className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-2xl p-3">
            {/* Request name */}
            <input value={requestName} onChange={(e) => setRequestName(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-500 hover:text-slate-300 focus:text-slate-200 focus:outline-none mb-2 transition-colors"
              placeholder="Request name..." />

            {/* URL bar */}
            <div className="flex items-center gap-2">
              {/* Method selector */}
              <div className="relative shrink-0">
                <button onClick={() => setShowMethod(!showMethod)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold font-mono transition-all ${METHOD_COLORS[request.method]}`}>
                  {request.method}<ChevronDown className="w-3 h-3" />
                </button>
                {showMethod && (
                  <div className="absolute top-full mt-1 left-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1 min-w-[110px]">
                    {HTTP_METHODS.map((m) => (
                      <button key={m} onClick={() => { setField('method', m); setShowMethod(false) }}
                        className={`w-full text-left px-3 py-1.5 text-sm font-bold font-mono hover:bg-slate-800 transition-colors ${request.method === m ? 'text-white' : 'text-slate-400'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* URL input + autocomplete suggestions from history */}
              <datalist id="fa-url-suggestions">
                {urlSuggestions.map((url) => <option key={url} value={url} />)}
              </datalist>
              <input type="text" list="fa-url-suggestions" value={request.url}
                onChange={(e) => setField('url', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="https://api.example.com/v1/endpoint"
                className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors" />

              {/* Send button */}
              <button onClick={handleSend} disabled={loading || !request.url.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/20 shrink-0">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Request + Response panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
          {/* LEFT: Request builder */}
          <div className="flex flex-col bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 min-h-0">
            <div className="flex gap-0 mb-4 border-b border-slate-700/40 flex-wrap">
              <Tab label="Params" active={activeTab==='params'} onClick={() => setActiveTab('params')} badge={activeParamsCount} />
              <Tab label="Headers" active={activeTab==='headers'} onClick={() => setActiveTab('headers')} badge={activeHeadersCount} />
              <Tab label="Auth" active={activeTab==='auth'} onClick={() => setActiveTab('auth')}
                badge={request.auth.type !== 'none' ? 1 : 0} />
              <Tab label="Body" active={activeTab==='body'} onClick={() => setActiveTab('body')}
                badge={request.bodyType !== 'none' ? 1 : 0} />
              <Tab label="cURL" active={activeTab==='curl'} onClick={() => setActiveTab('curl')} />
              <Tab label="Webhook" active={activeTab==='webhook'} onClick={() => setActiveTab('webhook')} />
            </div>

            <div className="flex-1 overflow-auto min-h-0">
              {activeTab === 'params' && (
                <KVEditor label="Query Parameters" rows={request.params}
                  onChange={(rows) => setField('params', rows)}
                  placeholderKey="param" placeholderVal="value" />
              )}
              {activeTab === 'headers' && (
                <KVEditor label="Request Headers" rows={request.headers}
                  onChange={(rows) => setField('headers', rows)}
                  keySuggestions={COMMON_HEADERS}
                  placeholderKey="Header name"
                  placeholderVal="Value" />
              )}
              {activeTab === 'auth' && (
                <AuthPanel auth={request.auth} onChange={(a) => setField('auth', a)} />
              )}
              {activeTab === 'body' && (
                <BodyPanel bodyType={request.bodyType} body={request.body} formData={request.formData}
                  onChange={(b) => setRequest((prev) => ({ ...prev, ...b }))} />
              )}
              {activeTab === 'curl' && (
                <div className="space-y-4">
                  <div className="relative">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">cURL Preview</p>
                    <pre className="p-3 bg-slate-800/60 rounded-xl text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
                      {curlPreview}
                    </pre>
                    <button onClick={() => navigator.clipboard.writeText(curlPreview)}
                      className="absolute top-8 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                      title="Copy">
                      <Copy className="w-3.5 h-3.5 text-slate-300" />
                    </button>
                  </div>
                  <div className="border-t border-slate-700/40 pt-4">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Import from cURL</p>
                    <CurlImportPanel onImport={handleImportCurl} />
                  </div>
                </div>
              )}
              {activeTab === 'webhook' && <WebhookPanel />}
            </div>
          </div>

          {/* RIGHT: Response */}
          <div className="flex flex-col bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 min-h-0">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3 shrink-0">Response</h2>

            {error && (
              <div className="mb-3 flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl shrink-0">
                <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {!response && !loading && !error && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
                <Send className="w-10 h-10 opacity-20" />
                <p className="text-sm">Hit Send to see the response</p>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex items-center justify-center gap-3 text-slate-500">
                <span className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                <span className="text-sm">Waiting for response...</span>
              </div>
            )}

            {response && !loading && (
              <div className="flex-1 min-h-0">
                <ResponseViewer response={response} curlCmd={curlPreview} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
