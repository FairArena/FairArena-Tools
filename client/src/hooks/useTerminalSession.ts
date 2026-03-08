import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionState } from '../types/index.js'

// ─── Environment config ───────────────────────────────────────────────────────
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

const WS_BASE = API_BASE
  ? API_BASE.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws'))
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
const WS_URL = `${WS_BASE}/terminal`

type WsServerMsg =
  | { type: 'ready'; sessionId: string; expiresIn: number }
  | { type: 'stdout'; data: string }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string; overloaded?: boolean }
  | { type: 'exit'; code: number }
  | { type: 'killed' }
  | { type: 'pong' }
  | { type: 'expiry-warning'; remainingMs: number; message: string }

export interface UseTerminalSessionOpts {
  onData: (data: string) => void
  onReady: () => void
  onError: (msg: string) => void
  onExit: (code: number) => void
}

export interface TerminalSessionHandle {
  state: SessionState
  statusMessage: string
  sessionId: string | null
  expiresIn: number | null
  start: (osId: string, cols: number, rows: number) => void
  sendInput: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
}

export function useTerminalSession(opts: UseTerminalSessionOpts): TerminalSessionHandle {
  const [state, setState] = useState<SessionState>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [expiresIn, setExpiresIn] = useState<number | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  // stateRef mirrors state so callbacks always see the current value
  // without stale-closure issues (React state updates are async but refs are sync).
  const stateRef = useRef<SessionState>('idle')
  // Keep it in sync on every render:
  stateRef.current = state

  // ── helpers ────────────────────────────────────────────────────────────────
  // Centralised state setter that keeps ref in sync
  const setS = (s: SessionState) => { stateRef.current = s; setState(s) }

  // ── kill ───────────────────────────────────────────────────────────────────
  const kill = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: 'kill' })) } catch {}
      wsRef.current.close()
      wsRef.current = null
    }
    stateRef.current = 'killed'
    setState('killed')
    setSessionId(null)
    setExpiresIn(null)
    setStatusMessage('')
  }, []) // stable — reads refs only

  // ── start ──────────────────────────────────────────────────────────────────
  const start = useCallback(async (osId: string, cols: number, rows: number) => {
    // Tear down any stale connection first
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    stateRef.current = 'connecting'
    setState('connecting')
    setStatusMessage('Checking server…')

    // Pre-flight capacity check
    try {
      const r = await fetch(`${API_BASE}/api/server-stats`, { signal: AbortSignal.timeout(3_000) })
      if (r.ok) {
        const ss = (await r.json()) as { overloaded?: boolean }
        if (ss.overloaded) {
          setS('error')
          const msg = 'Server is at capacity — try again in a few minutes.'
          setStatusMessage(msg)
          optsRef.current.onError(msg)
          return
        }
      }
    } catch { /* server-stats unreachable — attempt WS anyway */ }

    setStatusMessage('Connecting…')

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start', osId, cols, rows }))
    }

    ws.onmessage = (ev) => {
      let msg: WsServerMsg
      try { msg = JSON.parse(ev.data as string) as WsServerMsg } catch { return }

      switch (msg.type) {
        case 'ready':
          setS('ready')
          setSessionId(msg.sessionId)
          setExpiresIn(msg.expiresIn)
          setStatusMessage('')
          optsRef.current.onReady()
          break
        case 'stdout':
          optsRef.current.onData(msg.data)
          break
        case 'status':
          // Only surface status messages to React state when the session is NOT
          // yet ready.  Once 'ready', throttle notices etc. must not trigger a
          // re-render of TerminalPane — that causes visible typing jank because
          // React reconciles the whole terminal subtree synchronously on the main
          // thread, competing with keyboard event processing.
          if (stateRef.current !== 'ready') setStatusMessage(msg.message)
          break
        case 'error':
          setS('error')
          setStatusMessage(msg.message)
          optsRef.current.onError(msg.message)
          break
        case 'exit':
          setS('killed')
          setSessionId(null)
          optsRef.current.onExit(msg.code)
          break
        case 'killed':
          setS('killed')
          setSessionId(null)
          break
        case 'expiry-warning':
          setStatusMessage(msg.message)
          break
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      if (stateRef.current !== 'killed' && stateRef.current !== 'error') {
        setS('killed')
        setSessionId(null)
      }
    }

    ws.onerror = () => {
      setS('error')
      const msg = 'WebSocket connection failed — server may be unavailable.'
      setStatusMessage(msg)
      optsRef.current.onError(msg)
    }
  }, []) // stable — all state access via refs

  // ── sendInput ──────────────────────────────────────────────────────────────
  // Sends stdin directly and immediately. Silently drops input when not ready
  // so the server never receives stdin before a session exists.
  // Large pastes (> 4 KB) are chunked to respect the server's per-message limit.
  // Micro-batched send: accumulate small keystrokes and flush after a short
  // delay (~12ms). This preserves interactivity while dramatically reducing
  // per-keystroke WS frames (avoids server-side throttling during pastes).
  const inputBufRef = useRef('')
  const inputFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const CHUNK = 4000

  const flushInput = useCallback(() => {
    inputFlushRef.current = null
    const buf = inputBufRef.current
    if (!buf) return
    inputBufRef.current = ''
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    // If buffer is larger than CHUNK, send in chunks immediately
    if (buf.length <= CHUNK) {
      try { ws.send(JSON.stringify({ type: 'stdin', data: buf })) } catch {}
    } else {
      for (let i = 0; i < buf.length; i += CHUNK) {
        try { ws.send(JSON.stringify({ type: 'stdin', data: buf.slice(i, i + CHUNK) })) } catch {}
      }
    }
  }, [])

  const sendInput = useCallback((data: string) => {
    if (stateRef.current !== 'ready') return
    // Large payloads (pastes) bypass the micro-buffer to avoid added latency
    if (data.length > CHUNK) {
      // flush any pending small buffer first
      if (inputFlushRef.current) { clearTimeout(inputFlushRef.current); inputFlushRef.current = null }
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      for (let i = 0; i < data.length; i += CHUNK) {
        try { ws.send(JSON.stringify({ type: 'stdin', data: data.slice(i, i + CHUNK) })) } catch {}
      }
      return
    }

    // Append to micro-buffer and schedule a short flush
    inputBufRef.current += data
    if (!inputFlushRef.current) {
      inputFlushRef.current = setTimeout(() => flushInput(), 12)
    }
  }, [flushInput]) // stable-ish — flushInput is stable

  // ── resize ─────────────────────────────────────────────────────────────────
  // Guard: only send resize when session is live to prevent triggering
  // "No active session" errors from ResizeObserver during connecting state.
  const resize = useCallback((cols: number, rows: number) => {
    if (stateRef.current !== 'ready') return
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    try { ws.send(JSON.stringify({ type: 'resize', cols, rows })) } catch {}
  }, []) // stable — reads refs only

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close()
      // clear any pending input flush timer
      try { if (inputFlushRef.current) clearTimeout(inputFlushRef.current) } catch {}
      inputFlushRef.current = null
    }
  }, [])

  return { state, statusMessage, sessionId, expiresIn, start, sendInput, resize, kill }
}
