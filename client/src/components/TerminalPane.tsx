import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { AlertTriangle, Clock, Copy, PlayCircle, Search, Square, RotateCcw } from 'lucide-react'
import { useTerminalSession } from '../hooks/useTerminalSession.js'
import { OSSelector } from './OSSelector.js'
import type { OsImage } from '../types/index.js'

const XTERM_THEME = {
  background:  '#0d1117',
  foreground:  '#e6edf3',
  cursor:      '#58a6ff',
  cursorAccent:'#0d1117',
  black:       '#484f58',
  red:         '#ff7b72',
  green:       '#3fb950',
  yellow:      '#d29922',
  blue:        '#58a6ff',
  magenta:     '#bc8cff',
  cyan:        '#39c5cf',
  white:       '#b1bac4',
  brightBlack: '#6e7681',
  brightRed:   '#ffa198',
  brightGreen: '#56d364',
  brightYellow:'#e3b341',
  brightBlue:  '#79c0ff',
  brightMagenta:'#d2a8ff',
  brightCyan:  '#56d4dd',
  brightWhite: '#f0f6fc',
  selectionBackground: 'rgba(56, 139, 253, 0.3)',
}

interface TerminalPaneProps {
  osImages: OsImage[]
}

function formatMs(ms: number | null): string {
  if (ms === null) return '--'
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function TerminalPane({ osImages }: TerminalPaneProps) {
  const [selectedOs, setSelectedOs] = useState('ubuntu')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef    = useRef<XTerm | null>(null)
  const fitRef      = useRef<FitAddon | null>(null)
  const searchRef   = useRef<SearchAddon | null>(null)
  const timerRef    = useRef<NodeJS.Timeout | null>(null)

  // ── session callbacks ──────────────────────────────────────────────────────
  const handleData = useCallback((data: string) => {
    xtermRef.current?.write(data)
  }, [])

  const handleReady = useCallback(() => {
    xtermRef.current?.write('\r\n\x1b[32m✓ Container ready\x1b[0m — type \x1b[33mhelp\x1b[0m to explore.\r\n\r\n')
    fitRef.current?.fit()
  }, [])

  const handleError = useCallback((msg: string) => {
    xtermRef.current?.write(`\r\n\x1b[31m✗ Error:\x1b[0m ${msg}\r\n`)
  }, [])

  const handleExit = useCallback((code: number) => {
    xtermRef.current?.write(`\r\n\x1b[33mSession exited with code ${code}.\x1b[0m Press Restart to begin a new session.\r\n`)
  }, [])

  const session = useTerminalSession({ onData: handleData, onReady: handleReady, onError: handleError, onExit: handleExit })

  // ── Init xterm ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || xtermRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontWeight: '400',
      lineHeight: 1.4,
      letterSpacing: 0,
      theme: XTERM_THEME,
      allowTransparency: true,
      scrollback: 5000,
      convertEol: false,
    })

    const fit    = new FitAddon()
    const links  = new WebLinksAddon()
    const search = new SearchAddon()

    term.loadAddon(fit)
    term.loadAddon(links)
    term.loadAddon(search)

    term.open(containerRef.current)
    fit.fit()

    xtermRef.current = term
    fitRef.current   = fit
    searchRef.current = search

    // Pass user input to session
    term.onData((data) => {
      session.sendInput(data)
    })

    // Welcome art
    term.write('\x1b[34m')
    term.write('  ███████╗ █████╗ ██╗██████╗      █████╗ ██████╗ ███████╗███╗   ██╗ █████╗ \r\n')
    term.write('  ██╔════╝██╔══██╗██║██╔══██╗    ██╔══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗\r\n')
    term.write('  █████╗  ███████║██║██████╔╝    ███████║██████╔╝█████╗  ██╔██╗ ██║███████║\r\n')
    term.write('  ██╔══╝  ██╔══██║██║██╔══██╗    ██╔══██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══██║\r\n')
    term.write('  ██║     ██║  ██║██║██║  ██║    ██║  ██║██║  ██║███████╗██║ ╚████║██║  ██║\r\n')
    term.write('  ╚═╝     ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝\r\n')
    term.write('\x1b[0m')
    term.write('\r\n  \x1b[1mWelcome to FairArena Online Terminal\x1b[0m  ·  \x1b[2mSecure Docker Sandbox\x1b[0m\r\n')
    term.write('  \x1b[2mSelect an OS above and press \x1b[0m\x1b[32mStart Session\x1b[0m\x1b[2m to begin.\x1b[0m\r\n\r\n')

    // Resize observer
    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        const dims = fit.proposeDimensions()
        if (dims) session.resize(dims.cols, dims.rows)
      } catch { /* ignore */ }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      term.dispose()
      xtermRef.current  = null
      fitRef.current    = null
      searchRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (session.expiresIn === null) {
      if (timerRef.current) clearInterval(timerRef.current)
      setTimeLeft(null)
      return
    }

    let remaining = session.expiresIn
    setTimeLeft(remaining)

    timerRef.current = setInterval(() => {
      remaining -= 1000
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current!)
        setTimeLeft(0)
      }
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [session.expiresIn])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStart = () => {
    const dims = fitRef.current?.proposeDimensions() ?? { cols: 120, rows: 30 }
    session.start(selectedOs, dims.cols, dims.rows)
  }

  const handleKill = () => {
    session.kill()
    xtermRef.current?.write('\r\n\x1b[33mSession terminated.\x1b[0m\r\n')
  }

  const handleRestart = () => {
    handleKill()
    setTimeout(() => handleStart(), 300)
  }

  const handleCopy = async () => {
    const sel = xtermRef.current?.getSelection()
    if (!sel) return
    await navigator.clipboard.writeText(sel)
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 1500)
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (val) searchRef.current?.findNext(val, { caseSensitive: false, incremental: true })
  }

  const isRunning = session.state === 'ready'
  const isConnecting = session.state === 'connecting'

  // ── Status badge ───────────────────────────────────────────────────────────
  const statusBadge = () => {
    switch (session.state) {
      case 'idle':        return <span className="flex items-center gap-1.5 text-slate-500 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" />Idle</span>
      case 'connecting':  return <span className="flex items-center gap-1.5 text-amber-400 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Connecting…</span>
      case 'ready':       return <span className="flex items-center gap-1.5 text-emerald-400 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />Live</span>
      case 'error':       return <span className="flex items-center gap-1.5 text-red-400 text-xs"><AlertTriangle className="w-3 h-3" />Error</span>
      case 'killed':      return <span className="flex items-center gap-1.5 text-slate-500 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" />Stopped</span>
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full animate-fade-in">
      {/* OS Selector */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4">
        <OSSelector
          images={osImages}
          selected={selectedOs}
          disabled={isRunning || isConnecting}
          onSelect={setSelectedOs}
        />

        {/* Controls row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-wait text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/20"
            >
              <PlayCircle className="w-4 h-4" />
              {isConnecting ? 'Starting…' : 'Start Session'}
            </button>
          ) : (
            <>
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart
              </button>
              <button
                onClick={handleKill}
                className="flex items-center gap-2 px-3.5 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-sm font-medium rounded-xl transition-all"
              >
                <Square className="w-3.5 h-3.5" />
                Kill
              </button>
            </>
          )}

          <div className="ml-auto flex items-center gap-3">
            {statusBadge()}
            {timeLeft !== null && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                <span className={timeLeft < 120_000 ? 'text-amber-400' : ''}>{formatMs(timeLeft)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Error banner */}
        {session.state === 'error' && (
          <div className="mt-3 flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">{session.statusMessage}</p>
          </div>
        )}
      </div>

      {/* Terminal window */}
      <div className="flex-1 flex flex-col bg-[#0d1117] border border-slate-700/50 rounded-2xl overflow-hidden min-h-0 shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/80 border-b border-slate-700/50 shrink-0">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>

          <span className="text-xs text-slate-400 font-mono ml-1">
            {isRunning
              ? `fairarena@${selectedOs} ~ bash`
              : 'fairarena-terminal'}
          </span>

          {/* Toolbar */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1.5 rounded-md transition-colors ${showSearch ? 'text-brand-400 bg-brand-500/15' : 'text-slate-500 hover:text-slate-300'}`}
              title="Search (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 transition-colors"
              title="Copy selection"
            >
              <Copy className={`w-3.5 h-3.5 ${copyFeedback ? 'text-green-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-700/50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Find in terminal…"
              value={searchQuery}
              onChange={handleSearch}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
            />
            <button
              onClick={() => { setShowSearch(false); setSearchQuery('') }}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          </div>
        )}

        {/* xterm.js container */}
        <div
          ref={containerRef}
          className="flex-1 p-3 min-h-0"
          style={{ fontVariantLigatures: 'none' }}
        />
      </div>

      {/* Tips */}
      <div className="text-xs text-slate-500 flex flex-wrap gap-x-6 gap-y-1">
        <span>Try: <code className="text-slate-400">curl https://httpbin.org/get</code></span>
        <span>or: <code className="text-slate-400">cat /etc/os-release</code></span>
        <span>or: <code className="text-slate-400">top</code></span>
        <span className="ml-auto">Sessions auto-expire in 30 min · Isolated Docker container</span>
      </div>
    </div>
  )
}
