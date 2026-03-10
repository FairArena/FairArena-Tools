import React, { useState, useEffect } from 'react';

export const JsonFormatter: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [indentSize, setIndentSize] = useState(2);
  const [sortKeys, setSortKeys] = useState(false);

  const formatJSON = (json: string) => {
    if (!json.trim()) {
      setOutput('');
      setError(null);
      return;
    }

    try {
      let parsed = JSON.parse(json);

      if (sortKeys) {
        parsed = sortObjectKeys(parsed);
      }

      const formatted = JSON.stringify(parsed, null, indentSize);
      setOutput(formatted);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
    }
  };

  const sortObjectKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObjectKeys);

    const sorted: any = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = sortObjectKeys(obj[key]);
    });
    return sorted;
  };

  useEffect(() => {
    formatJSON(input);
  }, [input, indentSize, sortKeys]);

  const minifyJSON = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const loadExample = () => {
    const example = {
      name: "John Doe",
      age: 30,
      email: "john@example.com",
      address: {
        street: "123 Main St",
        city: "Anytown",
        zipCode: "12345"
      },
      hobbies: ["reading", "coding", "gaming"],
      active: true
    };
    setInput(JSON.stringify(example, null, 2));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white text-xl font-semibold">JSON Formatter</h3>
            <p className="text-slate-400 text-sm">Validate, format, and analyze JSON data</p>
          </div>
        </div>

        {/* Controls with improved styling */}
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
          <div className="space-y-2">
            <label className="block text-sm text-slate-300 font-medium">Indent Size</label>
            <select
              value={indentSize}
              onChange={(e) => setIndentSize(Number(e.target.value))}
              className="bg-slate-800/50 border border-slate-700 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value={1}>1 space</option>
              <option value={0}>Minified</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sortKeys"
              checked={sortKeys}
              onChange={(e) => setSortKeys(e.target.checked)}
              className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500 focus:ring-2"
            />
            <label htmlFor="sortKeys" className="text-sm text-slate-300 font-medium">
              Sort Keys Alphabetically
            </label>
          </div>

          <div className="flex gap-3 ml-auto">
            <button
              onClick={minifyJSON}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-all duration-200 border border-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Minify
            </button>
            <button
              onClick={loadExample}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-all duration-200 border border-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Load Example
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <label className="text-sm text-slate-300 font-medium">JSON Input</label>
              </div>
              <button
                onClick={() => copyToClipboard(input)}
                className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 rounded text-xs font-medium transition-all duration-200 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!input}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your JSON here..."
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 font-mono text-sm h-96 resize-none p-4"
            />
          </div>

          {/* Output */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <label className="text-sm text-slate-300 font-medium">Formatted Output</label>
              </div>
              <button
                onClick={() => copyToClipboard(output)}
                className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 rounded text-xs font-medium transition-all duration-200 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!output}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>
            <textarea
              value={output}
              readOnly
              placeholder="Formatted JSON will appear here..."
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 font-mono text-sm h-96 resize-none p-4"
            />
          </div>
        </div>

        {/* Error Display with improved styling */}
        {error && (
          <div className="p-4 bg-rose-900/20 border border-rose-700/50 rounded-lg mb-6">
            <div className="flex items-center gap-2 text-rose-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">JSON Parse Error</span>
            </div>
            <p className="text-rose-300 text-sm">{error}</p>
          </div>
        )}

        {/* Statistics with improved styling */}
        {output && !error && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h4 className="text-white font-semibold">JSON Statistics</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Characters</span>
                <div className="text-white text-lg font-semibold mt-1">{output.length.toLocaleString()}</div>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Lines</span>
                <div className="text-white text-lg font-semibold mt-1">{output.split('\n').length}</div>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Minified Size</span>
                <div className="text-white text-lg font-semibold mt-1">{JSON.stringify(JSON.parse(input)).length} chars</div>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Compression</span>
                <div className="text-green-400 text-lg font-semibold mt-1">
                  {((1 - JSON.stringify(JSON.parse(input)).length / output.length) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JsonFormatter;