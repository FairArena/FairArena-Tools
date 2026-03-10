import React, { useState, useEffect } from 'react';

interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
}

export const PasswordGenerator: React.FC = () => {
  const [password, setPassword] = useState('');
  const [options, setOptions] = useState<PasswordOptions>({
    length: 12,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: false,
    excludeSimilar: false,
  });
  const [strength, setStrength] = useState(0);
  const [generatedPasswords, setGeneratedPasswords] = useState<string[]>([]);

  const charSets = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    similar: 'Il1O0',
  };

  const generatePassword = (opts: PasswordOptions): string => {
    let chars = '';

    if (opts.uppercase) chars += charSets.uppercase;
    if (opts.lowercase) chars += charSets.lowercase;
    if (opts.numbers) chars += charSets.numbers;
    if (opts.symbols) chars += charSets.symbols;

    if (opts.excludeSimilar) {
      chars = chars.split('').filter(char => !charSets.similar.includes(char)).join('');
    }

    if (!chars) return '';

    let result = '';
    for (let i = 0; i < opts.length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Ensure at least one character from each selected set
    const ensureChar = (set: string, result: string): string => {
      if (!set) return result;
      const hasChar = result.split('').some(char => set.includes(char));
      if (!hasChar) {
        const pos = Math.floor(Math.random() * result.length);
        const char = set.charAt(Math.floor(Math.random() * set.length));
        return result.substring(0, pos) + char + result.substring(pos + 1);
      }
      return result;
    };

    if (opts.uppercase) result = ensureChar(charSets.uppercase, result);
    if (opts.lowercase) result = ensureChar(charSets.lowercase, result);
    if (opts.numbers) result = ensureChar(charSets.numbers, result);
    if (opts.symbols) result = ensureChar(charSets.symbols, result);

    return result;
  };

  const calculateStrength = (opts: PasswordOptions): number => {
    let score = 0;

    // Length score
    if (opts.length >= 8) score += 1;
    if (opts.length >= 12) score += 1;
    if (opts.length >= 16) score += 1;

    // Character variety score
    if (opts.uppercase) score += 1;
    if (opts.lowercase) score += 1;
    if (opts.numbers) score += 1;
    if (opts.symbols) score += 1;

    // Bonus for excluding similar characters
    if (opts.excludeSimilar) score += 0.5;

    return Math.min(score, 5);
  };

  const generateNewPassword = () => {
    const newPassword = generatePassword(options);
    setPassword(newPassword);
    setStrength(calculateStrength(options));
  };

  const generateMultiple = (count: number) => {
    const passwords: string[] = [];
    for (let i = 0; i < count; i++) {
      passwords.push(generatePassword(options));
    }
    setGeneratedPasswords(passwords);
  };

  useEffect(() => {
    generateNewPassword();
  }, [options]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStrengthLabel = (score: number): { label: string; color: string } => {
    if (score < 2) return { label: 'Very Weak', color: 'text-red-400' };
    if (score < 3) return { label: 'Weak', color: 'text-orange-400' };
    if (score < 4) return { label: 'Fair', color: 'text-yellow-400' };
    if (score < 5) return { label: 'Good', color: 'text-green-400' };
    return { label: 'Strong', color: 'text-emerald-400' };
  };

  const strengthInfo = getStrengthLabel(strength);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-lg">
        <h3 className="text-white text-2xl font-semibold mb-6">Password Generator</h3>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Password Length: {options.length}
              </label>
              <input
                type="range"
                min="4"
                max="64"
                value={options.length}
                onChange={(e) => setOptions(prev => ({ ...prev, length: Number(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.uppercase}
                  onChange={(_e) => setOptions(prev => ({ ...prev, uppercase: !prev.uppercase }))}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-slate-300">Include Uppercase (A-Z)</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.lowercase}
                  onChange={(_e) => setOptions(prev => ({ ...prev, lowercase: !prev.lowercase }))}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-slate-300">Include Lowercase (a-z)</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.numbers}
                  onChange={(_e) => setOptions(prev => ({ ...prev, numbers: !prev.numbers }))}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-slate-300">Include Numbers (0-9)</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.symbols}
                  onChange={(_e) => setOptions(prev => ({ ...prev, symbols: !prev.symbols }))}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-slate-300">Include Symbols (!@#$%^&*)</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.excludeSimilar}
                  onChange={(_e) => setOptions(prev => ({ ...prev, excludeSimilar: !prev.excludeSimilar }))}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-slate-300">Exclude Similar Characters (I,l,1,O,0)</span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Generated Password</label>
              <div className="bg-slate-800/40 p-4 rounded font-mono text-lg text-white break-all">
                {password || 'Click Generate to create a password'}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">Strength:</span>
                <span className={`text-sm font-semibold ${strengthInfo.color}`}>
                  {strengthInfo.label}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    strength < 2 ? 'bg-red-500' :
                    strength < 3 ? 'bg-orange-500' :
                    strength < 4 ? 'bg-yellow-500' :
                    strength < 5 ? 'bg-green-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${(strength / 5) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={generateNewPassword}
                className="flex-1 px-4 py-2 bg-brand-600 rounded-md text-white hover:bg-brand-700"
              >
                Generate New
              </button>
              <button
                onClick={() => copyToClipboard(password)}
                disabled={!password}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Generation */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">Bulk Generation</h4>
          <div className="flex gap-2">
            <button
              onClick={() => generateMultiple(5)}
              className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
            >
              Generate 5
            </button>
            <button
              onClick={() => generateMultiple(10)}
              className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
            >
              Generate 10
            </button>
            <button
              onClick={() => generateMultiple(25)}
              className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
            >
              Generate 25
            </button>
          </div>
        </div>

        {/* Generated Passwords List */}
        {generatedPasswords.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-semibold">Generated Passwords ({generatedPasswords.length})</h4>
              <button
                onClick={() => copyToClipboard(generatedPasswords.join('\n'))}
                className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600"
              >
                Copy All
              </button>
            </div>
            <div className="bg-slate-800/40 rounded max-h-48 overflow-auto">
              {generatedPasswords.map((pwd, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 border-b border-slate-700/50 last:border-b-0"
                >
                  <span className="font-mono text-sm text-white break-all">{pwd}</span>
                  <button
                    onClick={() => copyToClipboard(pwd)}
                    className="ml-2 px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600 shrink-0"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Tips */}
        <div className="bg-slate-800/40 p-4 rounded">
          <h4 className="text-white font-semibold mb-3">Security Tips</h4>
          <div className="text-sm text-slate-300 space-y-2">
            <p>• Use passwords that are at least 12 characters long</p>
            <p>• Include a mix of uppercase, lowercase, numbers, and symbols</p>
            <p>• Avoid using personal information or common words</p>
            <p>• Use a unique password for each account</p>
            <p>• Consider using a password manager to store complex passwords</p>
            <p>• Enable two-factor authentication when available</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordGenerator;