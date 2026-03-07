// WebhookDumper — Production-ready webhook inspector
// Features: multi-channel, SSE real-time, event filter/search, headers/query/body
// viewer, QR code, copy URL, export JSON, expiry countdown, auto-reconnect.

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  Webhook,
  Download,
  RefreshCw,
  Search,
  X,
  Clock,
  Globe,
  ChevronRight,
  ArrowDownToLine,
  Layers,
  Zap,
  Filter,
  QrCode,
  ExternalLink,
  WifiOff,
  Wifi,
} from "lucide-react";
import type { WebhookEvent } from "../types/index.js";
import { API_BASE } from "../hooks/useTerminalSession.js";

// ---- Types -------------------------------------------------------------------

interface Channel {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  events: WebhookEvent[];
  status: "connecting" | "live" | "error" | "expired";
  unread: number;
}

// ---- Constants ---------------------------------------------------------------

const WH_TTL_MS = 60 * 60_000;

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/40",
  PUT: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  PATCH: "bg-purple-500/15 text-purple-400 border-purple-500/40",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/40",
  HEAD: "bg-slate-500/15 text-slate-400 border-slate-500/40",
  OPTIONS: "bg-indigo-500/15 text-indigo-400 border-indigo-500/40",
};

function getMethodColor(method: string) {
  return (
    METHOD_COLORS[method] ??
    "bg-slate-500/15 text-slate-400 border-slate-500/40"
  );
}

// ---- Helpers -----------------------------------------------------------------

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

