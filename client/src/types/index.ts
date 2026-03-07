// ─── OS ───────────────────────────────────────────────────────────────────────
export interface OsImage {
  id: string
  label: string
  image: string
  shell: string
  description: string
  badge: string
}

// ─── Terminal Session ─────────────────────────────────────────────────────────
export type SessionState =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'error'
  | 'killed'

// ─── API Tester ───────────────────────────────────────────────────────────────
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface ApiRequest {
  url: string
  method: HttpMethod
  headers: KeyValue[]
  body: string
  contentType: 'json' | 'text' | 'form'
}

export interface ApiResponse {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body: unknown
  bodyRaw: string
  elapsed: number
  size: number
}
