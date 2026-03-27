import React, { useState, useCallback } from 'react';
import {
  Play,
  Download,
  Share2,
  Zap,
  XCircle,
  Clock,
  History,
  Layers,
  Activity,
  AlertCircle,
} from 'lucide-react';

interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  headers: string;
  body: string;
  requestsPerMinute: number;
  durationSeconds: number;
}

interface TestResult {
  requestNumber: number;
  timestamp: number;
  status: number | null;
  latency: number;
  success: boolean;
  error?: string;
  retryAfter?: number;
}

interface Stats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  stdDevLatency: number;
  varianceLatency: number;
  medianLatency: number;
  p25Latency: number;
  p50Latency: number;
  p75Latency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  p99_9Latency: number;
  requestsPerSecond: number;
  totalTestDuration: number;
  errorDistribution: Record<string, number>;
  mostCommonError: { error: string; count: number } | null;
  statusCodeDistribution: Record<number, number>;
  stdDevCount: number;
  outlierCount: number;
  outlierPercentage: number;
  latencyTrend: 'improving' | 'stable' | 'degrading';
  timeToFirstFailureMs: number | null;
  meanTimeToFailureMs: number | null;
  retryAfterHeaders: number[];
  latencyHistogram: Array<{ bucket: string; count: number }>;
}

interface TestResponse {
  testId: string;
  results: TestResult[];
  stats: Stats;
  duration: number;
}

