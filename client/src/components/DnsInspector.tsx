import React, { useEffect, useState } from 'react';
import { API_BASE } from '../hooks/useTerminalSession.js';

type HistoryItem = { domain: string; types: string[]; ts: number; result?: any };

export const DnsInspector: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [types, setTypes] = useState<string[]>(['A', 'AAAA', 'CNAME', 'MX', 'TXT']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('dns-history');
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  // Avoid overwriting storage on first render (read happens in previous effect)
  const firstWriteRef = React.useRef(true)
  useEffect(() => {
    try {
      if (firstWriteRef.current) { firstWriteRef.current = false; return }
      localStorage.setItem('dns-history', JSON.stringify(history.slice(0, 50)));
    } catch {}
  }, [history]);

  const toggleType = (t: string) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const normalizeInput = (input: string) => {
    const s = input.trim();
    if (!s) return '';
    // If user pasted a full URL, extract hostname
    try {
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s) || s.includes('/')) {
        const u = new URL(s);
        return u.hostname;
      }
    } catch {}
    // strip scheme if present
    return s.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setResult(null);
    const host = normalizeInput(domain);
    if (!host) return setError('Enter a domain or URL');
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/dns/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: host, types }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'DNS lookup failed');
      setResult(data);
      const item: HistoryItem = { domain: host, types, ts: Date.now(), result: data };
      setHistory((h) => [item, ...h.filter((x) => x.domain !== host)].slice(0, 50));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const runFromHistory = (it: HistoryItem) => {
    setDomain(it.domain);
    setTypes(it.types);
    setResult(it.result);
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('dns-history');
    } catch {}
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <aside className="md:col-span-1">
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-white">History</h4>
            <button onClick={clearHistory} className="text-xs text-slate-400 hover:text-white">
              Clear
            </button>
          </div>
          <div className="max-h-80 overflow-auto text-sm">
            {history.length === 0 && <div className="text-slate-400">No lookups yet</div>}
            {history.map((h) => (
              <button
                key={h.ts}
                onClick={() => runFromHistory(h)}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-800/40 flex items-center justify-between"
              >
                <div>
                  <div className="text-white text-sm">{h.domain}</div>
                  <div className="text-xs text-slate-400">{h.types.join(', ')}</div>
                </div>
                <div className="text-xs text-slate-500">{new Date(h.ts).toLocaleTimeString()}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="md:col-span-3">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
          <h3 className="text-white text-lg font-semibold mb-3">DNS Inspector</h3>
          <form onSubmit={submit} className="flex gap-2 items-center">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com or https://example.com/path"
              className="bg-slate-800/40 text-white px-3 py-2 rounded-md flex-1"
            />
            <button
              type="submit"
              disabled={loading}
              className="ml-2 px-3 py-2 bg-brand-600 rounded-md text-white"
            >
              {loading ? 'Looking...' : 'Resolve'}
            </button>
          </form>

          <div className="mt-3 flex gap-2 flex-wrap">
            {['A', 'AAAA', 'CNAME', 'MX', 'TXT'].map((t) => (
              <label
                key={t}
                className={`px-2 py-1 rounded-md text-sm cursor-pointer ${types.includes(t) ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                <input
                  type="checkbox"
                  checked={types.includes(t)}
                  onChange={() => toggleType(t)}
                  className="mr-2"
                />
                {t}
              </label>
            ))}
          </div>

          <div className="mt-4 text-sm text-slate-300">
            {error && <div className="text-rose-400">{error}</div>}

            {result && (
              <div>
                <div className="mb-2 text-xs text-slate-400">
                  {result.cached ? 'From cache' : 'Live lookup'}
                </div>
                <div className="grid gap-2">
                  {['A', 'AAAA', 'CNAME', 'MX', 'TXT'].map((t) => {
                    const v = result.data?.[t];
                    return (
                      <div key={t} className="bg-slate-800/40 p-3 rounded">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-white">{t}</div>
                        </div>
                        {v === undefined && (
                          <div className="text-slate-400 text-sm">Not requested</div>
                        )}
                        {v && v.error && <div className="text-rose-400 text-sm">{v.error}</div>}
                        {Array.isArray(v) && v.length === 0 && (
                          <div className="text-slate-400">No records</div>
                        )}
                        {Array.isArray(v) && v.length > 0 && (
                          <ul className="text-xs text-white list-disc ml-5">
                            {v.map((item: any, i: number) => (
                              <li key={i}>
                                {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DnsInspector;