function fmtDuration(ms: number) {
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

function highlightJson(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (m) => {
        let cls = "json-num";
        if (/^"/.test(m)) cls = /:$/.test(m) ? "json-key" : "json-str";
        else if (/true|false/.test(m)) cls = "json-bool";
        else if (/null/.test(m)) cls = "json-null";
        return `<span class="${cls}">${m}</span>`;
      },
    );
}

// ---- QR Code generator (no deps) -------------------------------------------
// Tiny URL-encoding QR using a data URI via the browser's built-in btoa / canvas-free trick.
// We use a well-known pattern-free approach: redirect via a public QR API at render time.
function QrCodeImage({ url }: { url: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&bgcolor=0f172a&color=818cf8&qzone=2&format=png`;
  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src={src}
        alt="QR Code"
        className="w-32 h-32 rounded-xl border border-slate-700/50"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <p className="text-[10px] text-slate-600">Scan to open webhook URL</p>
    </div>
  );
}

// ---- Expiry Countdown -------------------------------------------------------

function ExpiryCountdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(expiresAt - Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const r = expiresAt - Date.now();
      setRemaining(r);
      if (r <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const pct = Math.max(0, Math.min(100, (remaining / WH_TTL_MS) * 100));
  const urgent = remaining < 5 * 60_000;
  const warning = remaining < 15 * 60_000;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span
          className={
            urgent
              ? "text-red-400"
              : warning
                ? "text-amber-400"
                : "text-slate-500"
          }
        >
          Expires in {fmtDuration(remaining)}
        </span>
        <span className="text-slate-600">{Math.round(pct)}%</span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            urgent ? "bg-red-500" : warning ? "bg-amber-500" : "bg-brand-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---- Copy Button -------------------------------------------------------------

function CopyButton({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className={`p-1.5 rounded-lg transition-all ${
        copied
          ? "bg-emerald-500/20 text-emerald-400"
          : "hover:bg-slate-700/60 text-slate-500 hover:text-slate-300"
      } ${className}`}
      title="Copy"
    >
      {copied ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ---- Event Inspector ---------------------------------------------------------

type InspectorTab = "body" | "headers" | "query" | "raw";

function EventInspector({
  event,
  onClose,
}: {
  event: WebhookEvent;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("body");

  const prettyBody = useMemo(() => {
    if (typeof event.body === "object" && event.body !== null) {
      return JSON.stringify(event.body, null, 2);
    }
    return String(event.bodyRaw || "");
  }, [event]);

  const isJson = typeof event.body === "object" && event.body !== null;
  const bodySize = new TextEncoder().encode(prettyBody).length;
  const headerCount = Object.keys(event.headers).length;
  const queryCount = Object.keys(event.query).length;

  const downloadBody = () => {
    const blob = new Blob([prettyBody], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webhook-event-${event.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  function InspectorTabBtn({
    t,
    label,
    badge,
  }: {
    t: InspectorTab;
    label: string;
    badge?: number;
  }) {
    return (
      <button
        onClick={() => setTab(t)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
          tab === t
            ? "border-brand-500 text-brand-400"
            : "border-transparent text-slate-500 hover:text-slate-300"
        }`}
      >
        {label}
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] bg-brand-500/20 text-brand-400 rounded-full leading-none">
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Event header */}
      <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`shrink-0 px-2.5 py-1 text-xs font-bold font-mono rounded-lg border ${getMethodColor(event.method)}`}
          >
            {event.method}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-mono text-slate-300 truncate">
              {fmtDate(event.receivedAt)}
            </p>
            <p className="text-[10px] text-slate-600 font-mono">{event.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <CopyButton text={prettyBody} />
          <button
            onClick={downloadBody}
            className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-500 hover:text-slate-300 transition-all"
            title="Download body"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-500 hover:text-slate-300 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-700/40 mb-3 shrink-0">
        <InspectorTabBtn t="body" label="Body" />
        <InspectorTabBtn t="headers" label="Headers" badge={headerCount} />
        <InspectorTabBtn t="query" label="Query" badge={queryCount} />
        <InspectorTabBtn t="raw" label="Raw" />
      </div>

      {/* Body size chip */}
      {(tab === "body" || tab === "raw") && (
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <span className="text-[10px] text-slate-600 font-mono">
            {fmtBytes(bodySize)}
          </span>
          {isJson && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-mono">
              JSON
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0 rounded-xl bg-slate-950/60 border border-slate-800/60">
        {tab === "body" && (
          <pre
            className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all text-slate-300"
            dangerouslySetInnerHTML={{
              __html: isJson
                ? highlightJson(prettyBody)
                : prettyBody ||
                  '<span class="text-slate-600">(empty body)</span>',
            }}
          />
        )}

        {tab === "headers" && (
          <div className="divide-y divide-slate-800/60">
            {Object.entries(event.headers).length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-6">
                No headers
              </p>
            ) : (
              Object.entries(event.headers).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-800/30 group transition-colors"
                >
                  <span className="text-xs font-mono text-brand-300 w-48 shrink-0 truncate">
                    {k}
                  </span>
                  <span className="text-xs font-mono text-slate-300 break-all flex-1">
                    {v}
                  </span>
                  <CopyButton
                    text={v}
                    className="opacity-0 group-hover:opacity-100"
                  />
                </div>
              ))
            )}
          </div>
        )}

        {tab === "query" && (
          <div className="divide-y divide-slate-800/60">
            {Object.entries(event.query).length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-6">
                No query parameters
              </p>
            ) : (
              Object.entries(event.query).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-800/30 group transition-colors"
                >
                  <span className="text-xs font-mono text-emerald-300 w-48 shrink-0 truncate">
                    {k}
                  </span>
                  <span className="text-xs font-mono text-slate-300 break-all flex-1">
                    {v}
                  </span>
                  <CopyButton
                    text={v}
                    className="opacity-0 group-hover:opacity-100"
                  />
                </div>
              ))
            )}
          </div>
        )}

        {tab === "raw" && (
          <pre className="p-4 text-xs font-mono text-slate-400 whitespace-pre-wrap break-all">
            {event.bodyRaw || "(empty)"}
          </pre>
        )}
      </div>
    </div>
  );
}

// ---- Channel Item (sidebar) --------------------------------------------------

