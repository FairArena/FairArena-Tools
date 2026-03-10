import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Calculator, AlertCircle } from 'lucide-react';
import { useToast } from './ToastProvider';

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

  const toast = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.show('Copied to clipboard'));
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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Number Base Converter</CardTitle>
              <p className="text-muted-foreground text-sm">Convert numbers between binary, octal, decimal, and hex</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Controls */}
          <div className="space-y-4 p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2 w-52">
                <Label>Input Base</Label>
                <Select value={fromBase} onValueChange={(v) => setFromBase(v as NumberBase)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(baseInfo).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        {info.name} (Base {info.base})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Label className="sr-only">Examples</Label>
                {(['decimal', 'binary', 'hexadecimal'] as NumberBase[]).map((b) => (
                  <Button key={b} variant="outline" size="sm" onClick={() => loadExample(b)}>
                    {b === 'decimal' ? '42' : b === 'binary' ? '0b101010' : '0x2A'}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{baseInfo[fromBase].name} Input</Label>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Enter a ${baseInfo[fromBase].name.toLowerCase()} number...`}
                className="font-mono"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Results */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-slate-300">Converted Values</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(baseInfo).map(([key, info]) => {
                const baseKey = key as NumberBase;
                const result = results[baseKey];
                return (
                  <Card key={key}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-semibold text-sm">{info.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">(Base {info.base})</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(result)} disabled={!result}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="font-mono text-sm break-all text-slate-200">{result || '—'}</div>
                      {result && baseKey === 'binary' && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Grouped: {formatWithSpaces(result)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Info */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-3">Number Systems</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div><strong className="text-foreground">Binary (Base 2):</strong> Uses only 0 and 1. Each digit represents a power of 2.</div>
                <div><strong className="text-foreground">Octal (Base 8):</strong> Uses digits 0–7. Each digit represents a power of 8.</div>
                <div><strong className="text-foreground">Decimal (Base 10):</strong> Our standard number system using digits 0–9.</div>
                <div><strong className="text-foreground">Hexadecimal (Base 16):</strong> Uses 0–9 and A–F. Each digit represents a power of 16.</div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default NumberBaseConverter;