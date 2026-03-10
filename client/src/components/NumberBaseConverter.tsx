import React, { useState, useEffect } from 'react';

type NumberBase = 'binary' | 'octal' | 'decimal' | 'hexadecimal';

interface BaseInfo {
  name: string;
  base: number;
  prefix: string;
  digits: string;
}

const baseInfo: Record<NumberBase, BaseInfo> = {
  binary: { name: 'Binary', base: 2, prefix: '0b', digits: '01' },
  octal: { name: 'Octal', base: 8, prefix: '0o', digits: '01234567' },
  decimal: { name: 'Decimal', base: 10, prefix: '', digits: '0123456789' },
  hexadecimal: { name: 'Hexadecimal', base: 16, prefix: '0x', digits: '0123456789ABCDEF' },
};

export const NumberBaseConverter: React.FC = () => {
  const [input, setInput] = useState('');
  const [fromBase, setFromBase] = useState<NumberBase>('decimal');
  const [results, setResults] = useState<Record<NumberBase, string>>({
    binary: '',
    octal: '',
    decimal: '',
    hexadecimal: '',
  });
  const [error, setError] = useState<string | null>(null);

  const validateInput = (value: string, base: NumberBase): boolean => {
    if (!value.trim()) return true;

    const info = baseInfo[base];
    const cleanValue = value.replace(/^0[bBoOxX]/, ''); // Remove prefix if present

    for (const char of cleanValue.toUpperCase()) {
      if (!info.digits.includes(char)) {
        return false;
      }
    }
    return true;
  };

  const convertNumber = (value: string, fromBase: NumberBase) => {
    if (!value.trim()) {
      setResults({
        binary: '',
        octal: '',
        decimal: '',
        hexadecimal: '',
      });
      setError(null);
      return;
    }

    try {
      // Validate input
      if (!validateInput(value, fromBase)) {
        setError(`Invalid ${baseInfo[fromBase].name} number`);
        return;
      }

      // Convert to decimal first
      const cleanValue = value.replace(/^0[bBoOxX]/, ''); // Remove prefix
      const decimal = parseInt(cleanValue, baseInfo[fromBase].base);

      if (isNaN(decimal)) {
        setError('Invalid number format');
        return;
      }

      // Convert to all bases
      const newResults: Record<NumberBase, string> = {
        binary: decimal.toString(2),
        octal: decimal.toString(8),
        decimal: decimal.toString(10),
        hexadecimal: decimal.toString(16).toUpperCase(),
      };

      // Add prefixes
      Object.keys(newResults).forEach(key => {
        const baseKey = key as NumberBase;
        const info = baseInfo[baseKey];
        newResults[baseKey] = info.prefix + newResults[baseKey];
      });

      setResults(newResults);
      setError(null);
    } catch (e) {
      setError('Conversion error');
    }
  };

  useEffect(() => {
    convertNumber(input, fromBase);
  }, [input, fromBase]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const loadExample = (base: NumberBase) => {
    const examples = {
      binary: '0b101010',
      octal: '0o52',
      decimal: '42',
      hexadecimal: '0x2A',
    };
    setInput(examples[base]);
    setFromBase(base);
  };

  const formatWithSpaces = (num: string, groupSize: number = 4): string => {
    const clean = num.replace(/^0[bBoOxX]/, '');
    const groups = [];
    for (let i = clean.length; i > 0; i -= groupSize) {
      groups.unshift(clean.slice(Math.max(0, i - groupSize), i));
    }
    const prefix = num.substring(0, num.length - clean.length);
    return prefix + groups.join(' ');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-lg">
        <h3 className="text-white text-2xl font-semibold mb-6">Number Base Converter</h3>

        {/* Input Controls */}
        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm text-slate-300 mb-2">Input Base</label>
              <select
                value={fromBase}
                onChange={(e) => setFromBase(e.target.value as NumberBase)}
                className="w-full bg-slate-800/40 text-white px-3 py-2 rounded-md"
              >
                {Object.entries(baseInfo).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.name} (Base {info.base})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => loadExample('decimal')}
                className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
              >
                42
              </button>
              <button
                onClick={() => loadExample('binary')}
                className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
              >
                0b101010
              </button>
              <button
                onClick={() => loadExample('hexadecimal')}
                className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
              >
                0x2A
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">
              {baseInfo[fromBase].name} Input
            </label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Enter a ${baseInfo[fromBase].name.toLowerCase()} number...`}
              className="w-full bg-slate-800/40 text-white px-4 py-3 rounded-md font-mono"
            />
          </div>

          {error && (
            <div className="mt-2 text-red-400 bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          <h4 className="text-white font-semibold">Converted Values</h4>

          {Object.entries(baseInfo).map(([key, info]) => {
            const baseKey = key as NumberBase;
            const result = results[baseKey];

            return (
              <div key={key} className="bg-slate-800/40 p-4 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">{info.name}</span>
                    <span className="text-xs text-slate-400">(Base {info.base})</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(result)}
                    disabled={!result}
                    className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600 disabled:opacity-50"
                  >
                    Copy
                  </button>
                </div>

                <div className="font-mono text-white break-all">
                  {result || 'N/A'}
                </div>

                {result && baseKey === 'binary' && (
                  <div className="mt-2 text-xs text-slate-400">
                    Grouped: {formatWithSpaces(result)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Information */}
        <div className="mt-6 bg-slate-800/40 p-4 rounded">
          <h4 className="text-white font-semibold mb-3">Number Systems</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div>
              <strong className="text-white">Binary (Base 2):</strong> Uses only 0 and 1. Each digit represents a power of 2.
            </div>
            <div>
              <strong className="text-white">Octal (Base 8):</strong> Uses digits 0-7. Each digit represents a power of 8.
            </div>
            <div>
              <strong className="text-white">Decimal (Base 10):</strong> Our standard number system using digits 0-9.
            </div>
            <div>
              <strong className="text-white">Hexadecimal (Base 16):</strong> Uses 0-9 and A-F. Each digit represents a power of 16.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NumberBaseConverter;