import React, { useEffect, useState } from 'react';
import { API_BASE } from '../hooks/useTerminalSession.js';

type HistoryItem = { domain: string; types: string[]; resolver?: string; ts: number; result?: any };

type PropagationResult = {
  domain: string;
  types: string[];
  results: Record<string, { server: string; data?: any; error?: string }>;
};

export const DnsInspector: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [types, setTypes] = useState<string[]>(['A', 'AAAA', 'CNAME', 'MX', 'TXT']);
  const [customResolver, setCustomResolver] = useState('');
  const [useCustomResolver, setUseCustomResolver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [propagationResult, setPropagationResult] = useState<PropagationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'lookup' | 'propagation'>('lookup');
  const [spfDmarcAnalysis, setSpfDmarcAnalysis] = useState<string | null>(null);

  const allRecordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'PTR', 'CAA'];

  useEffect(() => {
    try {
      const raw = localStorage.getItem('dns-history');
      if (raw) setHistory(JSON.parse(raw));
    } catch {}

    // Load from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const domainParam = urlParams.get('domain');
    const typesParam = urlParams.get('types');
    const resolverParam = urlParams.get('resolver');

    if (domainParam) setDomain(domainParam);
    if (typesParam) {
      try {
        const parsedTypes = JSON.parse(typesParam);
        if (Array.isArray(parsedTypes)) setTypes(parsedTypes);
      } catch {}
    }
    if (resolverParam) {
      setCustomResolver(resolverParam);
      setUseCustomResolver(true);
    }
  }, []);

  // Update URL when parameters change
  useEffect(() => {
    if (domain || types.length > 0 || (useCustomResolver && customResolver)) {
      const params = new URLSearchParams();
      if (domain) params.set('domain', domain);
      if (types.length > 0) params.set('types', JSON.stringify(types));
      if (useCustomResolver && customResolver) params.set('resolver', customResolver);

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [domain, types, useCustomResolver, customResolver]);

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
    setPropagationResult(null);
    const host = normalizeInput(domain);
    if (!host) return setError('Enter a domain or URL');

    setLoading(true);
    try {
      const resolver = useCustomResolver && customResolver ? customResolver : undefined;
      const r = await fetch(`${API_BASE}/api/dns/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: host, types, resolver }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'DNS lookup failed');
      setResult(data);
      const item: HistoryItem = { domain: host, types, resolver, ts: Date.now(), result: data };
      setHistory((h) => [item, ...h.filter((x) => x.domain !== host)].slice(0, 50));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const checkPropagation = async () => {
    setError(null);
    setPropagationResult(null);
    const host = normalizeInput(domain);
    if (!host) return setError('Enter a domain or URL');

    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/dns/propagation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: host, types }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Propagation check failed');
      setPropagationResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const runFromHistory = (it: HistoryItem) => {
    setDomain(it.domain);
    setTypes(it.types);
    setCustomResolver(it.resolver || '');
    setUseCustomResolver(!!it.resolver);
    setResult(it.result);
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('dns-history');
    } catch {}
  };

  const analyzeSpfDmarc = (txtRecords: string[]) => {
    const analysis: string[] = [];

    txtRecords.forEach(record => {
      const lower = record.toLowerCase();
      if (lower.startsWith('v=spf1')) {
        analysis.push(`SPF Record: ${record}`);
        if (lower.includes('v=spf1')) {
          analysis.push('  ✓ Valid SPF record');
          const includes = (record.match(/include:([^\s]+)/g) || []).map((inc: string) => inc.replace('include:', ''));
          if (includes.length > 0) {
            analysis.push(`  Includes: ${includes.join(', ')}`);
          }
          const mechanisms = record.split(' ').filter(part => !part.startsWith('v=') && part !== '');
          analysis.push(`  Mechanisms: ${mechanisms.join(', ')}`);
        } else {
          analysis.push('  ✗ Invalid SPF record');
        }
      } else if (lower.startsWith('v=dmarc1')) {
        analysis.push(`DMARC Record: ${record}`);
        if (lower.includes('v=dmarc1')) {
          analysis.push('  ✓ Valid DMARC record');
          const policy = record.match(/p=([^;\s]+)/)?.[1];
          if (policy) analysis.push(`  Policy: ${policy}`);
          const rua = record.match(/rua=([^;\s]+)/)?.[1];
          if (rua) analysis.push(`  Aggregate reports: ${rua}`);
          const ruf = record.match(/ruf=([^;\s]+)/)?.[1];
          if (ruf) analysis.push(`  Forensic reports: ${ruf}`);
        } else {
          analysis.push('  ✗ Invalid DMARC record');
        }
      } else if (lower.includes('v=dkim1')) {
        analysis.push(`DKIM Record: ${record}`);
        if (lower.includes('v=dkim1')) {
          analysis.push('  ✓ Valid DKIM record');
          const selector = record.match(/s=([^;\s]+)/)?.[1];
          if (selector) analysis.push(`  Selector: ${selector}`);
        } else {
          analysis.push('  ✗ Invalid DKIM record');
        }
      }
    });

    setSpfDmarcAnalysis(analysis.length > 0 ? analysis.join('\n') : 'No SPF, DMARC, or DKIM records found in TXT records.');
  };

  const exportResults = () => {
    const data = {
      domain,
      timestamp: new Date().toISOString(),
      types,
      resolver: useCustomResolver ? customResolver : 'default',
      result,
      propagationResult,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dns-inspection-${domain}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyShareableLink = () => {
    const params = new URLSearchParams();
    if (domain) params.set('domain', domain);
    if (types.length > 0) params.set('types', JSON.stringify(types));
    if (useCustomResolver && customResolver) params.set('resolver', customResolver);

    const shareableUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(shareableUrl);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <aside className="md:col-span-1">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-sm font-semibold text-white">History</h4>
            </div>
            <button
              onClick={clearHistory}
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors duration-200"
              title="Clear history"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          <div className="max-h-96 overflow-auto space-y-2">
            {history.length === 0 && (
              <div className="text-slate-500 text-sm text-center py-4">
                <svg className="w-8 h-8 mx-auto mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No lookups yet
              </div>
            )}
            {history.map((h) => (
              <button
                key={h.ts}
                onClick={() => runFromHistory(h)}
                className="w-full text-left px-3 py-3 rounded-lg hover:bg-slate-800/40 transition-all duration-200 border border-transparent hover:border-slate-700/50 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate group-hover:text-brand-400 transition-colors">
                      {h.domain}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {h.types.join(', ')}
                    </div>
                    {h.resolver && (
                      <div className="text-xs text-slate-500 mt-1">
                        via {h.resolver}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 ml-2 flex-shrink-0">
                    {new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="md:col-span-3">
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4M12 18v4M4 6h4M16 6h4M4 18h4M16 18h4M12 12a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white text-xl font-semibold">DNS Inspector</h3>
              <p className="text-slate-400 text-sm">Query DNS records and check global propagation</p>
            </div>
          </div>

          {/* Tab selector with improved styling */}
          <div className="flex gap-1 mb-6 p-1 bg-slate-800/50 rounded-lg">
            <button
              onClick={() => setActiveTab('lookup')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'lookup'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              DNS Lookup
            </button>
            <button
              onClick={() => setActiveTab('propagation')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'propagation'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
              Propagation Check
            </button>
          </div>

          <form onSubmit={activeTab === 'lookup' ? submit : checkPropagation} className="space-y-4 mb-6">
            {/* Domain input with improved styling */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">Domain Name</label>
              <div className="flex gap-2">
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com or https://example.com/path"
                  className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                  onKeyPress={(e) => e.key === 'Enter' && (activeTab === 'lookup' ? submit() : checkPropagation())}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {activeTab === 'lookup' ? 'Resolving...' : 'Checking...'}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={activeTab === 'lookup' ? "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" : "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"} />
                      </svg>
                      {activeTab === 'lookup' ? 'Resolve' : 'Check Propagation'}
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Custom resolver */}
            {activeTab === 'lookup' && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={useCustomResolver}
                    onChange={(e) => setUseCustomResolver(e.target.checked)}
                    className="w-4 h-4 text-brand-600 bg-slate-800 border-slate-600 rounded focus:ring-brand-500 focus:ring-2"
                  />
                  <span>Use Custom DNS Server</span>
                </label>
                {useCustomResolver && (
                  <input
                    value={customResolver}
                    onChange={(e) => setCustomResolver(e.target.value)}
                    placeholder="8.8.8.8"
                    className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 w-48"
                  />
                )}
              </div>
            )}

            {/* Record type checkboxes with improved styling */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">Record Types</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {allRecordTypes.map((t) => (
                  <label
                    key={t}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
                      types.includes(t)
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={types.includes(t)}
                      onChange={() => toggleType(t)}
                      className="w-4 h-4 text-brand-600 bg-slate-800 border-slate-600 rounded focus:ring-brand-500 focus:ring-2"
                    />
                    <span className="text-sm font-medium">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          </form>

          {/* Action buttons with improved styling */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={exportResults}
              disabled={!result && !propagationResult}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 disabled:bg-slate-800/30 disabled:cursor-not-allowed text-slate-300 hover:text-white disabled:text-slate-500 rounded-lg text-sm font-medium transition-all duration-200 border border-slate-700 disabled:border-slate-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export JSON
            </button>
            <button
              onClick={copyShareableLink}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-all duration-200 border border-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              Share Link
            </button>
          </div>

          {/* Results display with improved styling */}
          <div className="space-y-4">
            {error && (
              <div className="p-4 bg-rose-900/20 border border-rose-700/50 rounded-lg">
                <div className="flex items-center gap-2 text-rose-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-rose-300 text-sm mt-1">{error}</p>
              </div>
            )}

            {activeTab === 'lookup' && result && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {result.cached ? 'From cache' : 'Live lookup'}
                  {useCustomResolver && ` via ${customResolver}`}
                </div>
                <div className="grid gap-3">
                  {allRecordTypes.map((t) => {
                    const v = result.data?.[t];
                    return (
                      <div key={t} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{t}</span>
                            {t === 'TXT' && v && Array.isArray(v) && v.length > 0 && (
                              <button
                                onClick={() => analyzeSpfDmarc(v)}
                                className="px-2 py-1 bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 hover:text-brand-300 rounded text-xs font-medium transition-all duration-200 border border-brand-600/30"
                              >
                                Analyze SPF/DMARC
                              </button>
                            )}
                          </div>
                          {v === undefined && (
                            <span className="text-slate-500 text-xs">Not requested</span>
                          )}
                        </div>
                        {v && v.error && (
                          <div className="text-rose-400 text-sm bg-rose-900/20 p-2 rounded border border-rose-700/30">
                            {v.error}
                          </div>
                        )}
                        {Array.isArray(v) && v.length === 0 && (
                          <div className="text-slate-500 text-sm italic">No records found</div>
                        )}
                        {Array.isArray(v) && v.length > 0 && (
                          <div className="space-y-1">
                            {v.map((item: any, i: number) => (
                              <div key={i} className="text-sm text-slate-300 bg-slate-900/40 p-2 rounded border border-slate-700/30 font-mono">
                                {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'propagation' && propagationResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                  </svg>
                  Global propagation check across multiple DNS servers
                </div>
                <div className="grid gap-3">
                  {Object.entries(propagationResult.results).map(([resolverName, check]: [string, any]) => (
                    <div key={resolverName} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold text-white text-sm">{resolverName}</div>
                        <div className="text-xs text-slate-500">{check.server}</div>
                      </div>
                      {check.error ? (
                        <div className="text-rose-400 text-sm bg-rose-900/20 p-2 rounded border border-rose-700/30">
                          {check.error}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(check.data || {}).map(([type, records]: [string, any]) => (
                            <div key={type} className="flex items-start gap-2">
                              <span className="text-slate-400 text-xs font-medium min-w-[3rem]">{type}:</span>
                              <span className="text-slate-300 text-sm font-mono bg-slate-900/40 p-1 rounded border border-slate-700/30 flex-1">
                                {Array.isArray(records) ? records.join(', ') : String(records)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SPF/DMARC Analysis with improved styling */}
            {spfDmarcAnalysis && (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="font-semibold text-white text-sm">SPF/DMARC Analysis</div>
                </div>
                <div className="text-sm text-slate-300 whitespace-pre-line font-mono bg-slate-900/40 p-3 rounded border border-slate-700/30">
                  {spfDmarcAnalysis}
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
