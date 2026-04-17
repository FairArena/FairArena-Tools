import React, { useEffect, useState } from 'react';
import { AlertCircle, BarChart3, CheckCircle, Copy, Trash2, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

const URLS_STORAGE_KEY = 'fairarena_short_urls';

interface ShortUrlResponse {
  id: string;
  shortcode: string;
  originalUrl: string;
  expiresAt: string | null;
  createdAt: string;
  maxUsages?: number | null;
  notes?: string | null;
  tags?: string[];
  secret?: string | null;
  hasSecret?: boolean;
  hit?: number;
  used?: number;
  shortUrl?: string;
}

interface BreakdownItem {
  key: string;
  count: number;
}

interface UsageEvent {
  id: number;
  timestamp?: string;
  country?: string;
  region?: string;
  city?: string;
  browser?: string;
  os?: string;
  device?: string;
  referrer?: string;
  language?: string;
  userAgent?: string;
}

interface AnalyticsData {
  snapp: Record<string, unknown>;
  metrics: {
    totalHits: number;
    totalUsed: number;
    usageCount: number;
    maxUsages: number | null;
    remainingUsages: number | null;
    countryBreakdown: BreakdownItem[];
    browserBreakdown: BreakdownItem[];
    osBreakdown: BreakdownItem[];
    deviceBreakdown: BreakdownItem[];
    referrerBreakdown: BreakdownItem[];
    timeline: Array<{ day: string; count: number }>;
    recentUsage: UsageEvent[];
    warning: string | null;
  };
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (typeof obj.slug === 'string') return obj.slug;
        if (typeof obj.name === 'string') return obj.name;
      }
      return null;
    })
    .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
}

export const UrlShortener: React.FC = () => {
  const [originalUrl, setOriginalUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [expiryHours, setExpiryHours] = useState(24);
  const [maxUsages, setMaxUsages] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdUrl, setCreatedUrl] = useState<ShortUrlResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedUrls, setSavedUrls] = useState<ShortUrlResponse[]>([]);

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsForId, setAnalyticsForId] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  const now = new Date();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(URLS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      const restored: ShortUrlResponse[] = parsed.map((item) => ({
        id: String(item.id ?? ''),
        shortcode: String(item.shortcode ?? ''),
        originalUrl: String(item.originalUrl ?? ''),
        expiresAt: typeof item.expiresAt === 'string' ? item.expiresAt : null,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        maxUsages: typeof item.maxUsages === 'number' ? item.maxUsages : null,
        notes: typeof item.notes === 'string' ? item.notes : null,
        tags: normalizeTags(item.tags),
        secret: null,
        hasSecret: Boolean(item.hasSecret),
        hit: typeof item.hit === 'number' ? item.hit : 0,
        used: typeof item.used === 'number' ? item.used : 0,
        shortUrl: typeof item.shortUrl === 'string' ? item.shortUrl : `https://farena.me/${String(item.shortcode ?? '')}`,
      })).filter((item) => item.id.length > 0 && item.shortcode.length > 0);

      setSavedUrls(restored);
    } catch {
      setSavedUrls([]);
    }
  }, []);

  const saveUrlsToStorage = (urls: ShortUrlResponse[]) => {
    const valid = urls.filter((url) => !url.expiresAt || new Date(url.expiresAt) > new Date());
    const safeForStorage = valid.map((url) => ({
      ...url,
      secret: null,
      hasSecret: url.hasSecret || Boolean(url.secret),
    }));
    localStorage.setItem(URLS_STORAGE_KEY, JSON.stringify(safeForStorage));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const loadAnalytics = async (id: string) => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    setAnalyticsForId(id);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/url-shortener/${id}/analytics?take=50`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to load analytics');
      }

      setAnalyticsData(payload.data as AnalyticsData);
    } catch (err) {
      setAnalyticsData(null);
      setAnalyticsError(err instanceof Error ? err.message : 'Unknown analytics error');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const createShortUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!originalUrl.trim()) {
      setError('Please enter a URL to shorten');
      return;
    }

    if (!isValidUrl(originalUrl)) {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    if (expiryHours <= 0 || expiryHours > 48) {
      setError('Expiry time must be between 1 and 48 hours');
      return;
    }

    if (maxUsages && Number(maxUsages) <= 0) {
      setError('Max usages must be greater than 0');
      return;
    }

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const tooShortTag = parsedTags.find((t) => t.length < 3);
    if (tooShortTag) {
      setError(`Tag "${tooShortTag}" is too short. Tags must be at least 3 characters.`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/url-shortener/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalUrl,
          customCode: customCode.trim() || undefined,
          expiryHours,
          maxUsages: maxUsages ? Number(maxUsages) : undefined,
          notes: notes.trim() || undefined,
          tags: parsedTags,
          secret: secret.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to create short URL');
      }

      const result = payload?.data ?? {};
      const normalizedTags = normalizeTags(result.tags ?? result.tag);

      const newUrl: ShortUrlResponse = {
        id: String(result.id),
        shortcode: String(result.shortcode),
        originalUrl: String(result.originalUrl ?? originalUrl),
        expiresAt: typeof result.expiresAt === 'string' ? result.expiresAt : null,
        createdAt: typeof result.createdAt === 'string' ? result.createdAt : new Date().toISOString(),
        maxUsages: typeof result.maxUsages === 'number' ? result.maxUsages : null,
        notes: typeof result.notes === 'string' ? result.notes : null,
        tags: normalizedTags,
        secret: null,
        hasSecret: Boolean(result.hasSecret || result.secret || secret),
        hit: typeof result.hit === 'number' ? result.hit : 0,
        used: typeof result.used === 'number' ? result.used : 0,
        shortUrl: typeof result.shortUrl === 'string' ? result.shortUrl : `https://farena.me/${String(result.shortcode)}`,
      };

      setCreatedUrl(newUrl);
      const updated = [newUrl, ...savedUrls.filter((u) => u.id !== newUrl.id)];
      setSavedUrls(updated);
      saveUrlsToStorage(updated);

      setOriginalUrl('');
      setCustomCode('');
      setExpiryHours(24);
      setMaxUsages('');
      setNotes('');
      setTags('');
      setSecret('');
      setSuccess('Short URL created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create short URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Zap className="w-8 h-8 text-brand-500" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-400 to-brand-500 bg-clip-text text-transparent">
              URL Shortener
            </h1>
          </div>
          <p className="text-slate-400">Docs-aligned URL creation with hashed secret support, tags, and usage analytics.</p>
        </div>

        <div className="grid gap-6">
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <form onSubmit={createShortUrl} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Long URL *</label>
                <Input
                  type="url"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  placeholder="https://example.com/very/long/url"
                  disabled={loading}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Custom Shortcode (optional)</label>
                  <Input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    maxLength={20}
                    placeholder="mycampaign"
                    disabled={loading}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Expiry (hours) *</label>
                  <Input
                    type="number"
                    min="1"
                    max="48"
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(Math.min(48, Math.max(1, Number(e.target.value) || 1)))}
                    disabled={loading}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Max Usages (optional)</label>
                  <Input
                    type="number"
                    min="1"
                    value={maxUsages}
                    onChange={(e) => setMaxUsages(e.target.value)}
                    placeholder="Leave empty for unlimited"
                    disabled={loading}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Secret (optional)</label>
                  <Input
                    type="text"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="protect-this-link"
                    disabled={loading}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tags (optional)</label>
                  <Input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="api, campaign, april"
                    disabled={loading}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes (optional)</label>
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={200}
                  placeholder="Short context for this link"
                  disabled={loading}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-500"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-black font-semibold py-2.5"
              >
                {loading ? 'Creating URL...' : 'Create Short URL'}
              </Button>
            </form>
          </Card>

          {error && (
            <Alert className="bg-red-900/20 border-red-800 text-red-200">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-emerald-900/20 border-emerald-800 text-emerald-200">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {createdUrl && (
            <Card className="p-6 bg-gradient-to-br from-slate-800/50 to-slate-700/50 border-slate-600">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Latest Created URL</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wide">Short URL</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={createdUrl.shortUrl || `https://farena.me/${createdUrl.shortcode}`}
                      readOnly
                      className="flex-1 bg-slate-700/50 border border-slate-600 rounded-md px-3 py-2 text-white text-sm font-mono"
                    />
                    <Button
                      onClick={() => copyToClipboard(createdUrl.shortUrl || `https://farena.me/${createdUrl.shortcode}`)}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-3"
                      size="sm"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => loadAnalytics(createdUrl.id)}
                      className="bg-blue-700 hover:bg-blue-600 text-white px-3"
                      size="sm"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="text-slate-300">ID: <span className="font-mono text-slate-200">{createdUrl.id}</span></div>
                  <div className="text-slate-300">Created: <span className="text-slate-200">{new Date(createdUrl.createdAt).toLocaleString()}</span></div>
                  <div className="text-slate-300">Expires: <span className="text-slate-200">{createdUrl.expiresAt ? new Date(createdUrl.expiresAt).toLocaleString() : 'Never'}</span></div>
                  <div className="text-slate-300">Usage: <span className="text-slate-200">{createdUrl.used ?? 0} / {createdUrl.maxUsages ?? 'Unlimited'}</span></div>
                </div>

                {(createdUrl.tags?.length || createdUrl.hasSecret || createdUrl.notes) && (
                  <div className="rounded border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-300 space-y-1">
                    {createdUrl.tags && createdUrl.tags.length > 0 && (
                      <p>Tags: <span className="text-brand-300">{createdUrl.tags.join(', ')}</span></p>
                    )}
                    {createdUrl.hasSecret && <p className="text-emerald-400">Secret: set</p>}
                    {createdUrl.notes && <p>Notes: {createdUrl.notes}</p>}
                  </div>
                )}

                {copied && (
                  <p className="text-sm text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Copied to clipboard
                  </p>
                )}
              </div>
            </Card>
          )}

          {savedUrls.length > 0 && (
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Saved Short URLs ({savedUrls.length})</h3>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {savedUrls.map((url) => {
                  const isExpired = url.expiresAt ? new Date(url.expiresAt) < now : false;
                  return (
                    <div
                      key={url.id}
                      className={`p-3 rounded-md border ${isExpired ? 'bg-slate-700/20 border-slate-700 opacity-70' : 'bg-slate-700/50 border-slate-600'}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-mono text-brand-400 truncate" title={url.shortUrl || `https://farena.me/${url.shortcode}`}>
                            {url.shortUrl || `https://farena.me/${url.shortcode}`}
                          </p>
                          <p className="text-xs text-slate-400 truncate" title={url.originalUrl}>→ {url.originalUrl}</p>
                          <p className="text-xs text-slate-500 mt-1">ID: {url.id}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600 text-white"
                            onClick={() => copyToClipboard(url.shortUrl || `https://farena.me/${url.shortcode}`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-blue-700 hover:bg-blue-600 text-white"
                            onClick={() => loadAnalytics(url.id)}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-900/30 hover:bg-red-900/50 text-red-300"
                            onClick={() => {
                              const updated = savedUrls.filter((item) => item.id !== url.id);
                              setSavedUrls(updated);
                              saveUrlsToStorage(updated);
                              if (analyticsForId === url.id) {
                                setAnalyticsForId(null);
                                setAnalyticsData(null);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Created: {new Date(url.createdAt).toLocaleString()}</span>
                        <span>Expires: {url.expiresAt ? new Date(url.expiresAt).toLocaleString() : 'Never'}</span>
                        <span>Used: {url.used ?? 0}</span>
                        <span>Limit: {url.maxUsages ?? 'Unlimited'}</span>
                        {url.hasSecret && <span className="text-emerald-400">Secret enabled</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {(analyticsLoading || analyticsError || analyticsData) && (
            <Card className="p-6 bg-slate-800/60 border-slate-600">
              <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-400" />
                URL Analytics {analyticsForId ? `(${analyticsForId})` : ''}
              </h3>

              {analyticsLoading && <p className="text-slate-300">Loading analytics...</p>}
              {analyticsError && <p className="text-red-300">{analyticsError}</p>}

              {analyticsData && !analyticsLoading && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
                      <p className="text-xs text-slate-400">Total Hits</p>
                      <p className="text-xl font-semibold text-slate-100">{analyticsData.metrics.totalHits}</p>
                    </div>
                    <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
                      <p className="text-xs text-slate-400">Total Used</p>
                      <p className="text-xl font-semibold text-slate-100">{analyticsData.metrics.totalUsed}</p>
                    </div>
                    <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
                      <p className="text-xs text-slate-400">Usage Events</p>
                      <p className="text-xl font-semibold text-slate-100">{analyticsData.metrics.usageCount}</p>
                    </div>
                    <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
                      <p className="text-xs text-slate-400">Remaining</p>
                      <p className="text-xl font-semibold text-slate-100">
                        {analyticsData.metrics.remainingUsages === null ? 'Unlimited' : analyticsData.metrics.remainingUsages}
                      </p>
                    </div>
                  </div>

                  {analyticsData.metrics.warning && (
                    <Alert className="bg-amber-900/20 border-amber-800 text-amber-200">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>{analyticsData.metrics.warning}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
                      <p className="text-sm font-medium text-slate-200 mb-2">Top Countries</p>
                      <div className="space-y-1 text-xs text-slate-300">
                        {analyticsData.metrics.countryBreakdown.slice(0, 8).map((row) => (
                          <div key={`country-${row.key}`} className="flex justify-between">
                            <span>{row.key}</span>
                            <span>{row.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
                      <p className="text-sm font-medium text-slate-200 mb-2">Top Browsers</p>
                      <div className="space-y-1 text-xs text-slate-300">
                        {analyticsData.metrics.browserBreakdown.slice(0, 8).map((row) => (
                          <div key={`browser-${row.key}`} className="flex justify-between">
                            <span>{row.key}</span>
                            <span>{row.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
                    <p className="text-sm font-medium text-slate-200 mb-2">Recent Usage</p>
                    <div className="max-h-64 overflow-auto">
                      <table className="w-full text-xs text-slate-300">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-700">
                            <th className="text-left py-1 pr-2">Time</th>
                            <th className="text-left py-1 pr-2">Country</th>
                            <th className="text-left py-1 pr-2">Browser</th>
                            <th className="text-left py-1 pr-2">OS</th>
                            <th className="text-left py-1 pr-2">Device</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsData.metrics.recentUsage.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-2 text-slate-500">No usage events found yet.</td>
                            </tr>
                          )}
                          {analyticsData.metrics.recentUsage.map((item) => (
                            <tr key={item.id} className="border-b border-slate-800/60">
                              <td className="py-1 pr-2">{item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}</td>
                              <td className="py-1 pr-2">{item.country || '-'}</td>
                              <td className="py-1 pr-2">{item.browser || '-'}</td>
                              <td className="py-1 pr-2">{item.os || '-'}</td>
                              <td className="py-1 pr-2">{item.device || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-brand-500" />
              How It Works
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>Paste your long URL and optionally set shortcode, secret, tags, notes, and limits.</li>
              <li>Secrets are hashed server-side before they are forwarded to the URL shortener API.</li>
              <li>Saved URLs persist locally right away and keep metadata for quick recall.</li>
              <li>Use the analytics button to pull metrics by URL ID via usage and snapp APIs.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};
