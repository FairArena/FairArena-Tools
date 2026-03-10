import React, { useEffect, useState } from 'react';
import { API_BASE } from '../hooks/useTerminalSession.js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Search, Globe, Trash2, Download, Share, AlertCircle, CheckCircle } from 'lucide-react';

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

  // toggleType removed; using Checkbox onCheckedChange handlers instead

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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                History
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                title="Clear history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              {history.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No lookups yet
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <Button
                      key={h.ts}
                      variant="ghost"
                      className="w-full justify-start h-auto p-3"
                      onClick={() => runFromHistory(h)}
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="flex-1 min-w-0 text-left">
                          <div className="font-medium truncate">{h.domain}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {h.types.join(', ')}
                          </div>
                          {h.resolver && (
                            <div className="text-xs text-muted-foreground mt-1">
                              via {h.resolver}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </aside>

      <section className="md:col-span-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>DNS Inspector</CardTitle>
                <p className="text-muted-foreground text-sm">Query DNS records and check global propagation</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'lookup' | 'propagation')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="lookup" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  DNS Lookup
                </TabsTrigger>
                <TabsTrigger value="propagation" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Propagation Check
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lookup" className="space-y-4">
                <form onSubmit={submit} className="space-y-4">
                  {/* Domain input */}
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="domain"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="example.com or https://example.com/path"
                        onKeyPress={(e) => e.key === 'Enter' && submit()}
                      />
                      <Button type="submit" disabled={loading}>
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                            Resolving...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Resolve
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Custom resolver */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="custom-resolver"
                        checked={useCustomResolver}
                        onCheckedChange={(checked) => setUseCustomResolver(checked as boolean)}
                      />
                      <Label htmlFor="custom-resolver">Use Custom DNS Server</Label>
                    </div>
                    {useCustomResolver && (
                      <Input
                        value={customResolver}
                        onChange={(e) => setCustomResolver(e.target.value)}
                        placeholder="8.8.8.8"
                        className="w-48"
                      />
                    )}
                  </div>

                  {/* Record type checkboxes */}
                  <div className="space-y-2">
                    <Label>Record Types</Label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {allRecordTypes.map((t) => (
                        <div key={t} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${t}`}
                            checked={types.includes(t)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setTypes([...types, t]);
                              } else {
                                setTypes(types.filter(type => type !== t));
                              }
                            }}
                          />
                          <Label htmlFor={`type-${t}`} className="text-sm">{t}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="propagation" className="space-y-4">
                <form onSubmit={checkPropagation} className="space-y-4">
                  {/* Domain input */}
                  <div className="space-y-2">
                    <Label htmlFor="domain-prop">Domain Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="domain-prop"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="example.com or https://example.com/path"
                        onKeyPress={(e) => e.key === 'Enter' && checkPropagation()}
                      />
                      <Button type="submit" disabled={loading}>
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                            Checking...
                          </>
                        ) : (
                          <>
                            <Globe className="h-4 w-4 mr-2" />
                            Check Propagation
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Record type checkboxes */}
                  <div className="space-y-2">
                    <Label>Record Types</Label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {allRecordTypes.map((t) => (
                        <div key={t} className="flex items-center space-x-2">
                          <Checkbox
                            id={`prop-type-${t}`}
                            checked={types.includes(t)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setTypes([...types, t]);
                              } else {
                                setTypes(types.filter(type => type !== t));
                              }
                            }}
                          />
                          <Label htmlFor={`prop-type-${t}`} className="text-sm">{t}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </TabsContent>
            </Tabs>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={exportResults}
                disabled={!result && !propagationResult}
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
              <Button
                variant="outline"
                onClick={copyShareableLink}
              >
                <Share className="h-4 w-4 mr-2" />
                Share Link
              </Button>
            </div>

            {/* Error display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Results display */}
            <div className="space-y-4">
              {activeTab === 'lookup' && result && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {result.cached ? 'From cache' : 'Live lookup'}
                    {useCustomResolver && ` via ${customResolver}`}
                  </div>
                  <div className="grid gap-3">
                    {allRecordTypes.map((t) => {
                      const v = result.data?.[t];
                      return (
                        <Card key={t}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">{t}</CardTitle>
                              {t === 'TXT' && v && Array.isArray(v) && v.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => analyzeSpfDmarc(v)}
                                >
                                  Analyze SPF/DMARC
                                </Button>
                              )}
                              {v === undefined && (
                                <Badge variant="secondary">Not requested</Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            {v && v.error && (
                              <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{v.error}</AlertDescription>
                              </Alert>
                            )}
                            {Array.isArray(v) && v.length === 0 && (
                              <p className="text-muted-foreground italic">No records found</p>
                            )}
                            {Array.isArray(v) && v.length > 0 && (
                              <div className="space-y-2">
                                {v.map((item: any, i: number) => (
                                  <div key={i} className="text-sm font-mono bg-muted p-2 rounded border">
                                    {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'propagation' && propagationResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-4 w-4" />
                    Global propagation check across multiple DNS servers
                  </div>
                  <div className="grid gap-3">
                    {Object.entries(propagationResult.results).map(([resolverName, check]: [string, any]) => (
                      <Card key={resolverName}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{resolverName}</CardTitle>
                            <Badge variant="outline">{check.server}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {check.error ? (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{check.error}</AlertDescription>
                            </Alert>
                          ) : (
                            <div className="space-y-2">
                              {Object.entries(check.data || {}).map(([type, records]: [string, any]) => (
                                <div key={type} className="flex items-start gap-2">
                                  <span className="text-muted-foreground text-xs font-medium min-w-[3rem]">{type}:</span>
                                  <span className="text-sm font-mono bg-muted p-1 rounded border flex-1">
                                    {Array.isArray(records) ? records.join(', ') : String(records)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* SPF/DMARC Analysis */}
              {spfDmarcAnalysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                      SPF/DMARC Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded border">{spfDmarcAnalysis}</pre>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default DnsInspector;
