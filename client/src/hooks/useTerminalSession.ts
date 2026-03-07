import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionState } from '../types/index.js'

// ─── Environment config ───────────────────────────────────────────────────────
// Set VITE_API_URL in .env when the backend lives on a different host (Vercel + VPS).
// If left empty the SPA proxies through Vite dev-server (local dev default).
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

const WS_BASE = API_BASE
  ? API_BASE.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws'))
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
const WS_URL = `${WS_BASE}/terminal`

type WsServerMsg =
  | { type: 'ready'; sessionId: string; expiresIn: number }
  | { type: 'stdout'; data: string }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string }
  | { type: 'exit'; code: number }
  | { type: 'killed' }
  | { type: 'pong' }

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

  const sendJson = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const kill = useCallback(() => {
    sendJson({ type: 'kill' })
    wsRef.current?.close()
    wsRef.current = null
    setState('killed')
    setSessionId(null)
    setExpiresIn(null)
  }, [sendJson])

  const start = useCallback(async (osId: string, cols: number, rows: number) => {
    // Close any existing connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setState('connecting')
    setStatusMessage('Checking server…')

    // Pre-flight capacity check — avoids a misleading "connection failed" error
    // when the real cause is overload or session limit.
    try {
      const r = await fetch(`${API_BASE}/api/server-stats`, {
        signal: AbortSignal.timeout(3_000),
      })
      if (r.ok) {
        const ss = await r.json() as { overloaded?: boolean }
        if (ss.overloaded) {
          setState('error')
          const msg = 'Server is at capacity — no new sessions available right now. Please try again in a few minutes.'
          setStatusMessage(msg)
          optsRef.current.onError(msg)
          return
        }
      }
    } catch { /* stats endpoint unreachable — fall through and let WS fail naturally */ }

    setStatusMessage('Connecting…')

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start', osId, cols, rows }))
    }

    ws.onmessage = (ev) => {
      let msg: WsServerMsg
      try {
        msg = JSON.parse(ev.data as string) as WsServerMsg
      } catch {
        return
      }

      switch (msg.type) {
        case 'ready':
          setState('ready')
          setSessionId(msg.sessionId)
          setExpiresIn(msg.expiresIn)
          optsRef.current.onReady()
          break

        case 'stdout':
          optsRef.current.onData(msg.data)
          break

        case 'status':
          setStatusMessage(msg.message)
          break

        case 'error':
          setState('error')
          setStatusMessage(msg.message)
          optsRef.current.onError(msg.message)
          break

        case 'exit':
          setState('killed')
          optsRef.current.onExit(msg.code)
          break

        case 'killed':
          setState('killed')
          break

        case 'pong':
          break
      }
    }

    ws.onclose = () => {
      if (state !== 'killed' && state !== 'error') {
        setState('killed')
      }
      wsRef.current = null
    }

    ws.onerror = () => {
      setState('error')
      const msg = 'Connection failed — the server may be temporarily unavailable or still starting up.'
      setStatusMessage(msg)
      optsRef.current.onError(msg)
    }
  }, [state])

  const sendInput = useCallback((data: string) => {
    sendJson({ type: 'stdin', data })
  }, [sendJson])

  const resize = useCallback((cols: number, rows: number) => {
    sendJson({ type: 'resize', cols, rows })
  }, [sendJson])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return { state, statusMessage, sessionId, expiresIn, start, sendInput, resize, kill }
}