function ChannelItem({
  ch,
  active,
  onClick,
  onDelete,
  onRename,
}: {
  ch: Channel;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ch.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitRename = () => {
    setEditing(false);
    const name = draft.trim() || ch.name;
    setDraft(name);
    if (name !== ch.name) onRename(name);
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all group relative ${
        active
          ? "bg-brand-500/10 border-brand-500/40"
          : "bg-slate-900/40 border-slate-700/30 hover:border-slate-600/60 hover:bg-slate-800/40"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {/* Status dot */}
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            ch.status === "live"
              ? "bg-emerald-400 animate-pulse"
              : ch.status === "error"
                ? "bg-red-400"
                : ch.status === "expired"
                  ? "bg-slate-600"
                  : "bg-amber-400 animate-pulse"
          }`}
        />
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(ch.name);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            maxLength={64}
            className="flex-1 bg-transparent text-xs font-medium text-slate-200 outline-none border-b border-brand-500/60"
          />
        ) : (
          <span
            className="text-xs font-medium text-slate-300 truncate flex-1"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            title="Double-click to rename"
          >
            {ch.name}
          </span>
        )}
        {ch.unread > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 bg-brand-500/20 text-brand-400 rounded-full font-mono leading-none shrink-0">
            {ch.unread > 99 ? "99+" : ch.unread}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600">
        <span>
          {ch.events.length} req{ch.events.length !== 1 ? "s" : ""}
        </span>
        <span>·</span>
        <span>{fmtDuration(ch.expiresAt - Date.now())}</span>
      </div>
    </button>
  );
}

// ---- Event Row ---------------------------------------------------------------

function EventRow({
  event,
  selected,
  onClick,
}: {
  event: WebhookEvent;
  selected: boolean;
  onClick: () => void;
}) {
  const bodyPreview = useMemo(() => {
    if (typeof event.body === "object" && event.body !== null) {
      return JSON.stringify(event.body).slice(0, 80);
    }
    return event.bodyRaw?.slice(0, 80) || "";
  }, [event]);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl border transition-all group ${
        selected
          ? "bg-brand-500/10 border-brand-500/40"
          : "bg-slate-900/30 border-slate-700/30 hover:border-slate-600/60 hover:bg-slate-800/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`shrink-0 px-2 py-0.5 text-[10px] font-bold font-mono rounded border ${getMethodColor(event.method)}`}
        >
          {event.method}
        </span>
        <span className="text-[10px] font-mono text-slate-500 ml-auto">
          {fmtTime(event.receivedAt)}
        </span>
        <ChevronRight
          className={`w-3 h-3 text-slate-600 shrink-0 transition-transform ${selected ? "rotate-90" : "group-hover:translate-x-0.5"}`}
        />
      </div>
      {Object.keys(event.query).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {Object.entries(event.query)
            .slice(0, 3)
            .map(([k]) => (
              <span
                key={k}
                className="text-[10px] px-1.5 py-0.5 bg-slate-800/60 text-slate-500 rounded font-mono"
              >
                {k}
              </span>
            ))}
        </div>
      )}
      {bodyPreview && (
        <p className="text-[10px] font-mono text-slate-600 truncate">
          {bodyPreview}
        </p>
      )}
      {event.headers["content-type"] && (
        <p className="text-[10px] text-slate-700 truncate mt-0.5">
          {event.headers["content-type"]}
        </p>
      )}
    </button>
  );
}

// ---- Empty State -------------------------------------------------------------

function EmptyEvents({ channelUrl }: { channelUrl: string }) {
  const [copied, setCopied] = useState(false);
  const curlExample = `curl -X POST ${channelUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"hello": "world"}'`;

  const copy = async () => {
    await navigator.clipboard.writeText(curlExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 py-12">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-indigo-500/20 border border-brand-500/20 flex items-center justify-center">
        <Globe className="w-7 h-7 text-brand-400/60" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-300 mb-1">
          Waiting for requests…
        </p>
        <p className="text-xs text-slate-600 max-w-xs">
          Send any HTTP request to your webhook URL. It'll appear here
          instantly.
        </p>
      </div>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-600">
            Try it with curl
          </span>
          <button
            onClick={copy}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            {copied ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-400 whitespace-pre-wrap break-all">
          {curlExample}
        </pre>
      </div>
    </div>
  );
}

// ---- URL Bar -----------------------------------------------------------------

function UrlBar({ channelUrl, ch }: { channelUrl: string; ch: Channel }) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(channelUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 shrink-0">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          {ch.status === "live" ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : ch.status === "error" ? (
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          )}
          <span
            className={`text-xs font-semibold ${
              ch.status === "live"
                ? "text-emerald-400"
                : ch.status === "error"
                  ? "text-red-400"
                  : "text-amber-400"
            }`}
          >
            {ch.status === "live"
              ? "LIVE"
              : ch.status === "error"
                ? "DISCONNECTED"
                : "CONNECTING"}
          </span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowQr(!showQr)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
            showQr
              ? "bg-brand-500/15 border-brand-500/40 text-brand-400"
              : "border-slate-700/50 text-slate-500 hover:text-slate-300"
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          QR
        </button>
        <a
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg border border-slate-700/50 text-slate-500 hover:text-slate-300 transition-all"
          title="Open in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono text-brand-300 bg-slate-950/60 rounded-xl px-3 py-2.5 break-all border border-slate-800/60">
          {channelUrl}
        </code>
        <button
          onClick={copy}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
            copied
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
              : "bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/60"
          }`}
        >
          {copied ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {showQr && (
        <div className="mt-4 flex items-start gap-6 pt-4 border-t border-slate-800/60">
          <QrCodeImage url={channelUrl} />
          <div className="flex-1">
            <ExpiryCountdown expiresAt={ch.expiresAt} />
            <p className="text-[10px] text-slate-600 mt-3">
              Channel ID:{" "}
              <span className="font-mono text-slate-500">{ch.id}</span>
            </p>
            <p className="text-[10px] text-slate-600 mt-1">
              Created:{" "}
              <span className="font-mono text-slate-500">
                {fmtDate(ch.createdAt)}
              </span>
            </p>
          </div>
        </div>
      )}

      {!showQr && (
        <div className="mt-3">
          <ExpiryCountdown expiresAt={ch.expiresAt} />
        </div>
      )}
    </div>
  );
}

// ---- Channel persistence (localStorage) ------------------------------------

const CHANNELS_KEY = 'fa_wh_channels'
interface StoredChannel { id: string; name: string; createdAt: number; expiresAt: number }

function loadStoredChannels(): StoredChannel[] {
  try {
    const raw = localStorage.getItem(CHANNELS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    const now = Date.now()
    return (arr as StoredChannel[]).filter(
      (c) => c && typeof c.id === 'string' && typeof c.expiresAt === 'number' && c.expiresAt > now,
    )
  } catch { return [] }
}

function persistChannels(channels: Channel[]) {
  try {
    const now = Date.now()
    const toSave: StoredChannel[] = channels
      .filter((c) => c.expiresAt > now)
      .map(({ id, name, createdAt, expiresAt }) => ({ id, name, createdAt, expiresAt }))
    if (toSave.length > 0) localStorage.setItem(CHANNELS_KEY, JSON.stringify(toSave))
    else localStorage.removeItem(CHANNELS_KEY)
  } catch {
    console.error("Failed to persist channels to localStorage")
  }
}

// ---- Main Component ----------------------------------------------------------

export function WebhookDumper() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [showFilter, setShowFilter] = useState(false);
  const esRefs = useRef<Map<string, EventSource>>(new Map());

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeId) ?? null,
    [channels, activeId],
  );

  const channelUrl = activeChannel
    ? `${API_BASE || window.location.origin}/api/webhook/${activeChannel.id}/incoming`
    : null;

  // Mark all events as read when channel is active
  useEffect(() => {
    if (!activeId) return;
    setChannels((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)),
    );
    setSelectedEvent(null);
  }, [activeId]);

  // Reconnect SSE for a channel — robust version
  const retryTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const connectSSE = useCallback((id: string) => {
    // Cancel any pending retry for this channel
    const existing = retryTimers.current.get(id);
    if (existing !== undefined) {
      clearTimeout(existing);
      retryTimers.current.delete(id);
    }
    // Close old EventSource if any
    const old = esRefs.current.get(id);
    if (old) {
      old.onopen = null;
      old.onmessage = null;
      old.onerror = null;
      old.close();
      esRefs.current.delete(id);
    }

    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "connecting" } : c)),
    );

    const es = new EventSource(`${API_BASE}/api/webhook/${id}/listen`);
    esRefs.current.set(id, es);

    // ── Primary "live" detector ────────────────────────────────────────────────
    // The server immediately emits a named "connected" event after flushHeaders(),
    // which guarantees the response body is non-empty. This fires before onopen
    // in Vite proxy, nginx, and every browser we've tested.
    es.addEventListener("connected", () => {
      setChannels((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "live" as const } : c)),
      );
    });

    // ── Fallback onopen ────────────────────────────────────────────────────────
    // Mark live on open (not all browsers fire this reliably)
    es.onopen = () => {
      setChannels((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "live" } : c)),
      );
    };

    es.onmessage = (e) => {
      // Also force 'live' here — handles browsers that don't fire onopen
      setChannels((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          if (c.status !== "live") return { ...c, status: "live" as const };
          return c;
        }),
      );

      try {
        const { event } = JSON.parse(e.data) as { event: WebhookEvent };
        setChannels((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            const events = [...c.events, event].slice(-200);
            return {
              ...c,
              status: "live" as const,
              events,
              unread: c.unread + 1,
            };
          }),
        );
        // Auto-select first event in focused channel
        setActiveId((cur) => {
          if (cur === id) {
            setSelectedEvent((prev) => prev ?? event);
          }
          return cur;
        });
      } catch {}
    };

    es.onerror = () => {
      // Only act if this ES is still the current one for this channel
      if (esRefs.current.get(id) !== es) return;

      es.onopen = null;
      es.onmessage = null;
      es.onerror = null;
      es.close();
      esRefs.current.delete(id);

      setChannels((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "error" } : c)),
      );

      // Auto-retry after 5s — tracked so we can cancel it
      const timer = setTimeout(() => {
        retryTimers.current.delete(id);
        // Only reconnect if channel still exists (not deleted)
        setChannels((prev) => {
          const ch = prev.find((c) => c.id === id);
          if (ch && ch.status === "error") {
            // Schedule the actual reconnect after this setState batch
            setTimeout(() => connectSSE(id), 0);
          }
          return prev;
        });
      }, 5000);
      retryTimers.current.set(id, timer);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const t of retryTimers.current.values()) clearTimeout(t);
      retryTimers.current.clear();
      for (const es of esRefs.current.values()) {
        es.onopen = null;
        es.onmessage = null;
        es.onerror = null;
        es.close();
      }
      esRefs.current.clear();
    };
  }, []);

  // ── Restore channels from localStorage on mount ───────────────────────────
  // Channels survive tab switches and page refreshes. The server keeps channels
  // alive for 1 hour (WH_TTL_MS). We validate each stored ID against /info,
  // then reconnect SSE — the server replays all past events on reconnect.
  useEffect(() => {
    const stored = loadStoredChannels();
    if (stored.length === 0) return;
    (async () => {
      const valid: Channel[] = [];
      await Promise.all(
        stored.map(async (s) => {
          try {
            const r = await fetch(`${API_BASE}/api/webhook/${s.id}/info`);
            if (!r.ok) return; // Channel expired server-side — drop it
            const info = (await r.json()) as {
              id: string; name: string; createdAt: number; expiresAt: number
            };
            valid.push({
              id: info.id,
              // Prefer locally stored name (user may have renamed in this browser)
              name: s.name,
              createdAt: info.createdAt,
              expiresAt: info.expiresAt,
              // SSE /listen endpoint replays all past events on connect — start empty
              events: [],
              status: 'connecting' as const,
              unread: 0,
            });
          } catch { /* channel unreachable — skip silently */ }
        }),
      );
      if (valid.length === 0) { localStorage.removeItem(CHANNELS_KEY); return; }
      valid.sort((a, b) => a.createdAt - b.createdAt);
      setChannels(valid);
      setActiveId(valid[valid.length - 1].id);
      // Small delay to let React commit the channels before connecting SSE
      valid.forEach((ch) => setTimeout(() => connectSSE(ch.id), 50));
    })();
  // connectSSE is a stable useCallback — safe to omit from dep array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist channel metadata whenever channels change ────────────────────
  useEffect(() => {
    persistChannels(channels);
  }, [channels]);

  const createChannel = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/webhook/create`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        id: string;
        expiresIn: number;
        expiresAt: number;
        createdAt: number;
      };
      const now = Date.now();
      const ch: Channel = {
        id: data.id,
        name: `Channel ${channels.length + 1}`,
        createdAt: data.createdAt ?? now,
        expiresAt: data.expiresAt ?? now + (data.expiresIn ?? WH_TTL_MS),
        events: [],
        status: "connecting",
        unread: 0,
      };
      setChannels((prev) => [...prev, ch]);
      setActiveId(ch.id);
      // Small delay to let React commit the channel before starting SSE
      setTimeout(() => connectSSE(ch.id), 50);
    } catch (err) {
      console.error(
        "[webhook] Failed to create channel:",
        (err as Error).message,
      );
    } finally {
      setCreating(false);
    }
  };

  const deleteChannel = async (id: string) => {
    // Cancel any pending retry
    const t = retryTimers.current.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      retryTimers.current.delete(id);
    }
    // Close and null-out handlers before closing
    const es = esRefs.current.get(id);
    if (es) {
      es.onopen = null;
      es.onmessage = null;
      es.onerror = null;
      es.close();
      esRefs.current.delete(id);
    }
    await fetch(`${API_BASE}/api/webhook/${id}`, { method: "DELETE" }).catch(
      () => {},
    );
    setChannels((prev) => prev.filter((c) => c.id !== id));
    setActiveId((cur) => {
      if (cur !== id) return cur;
      const remaining = channels.filter((c) => c.id !== id);
      return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
    });
  };

  const clearEvents = async () => {
    if (!activeId) return;
    fetch(`${API_BASE}/api/webhook/${activeId}/events`, {
      method: "DELETE",
    }).catch(() => {});
    setChannels((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, events: [], unread: 0 } : c,
      ),
    );
    setSelectedEvent(null);
  };

  const renameChannel = async (id: string, name: string) => {
    // Optimistic update
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    // Persist on server
    fetch(`${API_BASE}/api/webhook/${id}/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => {});
  };

  const exportEvents = () => {
    if (!activeChannel) return;
    const blob = new Blob([JSON.stringify(activeChannel.events, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webhook-${activeChannel.id.slice(0, 8)}-events.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reconnect = () => {
    if (!activeId) return;
    connectSSE(activeId);
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (!activeChannel) return [];
    return activeChannel.events.filter((e) => {
      const matchMethod = methodFilter === "ALL" || e.method === methodFilter;
      const matchSearch =
        !search ||
        e.method.includes(search.toUpperCase()) ||
        JSON.stringify(e.body).toLowerCase().includes(search.toLowerCase()) ||
        Object.keys(e.headers).some((k) =>
          k.toLowerCase().includes(search.toLowerCase()),
        ) ||
        Object.keys(e.query).some((k) =>
          k.toLowerCase().includes(search.toLowerCase()),
        );
      return matchMethod && matchSearch;
    });
  }, [activeChannel, search, methodFilter]);

  // Methods present in events for filter
  const presentMethods = useMemo(() => {
    if (!activeChannel) return [];
    return [...new Set(activeChannel.events.map((e) => e.method))];
  }, [activeChannel]);

  const totalRequests = channels.reduce((s, c) => s + c.events.length, 0);

  return (
    <div className="flex h-full min-h-0 gap-0 animate-fade-in">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 flex flex-col bg-slate-900/70 border-r border-slate-700/40 rounded-l-2xl overflow-hidden">
        {/* Sidebar header */}
        <div className="px-3 py-3 border-b border-slate-700/40">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500/30 to-indigo-500/30 border border-brand-500/30 flex items-center justify-center">
              <Webhook className="w-3.5 h-3.5 text-brand-400" />
            </div>
            <span className="text-xs font-semibold text-slate-200">
              Webhook Dumper
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-700/40">
              <p className="text-sm font-bold text-brand-400 font-mono">
                {channels.length}
              </p>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide">
                Channels
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-lg px-2 py-1.5 text-center border border-slate-700/40">
              <p className="text-sm font-bold text-emerald-400 font-mono">
                {totalRequests}
              </p>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide">
                Requests
              </p>
            </div>
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {channels.length === 0 && (
            <div className="text-center py-8 px-2">
              <Layers className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-[11px] text-slate-600">No channels yet</p>
            </div>
          )}
          {channels.map((ch) => (
            <ChannelItem
              key={ch.id}
              ch={ch}
              active={ch.id === activeId}
              onClick={() => setActiveId(ch.id)}
              onDelete={() => deleteChannel(ch.id)}
              onRename={(name) => renameChannel(ch.id, name)}
            />
          ))}
        </div>

        {/* Create new */}
        <div className="p-2 border-t border-slate-700/40">
          <button
            onClick={createChannel}
            disabled={creating || channels.length >= 10}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600/80 hover:bg-brand-500/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all"
          >
            {creating ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {creating ? "Creating…" : "New Channel"}
          </button>
          {channels.length >= 10 && (
            <p className="text-[10px] text-slate-600 text-center mt-1.5">
              Max 10 channels
            </p>
          )}
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      {!activeChannel ? (
        // Landing / no channel selected
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 bg-slate-900/20 rounded-r-2xl border border-l-0 border-slate-700/40">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500/20 to-indigo-500/20 border border-brand-500/20 flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.15)]">
            <Webhook className="w-9 h-9 text-brand-400/70" />
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-slate-100 mb-2">
              Webhook Inspector
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Create a channel to get a unique, temporary URL. Send any HTTP
              request to it and inspect every detail — headers, query params,
              body — in real time.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 w-full max-w-md">
            {[
              {
                icon: <Zap className="w-4 h-4" />,
                label: "Real-time",
                sub: "SSE stream",
              },
              {
                icon: <Clock className="w-4 h-4" />,
                label: "1 hour TTL",
                sub: "Auto-expires",
              },
              {
                icon: <Layers className="w-4 h-4" />,
                label: "Multi-channel",
                sub: "Up to 10",
              },
            ].map((f) => (
              <div
                key={f.label}
                className="flex flex-col items-center gap-2 p-3 bg-slate-900/60 border border-slate-700/40 rounded-xl"
              >
                <div className="text-brand-400">{f.icon}</div>
                <p className="text-xs font-medium text-slate-300">{f.label}</p>
                <p className="text-[10px] text-slate-600">{f.sub}</p>
              </div>
            ))}
          </div>
          <button
            onClick={createChannel}
            disabled={creating}
            className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-bold rounded-2xl transition-all shadow-lg shadow-brand-600/25"
          >
            {creating ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create First Channel
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-900/20 rounded-r-2xl border border-l-0 border-slate-700/40 overflow-hidden">
          {/* Top: URL bar */}
          <div className="p-4 border-b border-slate-700/40 shrink-0">
            <UrlBar channelUrl={channelUrl!} ch={activeChannel} />
          </div>

          {/* Split: event list + inspector */}
          <div className="flex flex-1 min-h-0 gap-0 overflow-hidden">
            {/* Event list */}
            <div className="w-72 shrink-0 flex flex-col border-r border-slate-700/40">
              {/* List toolbar */}
              <div className="px-3 py-2.5 border-b border-slate-700/40 space-y-2 shrink-0">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search events…"
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg pl-7 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/60"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filter row */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowFilter(!showFilter)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-all ${
                      methodFilter !== "ALL"
                        ? "bg-brand-500/15 border-brand-500/40 text-brand-400"
                        : "border-slate-700/40 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <Filter className="w-2.5 h-2.5" />
                    {methodFilter}
                  </button>
                  <span className="text-[10px] text-slate-600 ml-auto">
                    {filteredEvents.length} / {activeChannel.events.length}
                  </span>
                  <button
                    onClick={clearEvents}
                    className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                    title="Clear events"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={exportEvents}
                    disabled={activeChannel.events.length === 0}
                    className="p-1 text-slate-600 hover:text-slate-300 transition-colors disabled:opacity-30"
                    title="Export as JSON"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={reconnect}
                    className="p-1 text-slate-600 hover:text-slate-300 transition-colors"
                    title="Reconnect"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                {/* Method filter pills */}
                {showFilter && presentMethods.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(["ALL", ...presentMethods] as string[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setMethodFilter(m);
                          setShowFilter(false);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold transition-all ${
                          methodFilter === m
                            ? "bg-brand-500/15 border-brand-500/40 text-brand-400"
                            : m === "ALL"
                              ? "border-slate-700/40 text-slate-500 hover:text-slate-300"
                              : getMethodColor(m)
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Event scroll list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {activeChannel.status !== "live" &&
                  activeChannel.status !== "expired" && (
                    <div className="flex items-center justify-center gap-2 py-3">
                      <span className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      <span className="text-[11px] text-amber-400">
                        {activeChannel.status === "connecting"
                          ? "Connecting…"
                          : "Reconnecting…"}
                      </span>
                    </div>
                  )}
                {filteredEvents.length === 0 &&
                activeChannel.status === "live" ? (
                  <div className="py-6 text-center">
                    <Globe className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                    <p className="text-[11px] text-slate-600">
                      {search || methodFilter !== "ALL"
                        ? "No matching events"
                        : "Waiting for requests…"}
                    </p>
                  </div>
                ) : (
                  [...filteredEvents]
                    .reverse()
                    .map((ev) => (
                      <EventRow
                        key={ev.id}
                        event={ev}
                        selected={selectedEvent?.id === ev.id}
                        onClick={() => setSelectedEvent(ev)}
                      />
                    ))
                )}
              </div>
            </div>

            {/* Inspector panel */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              {selectedEvent ? (
                <div className="flex-1 p-4 min-h-0 overflow-hidden flex flex-col">
                  <EventInspector
                    event={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                  />
                </div>
              ) : activeChannel.events.length === 0 ? (
                <EmptyEvents channelUrl={channelUrl!} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-600">
                  <div className="text-center">
                    <ChevronRight className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Select an event to inspect</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
