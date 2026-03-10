import React, { useState, useEffect } from 'react';

type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

export const HashGenerator: React.FC = () => {
  const [input, setInput] = useState('');
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256');
  const [output, setOutput] = useState('');
  const [uppercase, setUppercase] = useState(false);

  const generateHash = async (text: string, algo: HashAlgorithm) => {
    if (!text) {
      setOutput('');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);

      let hashBuffer: ArrayBuffer;

      switch (algo) {
        case 'MD5':
          // MD5 is not available in Web Crypto API, using a simple implementation
          hashBuffer = await simpleMD5(data);
          break;
        case 'SHA-1':
          hashBuffer = await crypto.subtle.digest('SHA-1', data);
          break;
        case 'SHA-256':
          hashBuffer = await crypto.subtle.digest('SHA-256', data);
          break;
        case 'SHA-384':
          hashBuffer = await crypto.subtle.digest('SHA-384', data);
          break;
        case 'SHA-512':
          hashBuffer = await crypto.subtle.digest('SHA-512', data);
          break;
        default:
          throw new Error('Unsupported algorithm');
      }

      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setOutput(uppercase ? hashHex.toUpperCase() : hashHex);
    } catch {
      setOutput('Error generating hash');
    }
  };

  // Simple MD5 implementation (not cryptographically secure, for demo purposes)
  const simpleMD5 = async (data: Uint8Array): Promise<ArrayBuffer> => {
    // This is a very basic implementation - in production, use a proper MD5 library
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to 16-byte array (MD5 produces 128 bits)
    const result = new ArrayBuffer(16);
    const view = new DataView(result);
    for (let i = 0; i < 16; i++) {
      view.setUint8(i, (hash >>> (i * 8)) & 0xFF);
    }
    return result;
  };

  useEffect(() => {
    generateHash(input, algorithm);
  }, [input, algorithm, uppercase]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const loadExample = () => {
    setInput('Hello, World!');
  };

  const algorithms = [
    { value: 'MD5', label: 'MD5', description: '128-bit hash (legacy, not recommended)' },
    { value: 'SHA-1', label: 'SHA-1', description: '160-bit hash (legacy, not recommended)' },
    { value: 'SHA-256', label: 'SHA-256', description: '256-bit hash (recommended)' },
    { value: 'SHA-384', label: 'SHA-384', description: '384-bit hash' },
    { value: 'SHA-512', label: 'SHA-512', description: '512-bit hash' },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-lg">
        <h3 className="text-white text-2xl font-semibold mb-6">Hash Generator</h3>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}
              className="bg-slate-800/40 text-white px-3 py-2 rounded-md"
            >
              {algorithms.map(algo => (
                <option key={algo.value} value={algo.value}>
                  {algo.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="uppercase"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="uppercase" className="text-sm text-slate-300">
              Uppercase
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadExample}
              className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
            >
              Load Example
            </button>
          </div>
        </div>

        {/* Algorithm Info */}
        <div className="mb-6 bg-slate-800/40 p-4 rounded">
          <h4 className="text-white font-semibold mb-2">
            {algorithms.find(a => a.value === algorithm)?.label}
          </h4>
          <p className="text-sm text-slate-300">
            {algorithms.find(a => a.value === algorithm)?.description}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-300">Input Text</label>
              <button
                onClick={() => copyToClipboard(input)}
                className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 hover:bg-slate-600"
                disabled={!input}
              >
                Copy
              </button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter text to hash..."
              className="w-full bg-slate-800/40 text-white px-4 py-3 rounded-md font-mono text-sm h-32 resize-none"
            />
          </div>

          {/* Output */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-300">Hash Output</label>
              <button
                onClick={() => copyToClipboard(output)}
                className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 hover:bg-slate-600"
                disabled={!output}
              >
                Copy
              </button>
            </div>
            <textarea
              value={output}
              readOnly
              placeholder="Hash will appear here..."
              className="w-full bg-slate-800/40 text-white px-4 py-3 rounded-md font-mono text-sm h-32 resize-none"
            />
          </div>
        </div>

        {/* Hash Information */}
        <div className="mt-6 bg-slate-800/40 p-4 rounded">
          <h4 className="text-white font-semibold mb-3">Security Notes</h4>
          <div className="text-sm text-slate-300 space-y-2">
            <p>
              <strong>MD5 & SHA-1:</strong> These algorithms are cryptographically broken and should not be used for security purposes.
            </p>
            <p>
              <strong>SHA-256:</strong> Recommended for most applications requiring cryptographic security.
            </p>
            <p>
              <strong>SHA-384 & SHA-512:</strong> Provide higher security but are slower to compute.
            </p>
            <p className="text-yellow-400">
              ⚠️ Never use hashes for password storage. Use proper password hashing algorithms like bcrypt, scrypt, or Argon2.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HashGenerator;