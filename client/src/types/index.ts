// OS
export interface OsImage {
  id: string; label: string; image: string
  shell: string; description: string; badge: string
}

// Terminal Session
export type SessionState = 'idle' | 'connecting' | 'ready' | 'error' | 'killed'

// API Tester
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface KeyValue {
  id: string; key: string; value: string; enabled: boolean
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey'

export interface AuthConfig {
  type: AuthType
  // bearer
  token?: string
  // basic
  username?: string
  password?: string
  // api key
  apiKeyName?: string
  apiKeyValue?: string
  apiKeyIn?: 'header' | 'query'
}

export type BodyType = 'none' | 'json' | 'text' | 'form' | 'xml' | 'binary'

export interface ApiRequest {
  id: string
  name: string
  url: string
  method: HttpMethod
  params: KeyValue[]
  headers: KeyValue[]
  auth: AuthConfig
  bodyType: BodyType
  body: string
  formData: KeyValue[]
}

export interface ApiResponse {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body: unknown
  bodyRaw: string
  contentType: string
  elapsed: number
  size: number
  redirected?: boolean
  finalUrl?: string
}

export interface HistoryEntry {
  id: string
  name: string
  timestamp: number
  request: ApiRequest
  response: ApiResponse | null
}

export interface ServerStats {
  cpu: number
  mem: number
  overloaded: boolean
  overloadThreshold: number
  killThreshold: number
  sessions: number
  maxSessions: number
}

export interface WebhookEvent {
  id: string
  receivedAt: number
  method: string
  headers: Record<string, string>
  query: Record<string, string>
  body: unknown
  bodyRaw: string
}
