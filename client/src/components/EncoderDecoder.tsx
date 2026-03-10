import React, { useState, useEffect } from 'react';

type EncodingType = 'base64' | 'url' | 'hex' | 'binary';

export const EncoderDecoder: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [encodingType, setEncodingType] = useState<EncodingType>('base64');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [error, setError] = useState<string | null>(null);

  const processText = (text: string, type: EncodingType, isEncode: boolean) => {
    if (!text) {
      setOutput('');
      setError(null);
      return;
    }

    try {
      let result = '';

      if (isEncode) {
        switch (type) {
          case 'base64':
            result = btoa(text);
            break;
          case 'url':
            result = encodeURIComponent(text);
            break;
          case 'hex':
            result = Array.from(text, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
            break;
          case 'binary':
            result = Array.from(text, char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
            break;
        }
      } else {
        switch (type) {
          case 'base64':
            result = atob(text);
            break;
          case 'url':
            result = decodeURIComponent(text);
            break;
          case 'hex':
            // Remove spaces and validate
            const cleanHex = text.replace(/\s/g, '');
            if (!/^[0-9a-fA-F]+$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
              throw new Error('Invalid hex string');
            }
            result = cleanHex.match(/.{1,2}/g)?.map(byte => String.fromCharCode(parseInt(byte, 16))).join('') || '';
            break;
          case 'binary':
            // Remove spaces and validate
            const cleanBinary = text.replace(/\s/g, '');
            if (!/^[01]+$/.test(cleanBinary) || cleanBinary.length % 8 !== 0) {
              throw new Error('Invalid binary string');
            }
            result = cleanBinary.match(/.{8}/g)?.map(byte => String.fromCharCode(parseInt(byte, 2))).join('') || '';
            break;
        }
      }

      setOutput(result);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
    }
  };

  useEffect(() => {
    processText(input, encodingType, mode === 'encode');
  }, [input, encodingType, mode]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const swapMode = () => {
    setMode(mode === 'encode' ? 'decode' : 'encode');
    // Swap input and output
    const temp = input;
    setInput(output);
    setOutput(temp);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  const examples = {
    base64: {
      encode: 'Hello World',
      decode: 'SGVsbG8gV29ybGQ='
    },
    url: {
      encode: 'Hello World!',
      decode: 'Hello%20World%21'
    },
    hex: {
      encode: 'ABC',
      decode: '414243'
    },
    binary: {
      encode: 'ABC',
      decode: '01000001 01000010 01000011'
    }
  };

  const loadExample = () => {
    const example = examples[encodingType][mode];
    setInput(example);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-lg">
        <h3 className="text-white text-2xl font-semibold mb-6">Encoder / Decoder</h3>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Encoding Type</label>
            <select
              value={encodingType}
              onChange={(e) => setEncodingType(e.target.value as EncodingType)}
              className="bg-slate-800/40 text-white px-3 py-2 rounded-md"
            >
              <option value="base64">Base64</option>
              <option value="url">URL</option>
              <option value="hex">Hex</option>
              <option value="binary">Binary</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('encode')}
                className={`px-3 py-2 rounded text-sm ${mode === 'encode' ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                Encode
              </button>
              <button
                onClick={() => setMode('decode')}
                className={`px-3 py-2 rounded text-sm ${mode === 'decode' ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                Decode
              </button>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={swapMode}
              className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
              title="Swap input and output"
            >
              ⇅ Swap
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
            >
              Clear
            </button>
            <button
              onClick={loadExample}
              className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
            >
              Example
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-300">
                {mode === 'encode' ? 'Plain Text' : `${encodingType.toUpperCase()} Input`}
              </label>
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
              placeholder={mode === 'encode' ? 'Enter text to encode...' : `Enter ${encodingType} to decode...`}
              className="w-full bg-slate-800/40 text-white px-4 py-3 rounded-md font-mono text-sm h-48 resize-none"
            />
          </div>

          {/* Output */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-300">
                {mode === 'encode' ? `${encodingType.toUpperCase()} Output` : 'Plain Text'}
              </label>
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
              placeholder="Output will appear here..."
              className="w-full bg-slate-800/40 text-white px-4 py-3 rounded-md font-mono text-sm h-48 resize-none"
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 text-red-400 bg-red-900/20 p-3 rounded">
            Error: {error}
          </div>
        )}

        {/* Information Panel */}
        <div className="mt-6 bg-slate-800/40 p-4 rounded">
          <h4 className="text-white font-semibold mb-3">About {encodingType.toUpperCase()}</h4>
          <div className="text-sm text-slate-300">
            {encodingType === 'base64' && (
              <p>Base64 encoding converts binary data to a text format using 64 different ASCII characters. Commonly used for encoding data in URLs, cookies, and email attachments.</p>
            )}
            {encodingType === 'url' && (
              <p>URL encoding (percent-encoding) replaces unsafe characters with %XX where XX is the hexadecimal value. Used to encode URLs and form data for safe transmission.</p>
            )}
            {encodingType === 'hex' && (
              <p>Hexadecimal encoding represents each byte as two hexadecimal digits (00-FF). Commonly used for representing binary data in a human-readable format.</p>
            )}
            {encodingType === 'binary' && (
              <p>Binary encoding represents each character as its 8-bit binary equivalent. Shows the raw binary representation of text data.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EncoderDecoder;