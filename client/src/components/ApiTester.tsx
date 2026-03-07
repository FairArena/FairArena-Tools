import { useState, useCallback, useId } from 'react'
import {
  Plus, Trash2, Send, Copy, ChevronDown,
  CheckCircle2, XCircle, Clock, FileText,
} from 'lucide-react'
import type { ApiRequest, ApiResponse, HttpMethod, KeyValue } from '../types/index.js'

// ─── Method badge colours ─────────────────────────────────────────────────────
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT:     'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PATCH:   'bg-purple-500/15 text-purple-400 border-purple-500/30',
  DELETE:  'bg-red-500/15 text-red-400 border-red-500/30',
  HEAD:    'bg-slate-500/15 text-slate-400 border-slate-500/30',
  OPTIONS: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

function newKv(key = '', value = ''): KeyValue {
  return { id: crypto.randomUUID(), key, value, enabled: true }
}

const DEFAULT_REQUEST: ApiRequest = {
  url: 'https://jsonplaceholder.typicode.com/posts/1',
  method: 'GET',
  headers: [newKv('Accept', 'application/json')],
  body: '',
  contentType: 'json',
}

// ─── Syntax-highlight a JSON string ──────────────────────────────────────────
function highlightJson(json: string): string {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'json-num'
        if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-str'
        else if (/true|false/.test(match)) cls = 'json-bool'
        else if (/null/.test(match)) cls = 'json-null'
        return `<span class="${cls}">${match}</span>`
      },
    )
}

function statusColor(status: number): string {
  if (status < 200) return 'text-slate-400'
  if (status < 300) return 'text-emerald-400'
  if (status < 400) return 'text-blue-400'
  if (status < 500) return 'text-amber-400'
  return 'text-red-400'
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(1)} KB`
}

function buildCurlCommand(req: ApiRequest): string {
  const parts = ['curl']
  if (req.method !== 'GET') parts.push(`-X ${req.method}`)
  req.headers
    .filter((h) => h.enabled && h.key)
    .forEach((h) => parts.push(`-H "${h.key}: ${h.value}"`))
  if (req.body && !['GET', 'HEAD'].includes(req.method)) {
    parts.push(`-d '${req.body.replace(/'/g, "\\'")}'`)
  }
  parts.push(`"${req.url}"`)
  return parts.join(' \\\n  ')
}

// ─── Key-value editor ─────────────────────────────────────────────────────────
function KVEditor({
  rows, label, onChange,
}: {
  rows: KeyValue[]
  label: string
  onChange: (rows: KeyValue[]) => void
}) {
  const uid = useId()

  const update = (id: string, field: keyof KeyValue, val: string | boolean) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }

  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id))
  const add    = ()            => onChange([...rows, newKv()])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <button
          onClick={add}
          className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          <Plus className="w-3 h-3" />Add
        </button>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-1.5 group">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => update(row.id, 'enabled', e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-brand-500 shrink-0"
              aria-label={`Enable row ${i + 1}`}
            />
            <input
              value={row.key}
              onChange={(e) => update(row.id, 'key', e.target.value)}
              placeholder="Key"
              aria-label={`Header key ${i + 1}`}
              className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60 font-mono"
            />
            <input
              value={row.value}
              onChange={(e) => update(row.id, 'value', e.target.value)}
              placeholder="Value"
              aria-label={`Header value ${i + 1}`}
              className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60 font-mono"
            />
            <button
              onClick={() => remove(row.id)}
              className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              aria-label="Remove row"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-xs text-slate-600 py-2 text-center">
            No {label.toLowerCase()} — click Add above
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Body tab ─────────────────────────────────────────────────────────────────
type BodyTab = 'none' | 'json' | 'text' | 'form'

// ─── Response viewer ──────────────────────────────────────────────────────────
type RespTab = 'body' | 'headers' | 'raw' | 'curl'

