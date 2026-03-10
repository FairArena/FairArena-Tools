import React, { useState, useEffect } from 'react';

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
  const [activeTab, setActiveTab] = useState<'header' | 'payload' | 'signature'>('payload');

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
          errors
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
        errors
      });

    } catch (e) {
      setDecoded({
        header: null,
        payload: null,
        signature: '',
        valid: false,
        expired: false,
        errors: ['Failed to parse JWT token']
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
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white text-xl font-semibold">JWT Decoder</h3>
            <p className="text-slate-400 text-sm">Decode and inspect JWT tokens without validation</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <label className="block text-sm text-slate-300 font-medium">JWT Token</label>
            <textarea
              value={jwt}
              onChange={(e) => setJwt(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 font-mono text-sm h-32 resize-none p-4"
            />
          </div>
        </div>

        {decoded && (
          <div className="space-y-6">
            {/* Status indicators with improved styling */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${decoded.valid ? 'bg-green-500' : 'bg-red-500'} shadow-sm`} />
                <span className={`text-sm font-medium ${decoded.valid ? 'text-green-400' : 'text-red-400'}`}>
                  {decoded.valid ? 'Valid JWT Structure' : 'Invalid JWT Structure'}
                </span>
              </div>

              {decoded.payload?.exp && (
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${decoded.expired ? 'bg-red-500' : 'bg-green-500'} shadow-sm`} />
                  <span className={`text-sm font-medium ${decoded.expired ? 'text-red-400' : 'text-green-400'}`}>
                    {decoded.expired ? 'Token Expired' : 'Token Active'}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-slate-400">Signature not validated</span>
              </div>
            </div>

            {/* Errors with improved styling */}
            {decoded.errors.length > 0 && (
              <div className="p-4 bg-rose-900/20 border border-rose-700/50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="text-rose-400 font-semibold">Parse Errors</h4>
                </div>
                <ul className="text-rose-300 text-sm space-y-1">
                  {decoded.errors.map((error, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-rose-500 mt-1">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tab navigation with improved styling */}
            <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg">
              <button
                onClick={() => setActiveTab('header')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'header'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Header
              </button>
              <button
                onClick={() => setActiveTab('payload')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'payload'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Payload
              </button>
              <button
                onClick={() => setActiveTab('signature')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'signature'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Signature
              </button>
            </div>

            {/* Content with improved styling */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-6">
              {activeTab === 'header' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-semibold text-lg">Header</h4>
                    <button
                      onClick={() => copyToClipboard(formatJSON(decoded.header))}
                      className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded text-sm font-medium transition-all duration-200 border border-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy JSON
                    </button>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/30">
                    <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
                      {formatJSON(decoded.header)}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'payload' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-semibold text-lg">Payload</h4>
                    <button
                      onClick={() => copyToClipboard(formatJSON(decoded.payload))}
                      className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded text-sm font-medium transition-all duration-200 border border-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy JSON
                    </button>
                  </div>

                  {decoded.payload && (
                    <div className="space-y-6">
                      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/30">
                        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
                          {formatJSON(decoded.payload)}
                        </pre>
                      </div>

                      {/* Common claims with improved styling */}
                      <div className="border-t border-slate-700/50 pt-6">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <h5 className="text-slate-300 font-semibold">Standard Claims</h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {decoded.payload.iss && (
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                              <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Issuer (iss)</span>
                              <div className="text-white font-mono text-sm mt-1 break-all">{decoded.payload.iss}</div>
                            </div>
                          )}
                          {decoded.payload.sub && (
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                              <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Subject (sub)</span>
                              <div className="text-white font-mono text-sm mt-1 break-all">{decoded.payload.sub}</div>
                            </div>
                          )}
                          {decoded.payload.aud && (
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                              <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Audience (aud)</span>
                              <div className="text-white font-mono text-sm mt-1 break-all">
                                {Array.isArray(decoded.payload.aud) ? decoded.payload.aud.join(', ') : decoded.payload.aud}
                              </div>
                            </div>
                          )}
                          {decoded.payload.exp && (
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                              <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Expires (exp)</span>
                              <div className={`font-mono text-sm mt-1 ${decoded.expired ? 'text-red-400' : 'text-green-400'}`}>
                                {formatTimestamp(decoded.payload.exp)}
                              </div>
                            </div>
                          )}
                          {decoded.payload.iat && (
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                              <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Issued At (iat)</span>
                              <div className="text-white font-mono text-sm mt-1">{formatTimestamp(decoded.payload.iat)}</div>
                            </div>
                          )}
                          {decoded.payload.nbf && (
                            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                              <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Not Before (nbf)</span>
                              <div className="text-white font-mono text-sm mt-1">{formatTimestamp(decoded.payload.nbf)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'signature' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-semibold text-lg">Signature</h4>
                    <button
                      onClick={() => copyToClipboard(decoded.signature)}
                      className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded text-sm font-medium transition-all duration-200 border border-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/30">
                    <div className="text-sm text-slate-300 font-mono break-all">
                      {decoded.signature}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                    <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="text-amber-300 text-sm">
                      <strong>Security Note:</strong> This tool only decodes the JWT structure and does not validate the cryptographic signature. Always verify signatures using appropriate JWT libraries in your application code.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JwtDecoder;