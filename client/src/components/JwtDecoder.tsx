import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, Code2, Package, Shield, AlertCircle, Key } from 'lucide-react';
import { useToast } from './ToastProvider';

interface JWTDecoded {
  header: any;
  payload: any;
  signature: string;
  valid: boolean;
  expired: boolean;
  errors: string[];
}

export const JwtDecoder: React.FC = () => {
  const [jwt, setJwt] = useState('');
  const [decoded, setDecoded] = useState<JWTDecoded | null>(null);
  const toast = useToast();

  const decodeJWT = (token: string) => {
    if (!token.trim()) {
      setDecoded(null);
      return;
    }

    const errors: string[] = [];

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        errors.push('Invalid JWT format - should have 3 parts separated by dots');
        setDecoded({
          header: null,
          payload: null,
          signature: parts[2] || '',
          valid: false,
          expired: false,
          errors,
        });
        return;
      }

      // Decode header
      let header;
      try {
        header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      } catch (e) {
        errors.push('Invalid header - not valid base64 JSON');
        header = null;
      }

      // Decode payload
      let payload;
      let expired = false;
      try {
        payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

        // Check expiration
        if (payload.exp) {
          const expDate = new Date(payload.exp * 1000);
          expired = expDate < new Date();
        }
      } catch (e) {
        errors.push('Invalid payload - not valid base64 JSON');
        payload = null;
      }

      setDecoded({
        header,
        payload,
        signature: parts[2],
        valid: errors.length === 0,
        expired,
        errors,
      });
    } catch (e) {
      setDecoded({
        header: null,
        payload: null,
        signature: '',
        valid: false,
        expired: false,
        errors: ['Failed to parse JWT token'],
      });
    }
  };

  useEffect(() => {
    decodeJWT(jwt);
  }, [jwt]);

  const formatJSON = (obj: any) => {
    if (!obj) return 'Invalid JSON';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return 'Invalid JSON';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return `${date.toLocaleString()} (${timestamp})`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.show('Copied to clipboard');
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>JWT Decoder</CardTitle>
              <p className="text-slate-400 text-sm">
                Decode and inspect JWT tokens without validation
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm text-slate-300 font-medium">JWT Token</label>
            <textarea
              value={jwt}
              onChange={(e) => setJwt(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 font-mono text-sm h-32 resize-none p-4"
            />
          </div>

          {decoded && (
            <div className="space-y-6">
              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
                <Badge variant={decoded.valid ? 'default' : 'destructive'}>
                  {decoded.valid ? 'Valid JWT Structure' : 'Invalid JWT Structure'}
                </Badge>
                {decoded.payload?.exp && (
                  <Badge variant={decoded.expired ? 'destructive' : 'default'}>
                    {decoded.expired ? 'Token Expired' : 'Token Active'}
                  </Badge>
                )}
                <span className="text-xs text-slate-400 ml-auto">Signature not validated</span>
              </div>

              {/* Errors */}
              {decoded.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="space-y-1">
                      {decoded.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Tabs */}
              <Tabs defaultValue="payload">
                <TabsList className="w-full">
                  <TabsTrigger value="header" className="flex-1 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" />
                    Header
                  </TabsTrigger>
                  <TabsTrigger value="payload" className="flex-1 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Payload
                  </TabsTrigger>
                  <TabsTrigger value="signature" className="flex-1 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Signature
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="header" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-semibold">Header</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(formatJSON(decoded.header))}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy JSON
                      </Button>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/30">
                      <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
                        {formatJSON(decoded.header)}
                      </pre>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="payload" className="mt-4">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-semibold">Payload</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(formatJSON(decoded.payload))}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy JSON
                      </Button>
                    </div>

                    {decoded.payload && (
                      <div className="space-y-6">
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/30">
                          <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
                            {formatJSON(decoded.payload)}
                          </pre>
                        </div>

                        {/* Common claims */}
                        <div className="border-t border-slate-700/50 pt-6">
                          <h5 className="text-slate-300 font-semibold mb-4">Standard Claims</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {decoded.payload.iss && (
                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                                <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                                  Issuer (iss)
                                </span>
                                <div className="text-white font-mono text-sm mt-1 break-all">
                                  {decoded.payload.iss}
                                </div>
                              </div>
                            )}
                            {decoded.payload.sub && (
                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                                <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                                  Subject (sub)
                                </span>
                                <div className="text-white font-mono text-sm mt-1 break-all">
                                  {decoded.payload.sub}
                                </div>
                              </div>
                            )}
                            {decoded.payload.aud && (
                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                                <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                                  Audience (aud)
                                </span>
                                <div className="text-white font-mono text-sm mt-1 break-all">
                                  {Array.isArray(decoded.payload.aud)
                                    ? decoded.payload.aud.join(', ')
                                    : decoded.payload.aud}
                                </div>
                              </div>
                            )}
                            {decoded.payload.exp && (
                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                                <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                                  Expires (exp)
                                </span>
                                <div
                                  className={`font-mono text-sm mt-1 ${decoded.expired ? 'text-red-400' : 'text-green-400'}`}
                                >
                                  {formatTimestamp(decoded.payload.exp)}
                                </div>
                              </div>
                            )}
                            {decoded.payload.iat && (
                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                                <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                                  Issued At (iat)
                                </span>
                                <div className="text-white font-mono text-sm mt-1">
                                  {formatTimestamp(decoded.payload.iat)}
                                </div>
                              </div>
                            )}
                            {decoded.payload.nbf && (
                              <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                                <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                                  Not Before (nbf)
                                </span>
                                <div className="text-white font-mono text-sm mt-1">
                                  {formatTimestamp(decoded.payload.nbf)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="signature" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-semibold">Signature</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(decoded.signature)}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy
                      </Button>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/30">
                      <div className="text-sm text-slate-300 font-mono break-all">
                        {decoded.signature}
                      </div>
                    </div>
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Security Note:</strong> This tool only decodes the JWT structure and
                        does not validate the cryptographic signature. Always verify signatures
                        using appropriate JWT libraries in your application code.
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JwtDecoder;