function ResponseViewer({ response, curlCmd }: { response: ApiResponse; curlCmd: string }) {
  const [tab, setTab] = useState<RespTab>('body')
  const [copied, setCopied] = useState(false)

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const prettyBody =
    typeof response.body === 'object' && response.body !== null
      ? JSON.stringify(response.body, null, 2)
      : String(response.bodyRaw ?? response.body ?? '')

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Status row */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className={`flex items-center gap-1.5 font-bold text-lg font-mono ${statusColor(response.status)}`}>
          {response.ok
            ? <CheckCircle2 className="w-5 h-5" />
            : <XCircle className="w-5 h-5" />}
          {response.status}
          <span className="text-sm font-normal text-slate-400">{response.statusText}</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3 h-3" />{response.elapsed} ms
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <FileText className="w-3 h-3" />{formatBytes(response.size)}
        </span>
        <button
          onClick={() => copy(prettyBody)}
          className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Copy className={`w-3.5 h-3.5 ${copied ? 'text-green-400' : ''}`} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 border-b border-slate-700/40 pb-0">
        {(['body', 'headers', 'raw', 'curl'] as RespTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'curl' ? 'cURL' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0 rounded-xl bg-slate-900/70 border border-slate-700/40">
        {tab === 'body' && (
          <pre
            className="p-4 text-xs font-mono leading-relaxed overflow-auto whitespace-pre-wrap break-all"
            dangerouslySetInnerHTML={{ __html: highlightJson(prettyBody) }}
          />
        )}
        {tab === 'headers' && (
          <div className="divide-y divide-slate-800">
            {Object.entries(response.headers).map(([k, v]) => (
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

// ─── Main component ───────────────────────────────────────────────────────────
export function ApiTester() {
  const [request, setRequest]     = useState<ApiRequest>(DEFAULT_REQUEST)
  const [bodyTab, setBodyTab]     = useState<BodyTab>('none')
  const [response, setResponse]   = useState<ApiResponse | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showMethod, setShowMethod] = useState(false)
  const [activeReqTab, setActiveReqTab] = useState<'headers' | 'body' | 'curl'>('headers')

  const setField = useCallback(<K extends keyof ApiRequest>(key: K, val: ApiRequest[K]) => {
    setRequest((prev) => ({ ...prev, [key]: val }))
  }, [])

  const curlPreview = buildCurlCommand(request)

  const handleSend = async () => {
    if (!request.url.trim()) return
    setLoading(true)
    setError(null)

    try {
      const headers: Record<string, string> = {}
      request.headers
        .filter((h) => h.enabled && h.key)
        .forEach((h) => { headers[h.key] = h.value })

      if (bodyTab === 'json' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      }

      const res = await fetch('/api/request/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: request.url,
          method: request.method,
          headers,
          body: bodyTab !== 'none' ? request.body : undefined,
        }),
      })

      const data: ApiResponse = await res.json()
      if (!res.ok && 'error' in (data as object & { error?: string })) {
        setError((data as { error: string }).error)
      } else {
        setResponse(data)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-0 animate-fade-in">
      {/* ── LEFT: Request Builder ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 min-h-0">
        {/* URL bar */}
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-3">
          <div className="flex items-center gap-2">
            {/* Method selector */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowMethod(!showMethod)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold font-mono transition-all ${METHOD_COLORS[request.method]}`}
              >
                {request.method}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showMethod && (
                <div className="absolute top-full mt-1 left-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1 min-w-[110px]">
                  {HTTP_METHODS.map((m) => (
                    <button
                      key={m}
                      onClick={() => { setField('method', m); setShowMethod(false) }}
                      className={`w-full text-left px-3 py-1.5 text-sm font-bold font-mono hover:bg-slate-800 transition-colors ${request.method === m ? 'text-white' : 'text-slate-400'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* URL input */}
            <input
              type="url"
              value={request.url}
              onChange={(e) => setField('url', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="https://api.example.com/endpoint"
              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={loading || !request.url.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/20 shrink-0"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>

        {/* Request config tabs */}
        <div className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 flex flex-col min-h-0">
          {/* Sub-tabs */}
          <div className="flex gap-1 mb-4 border-b border-slate-700/40 pb-0">
            {(['headers', 'body', 'curl'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveReqTab(t)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeReqTab === t
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {t === 'curl' ? 'cURL Preview' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto min-h-0">
            {activeReqTab === 'headers' && (
              <KVEditor
                label="Request Headers"
                rows={request.headers}
                onChange={(rows) => setField('headers', rows)}
              />
            )}

            {activeReqTab === 'body' && (
              <div className="space-y-3">
                {/* Body type selector */}
                <div className="flex gap-2">
                  {(['none', 'json', 'text', 'form'] as BodyTab[]).map((bt) => (
                    <button
                      key={bt}
                      onClick={() => setBodyTab(bt)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        bodyTab === bt
                          ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                          : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {bt === 'none' ? 'None' : bt.toUpperCase()}
                    </button>
                  ))}
                </div>

                {bodyTab !== 'none' && (
                  <textarea
                    value={request.body}
                    onChange={(e) => setField('body', e.target.value)}
                    placeholder={bodyTab === 'json' ? '{\n  "key": "value"\n}' : 'Request body…'}
                    rows={10}
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500/60 resize-none transition-colors"
                    spellCheck={false}
                  />
                )}
              </div>
            )}

            {activeReqTab === 'curl' && (
              <div className="relative">
                <pre className="p-3 bg-slate-800/60 rounded-xl text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
                  {curlPreview}
                </pre>
                <button
                  onClick={() => navigator.clipboard.writeText(curlPreview)}
                  className="absolute top-2 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  title="Copy as cURL"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Response Viewer ───────────────────────────────────────────── */}
      <div className="flex flex-col bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 min-h-0">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3 shrink-0">
          Response
        </h2>

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
            <span className="text-sm">Waiting for response…</span>
          </div>
        )}

        {response && !loading && (
          <div className="flex-1 min-h-0">
            <ResponseViewer response={response} curlCmd={curlPreview} />
          </div>
        )}
      </div>
    </div>
  )
}
