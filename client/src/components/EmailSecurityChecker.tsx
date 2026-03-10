import React, { useState } from 'react';
import { API_BASE } from '../hooks/useTerminalSession.js';

interface SecurityRecord {
  type: 'SPF' | 'DMARC' | 'DKIM';
  record: string;
  valid: boolean;
  details: {
    version?: string;
    policy?: string;
    includes?: string[];
    mechanisms?: string[];
    rua?: string;
    ruf?: string;
    selector?: string;
    errors?: string[];
  };
}

export const EmailSecurityChecker: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [results, setResults] = useState<SecurityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkDomain = async () => {
    if (!domain.trim()) {
      setError('Please enter a domain');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // First get TXT records for the domain
      const response = await fetch(`${API_BASE}/api/dns/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim(), types: ['TXT'] }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch DNS records');
      }

      const dnsData = await response.json();
      const txtRecords = dnsData.data?.TXT || [];

      // Analyze the records
      const analysis = analyzeEmailSecurity(txtRecords.flat());
      setResults(analysis);

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const analyzeEmailSecurity = (txtRecords: string[]): SecurityRecord[] => {
    const results: SecurityRecord[] = [];

    txtRecords.forEach(record => {
      const lower = record.toLowerCase();

      // SPF Analysis
      if (lower.startsWith('v=spf1')) {
        const spfResult: SecurityRecord = {
          type: 'SPF',
          record,
          valid: true,
          details: {
            version: 'spf1',
            mechanisms: [],
            includes: [],
            errors: []
          }
        };

        // Parse mechanisms
        const parts = record.split(' ');
        for (const part of parts) {
          if (part.startsWith('include:')) {
            spfResult.details.includes!.push(part.substring(8));
          } else if (!part.startsWith('v=') && part !== '') {
            spfResult.details.mechanisms!.push(part);
          }
        }

        // Basic validation
        if (!record.includes('v=spf1')) {
          spfResult.valid = false;
          spfResult.details.errors!.push('Missing v=spf1 version');
        }

        results.push(spfResult);
      }

      // DMARC Analysis
      else if (lower.startsWith('v=dmarc1')) {
        const dmarcResult: SecurityRecord = {
          type: 'DMARC',
          record,
          valid: true,
          details: {
            version: 'DMARC1',
            errors: []
          }
        };

        // Extract policy
        const policyMatch = record.match(/p=([^;\s]+)/);
        if (policyMatch) {
          dmarcResult.details.policy = policyMatch[1];
        }

        // Extract reporting addresses
        const ruaMatch = record.match(/rua=([^;\s]+)/);
        if (ruaMatch) {
          dmarcResult.details.rua = ruaMatch[1];
        }

        const rufMatch = record.match(/ruf=([^;\s]+)/);
        if (rufMatch) {
          dmarcResult.details.ruf = rufMatch[1];
        }

        // Basic validation
        if (!record.includes('v=DMARC1')) {
          dmarcResult.valid = false;
          dmarcResult.details.errors!.push('Missing v=DMARC1 version');
        }
        if (!dmarcResult.details.policy) {
          dmarcResult.valid = false;
          dmarcResult.details.errors!.push('Missing policy (p=)');
        }

        results.push(dmarcResult);
      }

      // DKIM Analysis (usually found at selector._domainkey.domain)
      else if (lower.includes('v=dkim1')) {
        const dkimResult: SecurityRecord = {
          type: 'DKIM',
          record,
          valid: true,
          details: {
            version: 'dkim1',
            errors: []
          }
        };

        // Extract selector from the domain we're checking
        // This is a simplified check - in reality DKIM records are at selector._domainkey.domain
        const selectorMatch = record.match(/s=([^;\s]+)/);
        if (selectorMatch) {
          dkimResult.details.selector = selectorMatch[1];
        }

        // Basic validation
        if (!record.includes('v=DKIM1')) {
          dkimResult.valid = false;
          dkimResult.details.errors!.push('Missing v=DKIM1 version');
        }

        results.push(dkimResult);
      }
    });

    return results;
  };

  const getSecurityScore = () => {
    if (results.length === 0) return 0;

    let score = 0;
    const hasSPF = results.some(r => r.type === 'SPF' && r.valid);
    const hasDMARC = results.some(r => r.type === 'DMARC' && r.valid);
    const hasDKIM = results.some(r => r.type === 'DKIM' && r.valid);

    if (hasSPF) score += 33;
    if (hasDMARC) score += 34;
    if (hasDKIM) score += 33;

    return score;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-lg">
        <h3 className="text-white text-2xl font-semibold mb-6">Email Security Checker</h3>

        <div className="mb-6">
          <div className="flex gap-2">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="flex-1 bg-slate-800/40 text-white px-4 py-3 rounded-md"
            />
            <button
              onClick={checkDomain}
              disabled={loading}
              className="px-6 py-3 bg-brand-600 rounded-md text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Security'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-red-400 bg-red-900/20 p-3 rounded">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            {/* Security Score */}
            <div className="bg-slate-800/40 p-4 rounded">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-semibold">Security Score</h4>
                <span className="text-2xl font-bold text-white">{getSecurityScore()}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${getSecurityScore()}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Based on presence of valid SPF, DMARC, and DKIM records
              </div>
            </div>

            {/* Individual Records */}
            {results.map((result, index) => (
              <div key={index} className="bg-slate-800/40 p-4 rounded">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-3 h-3 rounded-full ${result.valid ? 'bg-green-500' : 'bg-red-500'}`} />
                  <h4 className="text-white font-semibold">{result.type} Record</h4>
                  <span className={`text-xs px-2 py-1 rounded ${result.valid ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                    {result.valid ? 'Valid' : 'Invalid'}
                  </span>
                </div>

                <div className="bg-slate-900/50 p-3 rounded mb-3">
                  <div className="text-xs text-slate-400 mb-1">Raw Record:</div>
                  <div className="text-sm text-white font-mono break-all">{result.record}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.details.policy && (
                    <div>
                      <div className="text-xs text-slate-400">Policy</div>
                      <div className="text-sm text-white">{result.details.policy}</div>
                    </div>
                  )}

                  {result.details.includes && result.details.includes.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-400">Includes</div>
                      <div className="text-sm text-white">{result.details.includes.join(', ')}</div>
                    </div>
                  )}

                  {result.details.mechanisms && result.details.mechanisms.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-400">Mechanisms</div>
                      <div className="text-sm text-white">{result.details.mechanisms.join(', ')}</div>
                    </div>
                  )}

                  {result.details.rua && (
                    <div>
                      <div className="text-xs text-slate-400">Aggregate Reports</div>
                      <div className="text-sm text-white break-all">{result.details.rua}</div>
                    </div>
                  )}

                  {result.details.ruf && (
                    <div>
                      <div className="text-xs text-slate-400">Forensic Reports</div>
                      <div className="text-sm text-white break-all">{result.details.ruf}</div>
                    </div>
                  )}

                  {result.details.selector && (
                    <div>
                      <div className="text-xs text-slate-400">Selector</div>
                      <div className="text-sm text-white">{result.details.selector}</div>
                    </div>
                  )}
                </div>

                {result.details.errors && result.details.errors.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-red-400 mb-1">Errors:</div>
                    <ul className="text-xs text-red-300 list-disc list-inside">
                      {result.details.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {/* Recommendations */}
            <div className="bg-slate-800/40 p-4 rounded">
              <h4 className="text-white font-semibold mb-3">Recommendations</h4>
              <div className="space-y-2 text-sm text-slate-300">
                {!results.some(r => r.type === 'SPF' && r.valid) && (
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    <span>Add SPF record to prevent email spoofing</span>
                  </div>
                )}
                {!results.some(r => r.type === 'DMARC' && r.valid) && (
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Add DMARC record for better email authentication and reporting</span>
                  </div>
                )}
                {!results.some(r => r.type === 'DKIM' && r.valid) && (
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Configure DKIM signing for your email domain</span>
                  </div>
                )}
                {results.some(r => r.type === 'SPF' && r.valid) &&
                 results.some(r => r.type === 'DMARC' && r.valid) &&
                 results.some(r => r.type === 'DKIM' && r.valid) && (
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Excellent! Your domain has comprehensive email security</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailSecurityChecker;