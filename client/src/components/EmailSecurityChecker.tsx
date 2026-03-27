import React, { useState } from 'react';
import { API_BASE } from '../hooks/useTerminalSession.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Mail, AlertCircle, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

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

    txtRecords.forEach((record) => {
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
            errors: [],
          },
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
            errors: [],
          },
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
            errors: [],
          },
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
    const hasSPF = results.some((r) => r.type === 'SPF' && r.valid);
    const hasDMARC = results.some((r) => r.type === 'DMARC' && r.valid);
    const hasDKIM = results.some((r) => r.type === 'DKIM' && r.valid);

    if (hasSPF) score += 33;
    if (hasDMARC) score += 34;
    if (hasDKIM) score += 33;

    return score;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shadow-lg shadow-brand-500/10">
              <Mail className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <CardTitle>Email Security Checker</CardTitle>
              <p className="text-muted-foreground text-sm">
                Analyze SPF, DMARC, and DKIM records for a domain
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Domain input */}
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <div className="flex gap-2">
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                onKeyDown={(e) => e.key === 'Enter' && checkDomain()}
              />
              <Button onClick={checkDomain} disabled={loading}>
                {loading ? 'Checking...' : 'Check Security'}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              {/* Security Score */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-brand-400" />
                      <h4 className="font-semibold">Security Score</h4>
                    </div>
                    <span className="text-2xl font-bold">{getSecurityScore()}%</span>
                  </div>
                  <div className="w-full bg-neutral-800 rounded-full h-2">
                    <div
                      className="bg-brand-500 shadow-[0_0_8px_rgba(217,255,0,0.4)] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${getSecurityScore()}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Based on presence of valid SPF, DMARC, and DKIM records
                  </p>
                </CardContent>
              </Card>

              {/* Individual Records */}
              {results.map((result, index) => (
                <Card key={index}>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3">
                      {result.valid ? (
                        <CheckCircle2 className="w-5 h-5 text-brand-500 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-neutral-500 shrink-0" />
                      )}
                      <h4 className="font-semibold">{result.type} Record</h4>
                      <Badge
                        variant={result.valid ? 'default' : 'destructive'}
                        className="text-xs ml-auto"
                      >
                        {result.valid ? 'Valid' : 'Invalid'}
                      </Badge>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Raw Record</div>
                      <div className="text-sm text-neutral-300 font-mono break-all">
                        {result.record}
                      </div>
                    </div>

                    {(result.details.policy ||
                      result.details.includes?.length ||
                      result.details.mechanisms?.length ||
                      result.details.rua ||
                      result.details.ruf ||
                      result.details.selector) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {result.details.policy && (
                          <div className="space-y-0.5">
                            <div className="text-xs text-muted-foreground">Policy</div>
                            <div className="text-sm font-mono">{result.details.policy}</div>
                          </div>
                        )}
                        {result.details.includes && result.details.includes.length > 0 && (
                          <div className="space-y-0.5">
                            <div className="text-xs text-muted-foreground">Includes</div>
                            <div className="text-sm font-mono">
                              {result.details.includes.join(', ')}
                            </div>
                          </div>
                        )}
                        {result.details.mechanisms && result.details.mechanisms.length > 0 && (
                          <div className="space-y-0.5">
                            <div className="text-xs text-muted-foreground">Mechanisms</div>
                            <div className="text-sm font-mono">
                              {result.details.mechanisms.join(', ')}
                            </div>
                          </div>
                        )}
                        {result.details.rua && (
                          <div className="space-y-0.5">
                            <div className="text-xs text-muted-foreground">Aggregate Reports</div>
                            <div className="text-sm font-mono break-all">{result.details.rua}</div>
                          </div>
                        )}
                        {result.details.ruf && (
                          <div className="space-y-0.5">
                            <div className="text-xs text-muted-foreground">Forensic Reports</div>
                            <div className="text-sm font-mono break-all">{result.details.ruf}</div>
                          </div>
                        )}
                        {result.details.selector && (
                          <div className="space-y-0.5">
                            <div className="text-xs text-muted-foreground">Selector</div>
                            <div className="text-sm font-mono">{result.details.selector}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {result.details.errors && result.details.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="text-xs space-y-0.5">
                            {result.details.errors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Recommendations */}
              <Card>
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-3">Recommendations</h4>
                  <div className="space-y-2 text-sm">
                    {!results.some((r) => r.type === 'SPF' && r.valid) && (
                      <div className="flex items-start gap-2 text-neutral-500">
                        <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>Add an SPF record to prevent email spoofing</span>
                      </div>
                    )}
                    {!results.some((r) => r.type === 'DMARC' && r.valid) && (
                      <div className="flex items-start gap-2 text-brand-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>
                          Add a DMARC record for better email authentication and reporting
                        </span>
                      </div>
                    )}
                    {!results.some((r) => r.type === 'DKIM' && r.valid) && (
                      <div className="flex items-start gap-2 text-brand-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>Configure DKIM signing for your email domain</span>
                      </div>
                    )}
                    {results.some((r) => r.type === 'SPF' && r.valid) &&
                      results.some((r) => r.type === 'DMARC' && r.valid) &&
                      results.some((r) => r.type === 'DKIM' && r.valid) && (
                        <div className="flex items-start gap-2 text-brand-500 font-bold">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>Excellent! Your domain has comprehensive email security</span>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailSecurityChecker;