const RateLimitTester: React.FC = () => {
  const [config, setConfig] = useState<RequestConfig>({
    url: 'https://httpbin.tools.fairarena.app/post',
    method: 'POST',
    headers: 'Content-Type: application/json',
    body: '{"test": "data"}',
    requestsPerMinute: 30,
    durationSeconds: 30,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [testData, setTestData] = useState<TestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'latency' | 'errors' | 'distribution' | 'details'>(
    'latency',
  );
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe number formatter
  const safeNum = (val: any, decimals = 2) => {
    const num = Number(val) || 0;
    return num.toFixed(decimals);
  };

  const runTest = useCallback(async () => {
    if (!config.url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTestData(null);

    try {
      const headers: Record<string, string> = {};
      config.headers.split('\n').forEach((line) => {
        const [key, value] = line.split(':').map((s) => s.trim());
        if (key && value) {
          headers[key] = value;
        }
      });

      const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
      const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/rate-limit/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: config.url,
          method: config.method,
          headers,
          body: config.body,
          requestsPerMinute: config.requestsPerMinute,
          durationSeconds: config.durationSeconds,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Test failed');
      }

      const data = (await response.json()) as TestResponse;
      setTestData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  const downloadResults = useCallback(
    (format: 'csv' | 'json' = 'csv') => {
      if (!testData) return;

      if (format === 'json') {
        const json = JSON.stringify(testData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rate-limit-test-${testData.testId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const csv = [
          [
            'Request #',
            'Timestamp',
            'Status',
            'Latency (ms)',
            'Success',
            'Error',
            'Retry-After',
          ].join(','),
          ...testData.results.map((r) =>
            [
              r.requestNumber,
              new Date(r.timestamp).toISOString(),
              r.status || 'ERROR',
              r.latency.toFixed(2),
              r.success ? 'Yes' : 'No',
              r.error ? `"${r.error}"` : '',
              r.retryAfter || '',
            ].join(','),
          ),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rate-limit-test-${testData.testId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [testData],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Zap className="w-8 h-8 text-brand-500" />
            Rate Limit Tester
          </h1>
          <p className="text-neutral-400 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-500/40" />
            Test API endpoints for rate limiting behavior and resilience metrics
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Configuration (Sticky) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 bg-neutral-800/40 border border-neutral-700/50 rounded-xl p-6 space-y-5">
              <h2 className="text-lg font-semibold text-white">Configuration</h2>

              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Target URL
                </label>
                <input
                  type="text"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://api.example.com/webhook"
                  className="w-full px-4 py-3 bg-neutral-900/60 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                  disabled={isLoading}
                />
              </div>

              {/* Method Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  HTTP Method
                </label>
                <select
                  value={config.method}
                  onChange={(e) =>
                    setConfig({ ...config, method: e.target.value as RequestConfig['method'] })
                  }
                  className="w-full px-4 py-3 bg-neutral-900/60 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                  disabled={isLoading}
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                  <option>HEAD</option>
                </select>
              </div>

              {/* Rate Slider */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Request Rate:{' '}
                  <span className="font-bold text-brand-400">
                    {config.requestsPerMinute} req/min
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={config.requestsPerMinute}
                  onChange={(e) =>
                    setConfig({ ...config, requestsPerMinute: parseInt(e.target.value) })
                  }
                  className="w-full h-2 bg-neutral-700/50 accent-brand-500 rounded-lg appearance-none cursor-pointer"
                  disabled={isLoading}
                />
                <div className="text-xs text-neutral-400 mt-1">
                  Estimated: {Math.ceil((config.requestsPerMinute / 60) * config.durationSeconds)}{' '}
                  total requests
                </div>
              </div>

              {/* Duration Slider */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Test Duration:{' '}
                  <span className="font-bold text-brand-400">{config.durationSeconds}s</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="600"
                  value={config.durationSeconds}
                  onChange={(e) =>
                    setConfig({ ...config, durationSeconds: parseInt(e.target.value) })
                  }
                  className="w-full h-2 bg-neutral-700/50 accent-brand-500 rounded-lg appearance-none cursor-pointer"
                  disabled={isLoading}
                />
                <div className="text-xs text-neutral-400 mt-1">Max 10 minutes</div>
              </div>

              {/* Headers */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Headers</label>
                <textarea
                  value={config.headers}
                  onChange={(e) => setConfig({ ...config, headers: e.target.value })}
                  placeholder="Content-Type: application/json&#10;Authorization: Bearer token"
                  className="w-full h-24 px-3 py-2 bg-neutral-900/60 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-xs transition"
                  disabled={isLoading}
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Request Body
                </label>
                <textarea
                  value={config.body}
                  onChange={(e) => setConfig({ ...config, body: e.target.value })}
                  placeholder='{"key": "value"}'
                  className="w-full h-24 px-3 py-2 bg-neutral-900/60 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-xs transition"
                  disabled={isLoading}
                />
              </div>

              {/* Start Button */}
              <button
                onClick={runTest}
                disabled={isLoading || !config.url.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 hover:bg-brand-400 disabled:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-900 font-bold rounded-xl transition-all shadow-lg shadow-brand-500/10"
              >
                <Play className="w-4 h-4" />
                {isLoading ? 'Testing...' : 'Start Test'}
              </button>

              {/* Share Button */}
              {testData && (
                <button
                  onClick={() => {
                    const url = `${window.location.origin}?rate-test=${encodeURIComponent(JSON.stringify(config))}`;
                    copyToClipboard(url);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-200 font-medium rounded-lg transition"
                >
                  <Share2 className="w-4 h-4" />
                  {copied ? 'Link Copied' : 'Share Configuration'}
                </button>
              )}
            </div>
          </div>

          {/* Right Content - Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Error State */}
            {error && (
              <div className="bg-red-500/10 border-l-4 border-red-500 rounded-xl p-4 flex items-start gap-3 backdrop-blur-md mb-6 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-400 font-bold text-sm tracking-tight">Request Failed</p>
                  <p className="text-red-300/80 text-xs mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Results */}
            {testData && (
              <>
                {/* Header Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard
                    label="Success Rate"
                    value={safeNum(testData.stats.successRate, 1)}
                    unit="%"
                    subtext={`${testData.stats.successful}/${testData.stats.total}`}
                    color={testData.stats.successRate > 95 ? 'brand' : 'neutral'}
                  />
                  <MetricCard
                    label="Requests/sec"
                    value={safeNum(testData.stats.requestsPerSecond, 2)}
                    unit="req/s"
                    subtext={`${safeNum(testData.stats.totalTestDuration, 1)}s duration`}
                    color="brand"
                  />
                  <MetricCard
                    label="Avg Latency"
                    value={safeNum(testData.stats.avgLatency, 0)}
                    unit="ms"
                    subtext={`σ: ${safeNum(testData.stats.stdDevLatency || testData.stats.avgLatency * 0.1, 0)}ms`}
                    color="neutral"
                  />
                  <MetricCard
                    label="Latency Trend"
                    value={
                      testData.stats.latencyTrend === 'improving' ? (
                        <Zap className="w-5 h-5 text-brand-500" />
                      ) : testData.stats.latencyTrend === 'degrading' ? (
                        <XCircle className="w-5 h-5 text-neutral-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-neutral-500" />
                      )
                    }
                    unit={testData.stats.latencyTrend ?? 'stable'}
                    subtext={
                      (testData.stats.latencyTrend ?? 'stable').charAt(0).toUpperCase() +
                      (testData.stats.latencyTrend ?? 'stable').slice(1)
                    }
                    color={testData.stats.latencyTrend === 'improving' ? 'brand' : 'neutral'}
                  />
                </div>

                {/* Tabs for different data sections */}
                <div className="bg-neutral-800/40 border border-neutral-700/50 rounded-xl overflow-hidden">
                  <div className="flex flex-wrap gap-2 bg-neutral-900/50 p-3 border-b border-neutral-700/50">
                    <TabButton
                      tab="latency"
                      currentTab={activeTab}
                      onClick={() => setActiveTab('latency')}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Latency Analytics
                    </TabButton>
                    <TabButton
                      tab="errors"
                      currentTab={activeTab}
                      onClick={() => setActiveTab('errors')}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Error Analysis
                    </TabButton>
                    <TabButton
                      tab="distribution"
                      currentTab={activeTab}
                      onClick={() => setActiveTab('distribution')}
                    >
                      <Layers className="w-4 h-4 mr-2" />
                      Distribution
                    </TabButton>
                    <TabButton
                      tab="details"
                      currentTab={activeTab}
                      onClick={() => setActiveTab('details')}
                    >
                      <History className="w-4 h-4 mr-2" />
                      Request Details
                    </TabButton>
                  </div>

                  <div className="p-5">
                    {/* Latency Analytics Tab */}
                    {activeTab === 'latency' && (
                      <div className="space-y-6">
                        {/* Latency Percentiles Grid */}
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-4">
                            Percentile Breakdown
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                              {
                                label: 'Min',
                                value: testData.stats.minLatency || 0,
                                color: 'brand',
                              },
                              {
                                label: 'P25',
                                value: testData.stats.p25Latency || 0,
                                color: 'brand',
                              },
                              {
                                label: 'Median (P50)',
                                value: testData.stats.p50Latency || 0,
                                color: 'neutral',
                              },
                              {
                                label: 'P75',
                                value: testData.stats.p75Latency || 0,
                                color: 'neutral',
                              },
                              {
                                label: 'P90',
                                value: testData.stats.p90Latency || 0,
                                color: 'amber',
                              },
                              {
                                label: 'P95',
                                value: testData.stats.p95Latency || 0,
                                color: 'amber',
                              },
                              {
                                label: 'P99',
                                value: testData.stats.p99Latency || 0,
                                color: 'orange',
                              },
                              {
                                label: 'P99.9',
                                value: testData.stats.p99_9Latency || 0,
                                color: 'red',
                              },
                            ].map((p) => (
                              <div
                                key={p.label}
                                className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-700/50"
                              >
                                <div className="text-xs text-neutral-400 mb-1">{p.label}</div>
                                <div
                                  className={`text-lg font-bold ${p.color === 'brand' ? 'text-brand-500' : 'text-neutral-400'}`}
                                >
                                  {safeNum(p.value, 1)}ms
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Statistical Summary */}
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-4">
                            Statistical Summary
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <StatRow
                              label="Mean"
                              value={safeNum(testData.stats.avgLatency || 0, 2)}
                              unit="ms"
                            />
                            <StatRow
                              label="Std Dev"
                              value={safeNum(testData.stats.stdDevLatency || 0, 2)}
                              unit="ms"
                            />
                            <StatRow
                              label="Variance"
                              value={safeNum(testData.stats.varianceLatency || 0, 2)}
                              unit="ms²"
                            />
                            <StatRow
                              label="Min"
                              value={safeNum(testData.stats.minLatency || 0, 2)}
                              unit="ms"
                            />
                            <StatRow
                              label="Max"
                              value={safeNum(testData.stats.maxLatency || 0, 2)}
                              unit="ms"
                            />
                            <StatRow
                              label="Range"
                              value={safeNum(
                                (testData.stats.maxLatency || 0) - (testData.stats.minLatency || 0),
                                2,
                              )}
                              unit="ms"
                            />
                          </div>
                        </div>

                        {/* Latency Histogram */}
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-4">
                            Response Time Distribution
                          </h3>
                          <div className="space-y-2">
                            {testData.stats.latencyHistogram.map((h) => (
                              <div key={h.bucket} className="flex items-center gap-3">
                                <div className="w-32 text-xs text-neutral-400 flex-shrink-0">
                                  {h.bucket}
                                </div>
                                <div className="flex-grow bg-neutral-900/50 rounded h-6 overflow-hidden">
                                  <div
                                    className="bg-brand-500 h-full transition-all"
                                    style={{
                                      width: `${testData.stats.total > 0 ? (h.count / testData.stats.total) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                                <div className="w-12 text-right text-xs text-neutral-300">
                                  {h.count}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Outlier Analysis */}
                        <div className="bg-neutral-900/50 p-4 rounded-lg border border-neutral-700/50">
                          <h3 className="text-sm font-semibold text-white mb-3">
                            Outlier Analysis
                          </h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <div className="text-xs text-neutral-400 mb-1">Outlier Count</div>
                              <div className="text-2xl font-bold text-orange-400">
                                {testData.stats.outlierCount || 0}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-neutral-400 mb-1">Outlier %</div>
                              <div className="text-2xl font-bold text-orange-400">
                                {safeNum(testData.stats.outlierPercentage || 0, 2)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-neutral-400 mb-1">
                                Upper Bound (μ + 2σ)
                              </div>
                              <div className="text-lg font-bold text-neutral-300">
                                {safeNum(
                                  (testData.stats.avgLatency || 0) +
                                    2 * (testData.stats.stdDevLatency || 0),
                                  0,
                                )}
                                ms
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Latency Trend Chart */}
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-4">
                            Latency Trend Over Time
                          </h3>
                          <LatencyChart results={testData.results} />
                        </div>
                      </div>
                    )}

                    {/* Error Analysis Tab */}
                    {activeTab === 'errors' && (
                      <div className="space-y-6">
                        {/* Error Summary */}
                        <div className="grid grid-cols-2 gap-4">
                          <MetricCard
                            label="Failed Requests"
                            value={testData.stats.failed || 0}
                            unit=""
                            subtext={`${testData.stats.failed === 0 ? '✓ No errors' : `${safeNum(((testData.stats.failed || 0) / (testData.stats.total || 1)) * 100, 1)}% failure rate`}`}
                            color={testData.stats.failed === 0 ? 'brand' : 'neutral'}
                          />
                          <MetricCard
                            label="Most Common Error"
                            value={
                              testData.stats.mostCommonError?.error
                                .split(':')[0]
                                .substring(0, 20) || 'None'
                            }
                            unit={
                              testData.stats.mostCommonError
                                ? `×${testData.stats.mostCommonError.count}`
                                : ''
                            }
                            subtext={
                              testData.stats.mostCommonError
                                ? testData.stats.mostCommonError.error.substring(0, 50)
                                : 'All requests succeeded'
                            }
                            color={testData.stats.failed === 0 ? 'brand' : 'neutral'}
                          />
                        </div>

                        {/* Time to Failure Metrics */}
                        {testData.stats.timeToFirstFailureMs !== null &&
                          testData.stats.timeToFirstFailureMs !== undefined && (
                            <div className="bg-neutral-900/50 p-4 rounded-lg border border-red-700/50">
                              <h3 className="text-sm font-semibold text-red-300 mb-3">
                                ⚡ Time to First Failure
                              </h3>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-xs text-neutral-400 mb-1">
                                    First Failure At
                                  </div>
                                  <div className="text-xl font-bold text-red-400">
                                    {safeNum((testData.stats.timeToFirstFailureMs || 0) / 1000, 2)}s
                                  </div>
                                </div>
                                {testData.stats.meanTimeToFailureMs !== null &&
                                  testData.stats.meanTimeToFailureMs !== undefined && (
                                    <div>
                                      <div className="text-xs text-neutral-400 mb-1">
                                        Mean Time Between Failures
                                      </div>
                                      <div className="text-xl font-bold text-red-400">
                                        {safeNum(
                                          (testData.stats.meanTimeToFailureMs || 0) / 1000,
                                          2,
                                        )}
                                        s
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          )}

                        {/* Error Distribution */}
                        {Object.keys(testData.stats.errorDistribution).length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-white mb-4">
                              Error Distribution
                            </h3>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {Object.entries(testData.stats.errorDistribution)
                                .sort((a, b) => b[1] - a[1])
                                .map(([error, count]) => (
                                  <div
                                    key={error}
                                    className="flex items-start gap-3 p-3 bg-neutral-900/50 rounded border border-neutral-700/50"
                                  >
                                    <div className="flex-grow min-w-0">
                                      <div className="text-sm font-mono text-red-300 break-words">
                                        {error}
                                      </div>
                                      <div className="text-xs text-neutral-400 mt-1">
                                        Count: {count} (
                                        {safeNum((count / (testData.stats.failed || 1)) * 100, 1)}%)
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {testData.stats.failed === 0 && (
                          <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-4 text-center">
                            <p className="text-brand-500 font-medium">✓ All requests succeeded!</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Distribution Tab */}
                    {activeTab === 'distribution' && (
                      <div className="space-y-6">
                        {/* Status Code Distribution */}
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-4">
                            Status Code Distribution
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(testData.stats.statusCodeDistribution)
                              .sort((a, b) => b[1] - a[1])
                              .map(([status, count]) => (
                                <div
                                  key={status}
                                  className="bg-neutral-900/50 p-4 rounded-lg border border-neutral-700/50 text-center"
                                >
                                  <div
                                    className={`text-2xl font-bold ${status.startsWith('2') ? 'text-brand-500' : 'text-neutral-400'}`}
                                  >
                                    {status === '0' ? 'ERROR' : status}
                                  </div>
                                  <div className="text-sm text-neutral-400 mt-1">
                                    {count} requests
                                  </div>
                                  <div className="text-xs text-neutral-500">
                                    {safeNum((count / (testData.stats.total || 1)) * 100, 1)}%
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Grouping by Success/Failure */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-brand-500/10 p-4 rounded-lg border border-brand-500/20 text-center">
                            <div className="text-3xl font-bold text-brand-500">
                              {testData.stats.successful}
                            </div>
                            <div className="text-sm text-brand-500 mt-1">Successful</div>
                            <div className="text-xs text-neutral-400 mt-1">
                              {safeNum(
                                (testData.stats.successful / (testData.stats.total || 1)) * 100,
                                1,
                              )}
                              %
                            </div>
                          </div>
                          <div className="bg-red-900/20 p-4 rounded-lg border border-red-700/50 text-center">
                            <div className="text-3xl font-bold text-red-400">
                              {testData.stats.failed}
                            </div>
                            <div className="text-sm text-red-300 mt-1">Failed</div>
                            <div className="text-xs text-neutral-400 mt-1">
                              {safeNum(
                                (testData.stats.failed / (testData.stats.total || 1)) * 100,
                                1,
                              )}
                              %
                            </div>
                          </div>
                          <div className="bg-neutral-900/20 p-4 rounded-lg border border-neutral-700/50 text-center">
                            <div className="text-3xl font-bold text-neutral-100">
                              {testData.stats.total}
                            </div>
                            <div className="text-sm text-neutral-300 mt-1">Total</div>
                            <div className="text-xs text-neutral-400 mt-1">100%</div>
                          </div>
                        </div>

                        {/* Retry-After Detection */}
                        {testData.stats.retryAfterHeaders.length > 0 && (
                          <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
                            <p className="text-amber-300 font-semibold mb-2 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Retry-After Headers Detected
                            </p>
                            <div className="text-sm text-amber-200">
                              Found in responses:{' '}
                              {testData.stats.retryAfterHeaders.map((h) => `${h}s`).join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Request Details Tab */}
                    {activeTab === 'details' && (
                      <div className="space-y-4">
                        <div className="flex gap-2 items-center mb-4">
                          <input
                            type="text"
                            placeholder="Filter by error message..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="px-3 py-2 bg-neutral-900/60 border border-neutral-700 rounded-lg text-sm text-neutral-300 placeholder-neutral-500 flex-grow"
                          />
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 bg-neutral-900/60 border border-neutral-700 rounded-lg text-sm text-neutral-300"
                          >
                            <option value="">All Status</option>
                            <option value="success">Success</option>
                            <option value="error">Errors</option>
                          </select>
                        </div>

                        <div className="max-h-96 overflow-y-auto space-y-1">
                          {testData.results
                            .filter((r) => {
                              if (filterStatus === 'success' && !r.success) return false;
                              if (filterStatus === 'error' && r.success) return false;
                              if (
                                filterText &&
                                !r.error?.toLowerCase().includes(filterText.toLowerCase())
                              )
                                return false;
                              return true;
                            })
                            .map((result, idx) => (
                              <div
                                key={idx}
                                className={`px-3 py-2 rounded text-xs font-mono border ${
                                  result.success
                                    ? 'bg-neutral-900/20 text-brand-300 border-neutral-900/50'
                                    : 'bg-neutral-900/20 text-neutral-500 border-neutral-800'
                                }`}
                              >
                                <span className="font-bold">#{result.requestNumber}</span>{' '}
                                {result.status || 'ERROR'} {safeNum(result.latency || 0, 1)}ms{' '}
                                {result.error && ` - ${result.error}`}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => downloadResults('csv')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-200 font-medium rounded-lg transition"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => downloadResults('json')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-200 font-medium rounded-lg transition"
                  >
                    <Download className="w-4 h-4" />
                    Export JSON
                  </button>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}?rate-test=${encodeURIComponent(JSON.stringify(config))}`;
                      copyToClipboard(url);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-200 font-medium rounded-lg transition"
                  >
                    <Share2 className="w-4 h-4" />
                    {copied ? 'Link Copied' : 'Share'}
                  </button>
                </div>
              </>
            )}

            {/* Empty State */}
            {!testData && !isLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-neutral-900/40 border border-neutral-800/50 rounded-2xl backdrop-blur-sm w-full">
                <div className="w-20 h-20 rounded-full bg-brand-500/5 ring-1 ring-brand-500/20 mb-6 flex items-center justify-center">
                  <Zap className="w-10 h-10 text-brand-500/40" />
                </div>
                <h3 className="text-xl font-bold text-neutral-200 mb-2">No Test Data</h3>
                <p className="text-sm text-neutral-500 max-w-sm leading-relaxed mb-6">
                  Start an automated rate-limit test to analyze endpoint performance and resilience
                  metrics.
                </p>
                <div className="bg-neutral-800/40 border border-neutral-700/50 rounded-lg p-4 text-left text-sm text-neutral-300 space-y-2">
                  <p>
                    <strong>💡 Tip:</strong> Test with public APIs like:
                  </p>
                  <code className="block bg-neutral-900 px-3 py-2 rounded text-xs text-neutral-200">
                    https://httpbin.tools.fairarena.app/post
                  </code>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="flex items-center justify-center w-12 h-12 mb-4">
                  <div className="w-10 h-10 border-4 border-neutral-700 border-t-brand-500 rounded-full animate-spin" />
                </div>
                <p className="text-neutral-300 font-medium">Running tests...</p>
                <p className="text-neutral-500 text-sm">This may take a few moments</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  unit: string;
  subtext: string;
  color: 'green' | 'red' | 'yellow' | 'blue' | 'slate' | 'brand' | 'neutral';
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit, subtext, color }) => {
  const colorClasses = {
    brand: 'text-brand-500 border-brand-500/20 bg-brand-500/5',
    green: 'text-brand-500 border-brand-500/20 bg-brand-500/5',
    red: 'text-neutral-400 border-neutral-800 bg-neutral-900/10',
    yellow: 'text-neutral-300 border-neutral-800 bg-neutral-900/10',
    blue: 'text-brand-500 border-brand-500/20 bg-brand-500/5',
    slate: 'text-neutral-400 border-neutral-700/30 bg-neutral-900/10',
    neutral: 'text-neutral-300 border-neutral-700/30 bg-neutral-900/10',
  };

  return (
    <div
      className={`bg-neutral-800/40 border border-neutral-700/50 rounded-xl p-4 ${colorClasses[color]}`}
    >
      <p className="text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold">
        {value}
        <span className="text-sm ml-1">{unit}</span>
      </p>
      <p className="text-xs text-neutral-500 mt-1">{subtext}</p>
    </div>
  );
};

// Latency Chart Component
interface LatencyChartProps {
  results: TestResult[];
}

const LatencyChart: React.FC<LatencyChartProps> = ({ results }) => {
  if (results.length === 0) return <div className="text-sm text-neutral-400">No results yet</div>;

  // Show every nth result to avoid crowding (max 100 bars)
  const step = Math.max(1, Math.floor(results.length / 100));
  const displayResults = results.filter((_, i) => i % step === 0);
  const maxLatency = Math.max(...results.map((r) => r.latency), 1);
  const avgLatency = results.reduce((a, b) => a + b.latency, 0) / results.length;

  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-40 bg-neutral-900/30 p-4 rounded-lg overflow-x-auto">
        {displayResults.map((result, idx) => {
          // Color based on latency relative to average
          let color = 'bg-brand-500'; // Success
          if (result.latency > avgLatency * 1.5) color = 'bg-brand-400'; // Muted brand
          if (result.latency > avgLatency * 2) color = 'bg-neutral-600'; // Neutral
          if (!result.success) color = 'bg-neutral-800'; // Neutral dark

          return (
            <div
              key={idx}
              className={`flex-1 min-w-1 rounded-t ${color}`}
              style={{
                height: `${Math.max((result.latency / maxLatency) * 100, 2)}%`,
                opacity: 0.7 + (result.latency / maxLatency) * 0.3,
              }}
              title={`#${result.requestNumber}: ${(result.latency || 0).toFixed(1)}ms ${result.success ? '✓' : '✗'}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-xs text-neutral-400">
        <div>Avg: {(avgLatency || 0).toFixed(1)}ms</div>
        <div>Max: {(maxLatency || 0).toFixed(1)}ms</div>
        <div>
          Showing {displayResults.length} of {results.length} requests
        </div>
      </div>
    </div>
  );
};

export default RateLimitTester;

// Tab Button Component
interface TabButtonProps {
  tab: string;
  currentTab: string;
  onClick: () => void;
  children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ tab, currentTab, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center transition-all ${
      currentTab === tab
        ? 'bg-brand-500 text-neutral-950 shadow-lg shadow-brand-500/20'
        : 'bg-neutral-800/40 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
    }`}
  >
    {children}
  </button>
);

// Stat Row Component
interface StatRowProps {
  label: string;
  value: string | number;
  unit: string;
}

const StatRow: React.FC<StatRowProps> = ({ label, value, unit }) => (
  <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-700/50">
    <div className="text-xs text-neutral-400 mb-1">{label}</div>
    <div className="text-lg font-bold text-neutral-200">
      {value}
      <span className="text-sm ml-1 text-neutral-400">{unit}</span>
    </div>
  </div>
);
