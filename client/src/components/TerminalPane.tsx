import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import {
  AlertTriangle,
  Clock,
  Copy,
  PlayCircle,
  Search,
  Square,
  RotateCcw,
  Cpu,
  MemoryStick,
} from 'lucide-react';
import { useTerminalSession, API_BASE } from '../hooks/useTerminalSession.js';
import { OSSelector } from './OSSelector.js';
import type { OsImage, ServerStats } from '../types/index.js';

const XTERM_THEME = {
  background: '#171717',
  foreground: '#e6edf3',
  cursor: '#D9FF00',
  cursorAccent: '#171717',
  black: '#484f58',
  red: '#ff7b72',
  green: '#D9FF00',
  yellow: '#d29922',
  blue: '#D9FF00',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#D9FF00',
  brightYellow: '#e3b341',
  brightBlue: '#D9FF00',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc',
  selectionBackground: 'rgba(217, 255, 0, 0.3)',
};

interface TerminalPaneProps {
  osImages: OsImage[];
}

// ── StatsBar ──────────────────────────────────────────────────────────────────
// Isolated component that owns its own SSE connection to /api/stats/stream.
// Keeping it separate from TerminalPane means stats updates only re-render THIS
// small component — not the terminal tree — eliminating any React reconciliation
// overhead near the xterm canvas while the user is typing.
function StatsBar() {
  const [stats, setStats] = useState<ServerStats | null>(null);

  useEffect(() => {
    const es = new EventSource(API_BASE + '/api/stats/stream');
    es.onmessage = (e) => {
      try {
        setStats(JSON.parse(e.data as string) as ServerStats);
      } catch {
        /* malformed event, skip */
      }
    };
    // On hard / permanent error close to avoid a reconnect storm;
    // browsers auto-reconnect on soft network blips already.
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  if (!stats) return null;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-1.5 rounded-xl border text-xs transition-all shrink-0 ${
        stats.overloaded
          ? 'bg-neutral-900 border-brand-500/30 shadow-[0_0_10px_rgba(217,255,0,0.1)]'
          : 'bg-neutral-900/40 border-neutral-800'
      }`}
    >
      {stats.overloaded && (
        <span className="flex items-center gap-1.5 text-brand-500 font-medium shrink-0">
          <AlertTriangle className="w-3 h-3" />
          {stats.cpu >= stats.killThreshold || stats.mem >= stats.killThreshold
            ? 'Server critically overloaded — sessions are being terminated'
            : 'Server at capacity — new sessions paused'}
        </span>
      )}
      <span
        className={`flex items-center gap-1 ${
          stats.cpu >= stats.killThreshold
            ? 'text-brand-500 font-bold'
            : stats.cpu >= stats.overloadThreshold
              ? 'text-brand-400'
              : 'text-brand-500/50'
        }`}
      >
        <Cpu className="w-3 h-3" />
        CPU {stats.cpu}%
      </span>
      <span
        className={`flex items-center gap-1 ${
          stats.mem >= stats.killThreshold
            ? 'text-brand-500 font-bold'
            : stats.mem >= stats.overloadThreshold
              ? 'text-brand-400'
              : 'text-brand-500/50'
        }`}
      >
        <MemoryStick className="w-3 h-3" />
        RAM {stats.mem}%
      </span>
    </div>
  );
}

function formatMs(ms: number | null): string {
  if (ms === null) return '--';
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TerminalPane({ osImages }: TerminalPaneProps) {
  const [selectedOs, setSelectedOs] = useState('ubuntu');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const termWrapRef = useRef<HTMLDivElement>(null); // observed by ResizeObserver
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // rAF stdout batcher — accumulate WS stdout chunks and flush to xterm once
  // per animation frame.  This keeps the number of term.write() calls equal
  // to the frame rate (~60/s) regardless of how many WS messages arrive,
  // preventing the JS main thread from being saturated by write overhead
  // during burst output (top, large pastes, apt install, etc.).
  const writeBufRef = useRef('');
  const writeRafRef = useRef(0);
  // Resize debounce + container size tracking to avoid infinite resize loops
  const lastContainerSizeRef = useRef({ w: 0, h: 0 });
  const proposedDimsRef = useRef<{ cols: number; rows: number } | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── session callbacks ──────────────────────────────────────────────────────
  const handleData = useCallback((data: string) => {
    writeBufRef.current += data;
    if (!writeRafRef.current) {
      writeRafRef.current = requestAnimationFrame(() => {
        writeRafRef.current = 0;
        const buf = writeBufRef.current;
        writeBufRef.current = '';
        if (buf && xtermRef.current) xtermRef.current.write(buf);
      });
    }
  }, []);

  const handleReady = useCallback(() => {
    xtermRef.current?.write(
      '\r\n\x1b[32m✓ Container ready\x1b[0m — type \x1b[33mhelp\x1b[0m to explore.\r\n\r\n',
    );
    fitRef.current?.fit();
  }, []);

  const handleError = useCallback((msg: string) => {
    xtermRef.current?.write(`\r\n\x1b[31m✗ Error:\x1b[0m ${msg}\r\n`);
  }, []);

  const handleExit = useCallback((code: number) => {
    xtermRef.current?.write(
      `\r\n\x1b[33mSession exited with code ${code}.\x1b[0m Press Restart to begin a new session.\r\n`,
    );
  }, []);

  const session = useTerminalSession({
    onData: handleData,
    onReady: handleReady,
    onError: handleError,
    onExit: handleExit,
  });

  // ── Init xterm ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || xtermRef.current) return;

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
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    const search = new SearchAddon();

    term.loadAddon(fit);
    term.loadAddon(links);
    term.loadAddon(search);

    term.open(containerRef.current);
    // Defer initial fit until the browser has performed layout so the container
    // has real pixel dimensions.  Calling fit.fit() synchronously here causes
    // "Cannot read properties of undefined (reading 'dimensions')" because the
    // xterm renderer hasn't finished its own internal setup yet.
    requestAnimationFrame(() => {
      try {
        const el = containerRef.current;
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) fit.fit();
      } catch {
        /* swallow — terminal may have been disposed before first paint */
      }
    });

    xtermRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    // Pass user input to session
    term.onData((data) => {
      session.sendInput(data);
    });

    // Welcome art
    term.write('\x1b[34m');
    term.write('  ███████╗ █████╗ ██╗██████╗      █████╗ ██████╗ ███████╗███╗   ██╗ █████╗ \r\n');
    term.write('  ██╔════╝██╔══██╗██║██╔══██╗    ██╔══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗\r\n');
    term.write('  █████╗  ███████║██║██████╔╝    ███████║██████╔╝█████╗  ██╔██╗ ██║███████║\r\n');
    term.write('  ██╔══╝  ██╔══██║██║██╔══██╗    ██╔══██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══██║\r\n');
    term.write('  ██║     ██║  ██║██║██║  ██║    ██║  ██║██║  ██║███████╗██║ ╚████║██║  ██║\r\n');
    term.write('  ╚═╝     ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝\r\n');
    term.write('\x1b[0m');
    term.write(
      '\r\n  \x1b[1mWelcome to FairArena Online Terminal\x1b[0m  ·  \x1b[2mSecure Docker Sandbox\x1b[0m\r\n',
    );
    term.write(
      '  \x1b[2mSelect an OS above and press \x1b[0m\x1b[32mStart Session\x1b[0m\x1b[2m to begin.\x1b[0m\r\n\r\n',
    );

    // Resize observer — observe the wrapper div, NOT the xterm canvas.
    // We debounce and coalesce resize events and only send a resize when the
    // proposed cols/rows actually change. This prevents an endless feedback
    // loop where fit() adjusts the canvas, which retriggers the observer.
    const target = termWrapRef.current ?? containerRef.current!;
    let rafId = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        try {
          const el = target as HTMLElement | null;
          if (!fit || !xtermRef.current || !el) return;
          const w = (el as HTMLElement).offsetWidth;
          const h = (el as HTMLElement).offsetHeight;
          if (w <= 0 || h <= 0) return;

          // Avoid repeated fit() calls when container size hasn't materially changed
          const last = lastContainerSizeRef.current;
          if (Math.abs(last.w - w) <= 1 && Math.abs(last.h - h) <= 1) return;
          lastContainerSizeRef.current = { w, h };

          // Run fit once — it may change the canvas but we coalesce subsequent
          // events and only send the final cols/rows to the server.
          fit.fit();
          const dims = fit.proposeDimensions();
          if (!dims) return;

          // Coalesce rapid dimension updates — wait 120ms for the final size.
          proposedDimsRef.current = dims;
          if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
          resizeTimerRef.current = setTimeout(() => {
            resizeTimerRef.current = null;
            const d = proposedDimsRef.current;
            proposedDimsRef.current = null;
            if (d) session.resize(d.cols, d.rows);
          }, 120);
        } catch (err) {
          if (import.meta.env.DEV) console.debug('[terminal] resize error', (err as Error).message);
        }
      });
    });
    ro.observe(target);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      cancelAnimationFrame(writeRafRef.current);
      writeRafRef.current = 0;
      writeBufRef.current = '';
      term.dispose();
      xtermRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (session.expiresIn === null) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(null);
      return;
    }

    let remaining = session.expiresIn;
    setTimeLeft(remaining);

    timerRef.current = setInterval(() => {
      remaining -= 1000;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        setTimeLeft(0);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session.expiresIn]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStart = () => {
    const dims = fitRef.current?.proposeDimensions() ?? { cols: 120, rows: 30 };
    session.start(selectedOs, dims.cols, dims.rows);
  };

  const handleKill = () => {
    session.kill();
    xtermRef.current?.write('\r\n\x1b[33mSession terminated.\x1b[0m\r\n');
  };

  const handleRestart = () => {
    handleKill();
    setTimeout(() => handleStart(), 300);
  };

  const handleCopy = async () => {
    const sel = xtermRef.current?.getSelection();
    if (!sel) return;
    await navigator.clipboard.writeText(sel);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1500);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val) searchRef.current?.findNext(val, { caseSensitive: false, incremental: true });
  };

  const isRunning = session.state === 'ready';
  const isConnecting = session.state === 'connecting';

  // ── Status badge ───────────────────────────────────────────────────────────
  const statusBadge = () => {
    switch (session.state) {
      case 'idle':
        return (
          <span className="flex items-center gap-1.5 text-neutral-500 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
            Idle
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1.5 text-brand-400 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Connecting…
          </span>
        );
      case 'ready':
        return (
          <span className="flex items-center gap-1.5 text-brand-500 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-slow" />
            Live
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-neutral-400 text-xs">
            <AlertTriangle className="w-3 h-3" />
            Error
          </span>
        );
      case 'killed':
        return (
          <span className="flex items-center gap-1.5 text-neutral-500 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
            Stopped
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full w-full min-w-0 animate-fade-in">
      {/* OS Selector */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
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
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-wait text-black text-sm font-bold rounded-xl transition-all shadow-lg shadow-brand-500/20"
            >
              <PlayCircle className="w-4 h-4" />
              {isConnecting ? 'Starting…' : 'Start Session'}
            </button>
          ) : (
            <>
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-xl transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart
              </button>
              <button
                onClick={handleKill}
                className="flex items-center gap-2 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-sm font-medium rounded-xl transition-all"
              >
                <Square className="w-3.5 h-3.5" />
                Kill
              </button>
            </>
          )}

          <div className="ml-auto flex items-center gap-3">
            {statusBadge()}
            {timeLeft !== null && (
              <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Clock className="w-3 h-3" />
                <span className={timeLeft < 120_000 ? 'text-brand-500 font-bold' : ''}>
                  {formatMs(timeLeft)}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Error banner */}
        {session.state === 'error' && (
          <div className="mt-3 flex items-start gap-2.5 p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
            <p className="text-sm text-neutral-400">{session.statusMessage}</p>
          </div>
        )}
      </div>

      {/* Resource status bar — isolated component, re-renders independently of TerminalPane */}
      <StatsBar />

      {/* Terminal window */}
      <div
        ref={termWrapRef}
        className="flex-1 flex flex-col w-full min-w-0 bg-[#171717] border border-neutral-800 rounded-2xl overflow-hidden min-h-0 shadow-2xl"
      >
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-neutral-800" />
            <span className="w-3 h-3 rounded-full bg-neutral-700" />
            <span className="w-3 h-3 rounded-full bg-brand-500/80 shadow-[0_0_8px_rgba(217,255,0,0.4)]" />
          </div>

          <span className="text-xs text-neutral-400 font-mono ml-1">
            {isRunning ? `fairarena@${selectedOs} ~ bash` : 'fairarena-terminal'}
          </span>

          {/* Toolbar */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1.5 rounded-md transition-colors ${showSearch ? 'text-brand-500 bg-brand-500/15' : 'text-neutral-500 hover:text-neutral-300'}`}
              title="Search (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-300 transition-colors"
              title="Copy selection"
            >
              <Copy className={`w-3.5 h-3.5 ${copyFeedback ? 'text-brand-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="px-3 py-2 bg-neutral-900/60 border-b border-neutral-800 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Find in terminal…"
              value={searchQuery}
              onChange={handleSearch}
              className="flex-1 bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none"
            />
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              ✕
            </button>
          </div>
        )}

        {/* xterm.js container — overflow:hidden prevents canvas escaping bounds */}
        <div
          ref={containerRef}
          className="flex-1 p-3 min-h-0 overflow-hidden"
          style={{ fontVariantLigatures: 'none', width: '100%', minWidth: 0 }}
        />
      </div>

      {/* Tips */}
      <div className="text-xs text-neutral-500 flex flex-wrap gap-x-6 gap-y-1">
        <span>
          Try: <code className="text-neutral-400">curl https://httpbin.org/get</code>
        </span>
        <span>
          or: <code className="text-neutral-400">cat /etc/os-release</code>
        </span>
        <span>
          or: <code className="text-neutral-400">top</code>
        </span>
        <span className="ml-auto">Sessions auto-expire in 30 min · Isolated Docker container</span>
      </div>
    </div>
  );
}
