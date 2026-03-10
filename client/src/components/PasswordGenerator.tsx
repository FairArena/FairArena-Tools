import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, RefreshCw, Lock } from 'lucide-react';
import { useToast } from './ToastProvider';

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
      chars = chars
        .split('')
        .filter((char) => !charSets.similar.includes(char))
        .join('');
    }

    if (!chars) return '';

    let result = '';
    for (let i = 0; i < opts.length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Ensure at least one character from each selected set
    const ensureChar = (set: string, result: string): string => {
      if (!set) return result;
      const hasChar = result.split('').some((char) => set.includes(char));
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

  const toast = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.show('Copied to clipboard'));
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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Password Generator</CardTitle>
              <p className="text-muted-foreground text-sm">Generate strong, secure passwords</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Options */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Password Length: {options.length}</Label>
                <input
                  type="range"
                  min="4"
                  max="64"
                  value={options.length}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, length: Number(e.target.value) }))
                  }
                  className="w-full accent-brand-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>4</span>
                  <span>64</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                {(
                  [
                    ['uppercase', 'Include Uppercase (A–Z)'],
                    ['lowercase', 'Include Lowercase (a–z)'],
                    ['numbers', 'Include Numbers (0–9)'],
                    ['symbols', 'Include Symbols (!@#$%^&*)'],
                    ['excludeSimilar', 'Exclude Similar Characters (I, l, 1, O, 0)'],
                  ] as [keyof PasswordOptions, string][]
                ).map(([key, lbl]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={options[key] as boolean}
                      onCheckedChange={(v) =>
                        setOptions((prev) => ({ ...prev, [key]: v as boolean }))
                      }
                    />
                    <Label htmlFor={key} className="font-normal">
                      {lbl}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Output + Strength */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Generated Password</Label>
                <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-lg font-mono text-base text-white break-all min-h-[60px] flex items-center">
                  {password || (
                    <span className="text-muted-foreground text-sm">
                      Click Generate to create a password
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Strength</Label>
                  <Badge
                    variant={
                      strength >= 4 ? 'default' : strength >= 3 ? 'secondary' : 'destructive'
                    }
                    className="text-xs"
                  >
                    {strengthInfo.label}
                  </Badge>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      strength < 2
                        ? 'bg-red-500'
                        : strength < 3
                          ? 'bg-orange-500'
                          : strength < 4
                            ? 'bg-yellow-500'
                            : strength < 5
                              ? 'bg-green-500'
                              : 'bg-emerald-500'
                    }`}
                    style={{ width: `${(strength / 5) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={generateNewPassword} className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate New
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(password)}
                  disabled={!password}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Bulk Generation */}
          <Separator />
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-slate-300">Bulk Generation</h4>
            <div className="flex gap-2">
              {[5, 10, 25].map((n) => (
                <Button key={n} variant="outline" size="sm" onClick={() => generateMultiple(n)}>
                  Generate {n}
                </Button>
              ))}
            </div>
          </div>

          {generatedPasswords.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Generated Passwords ({generatedPasswords.length})
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedPasswords.join('\n'))}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-900/40 rounded-lg max-h-48 overflow-auto divide-y divide-slate-700/40">
                  {generatedPasswords.map((pwd, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 group">
                      <span className="font-mono text-sm text-white break-all flex-1">{pwd}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() => copyToClipboard(pwd)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Tips */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-3">Security Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Use passwords that are at least 12 characters long</li>
                <li>• Include a mix of uppercase, lowercase, numbers, and symbols</li>
                <li>• Avoid using personal information or common words</li>
                <li>• Use a unique password for each account</li>
                <li>• Consider using a password manager to store complex passwords</li>
                <li>• Enable two-factor authentication when available</li>
              </ul>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordGenerator;
