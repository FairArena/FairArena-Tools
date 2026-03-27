import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Copy, FileText, Minimize, Image, AlertCircle } from 'lucide-react';
import { useToast } from './ToastProvider';
import { Textarea } from './ui/textarea';

export const JsonFormatter: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [indentSize, setIndentSize] = useState(2);
  const [sortKeys, setSortKeys] = useState(false);
  const toast = useToast();

  const formatJSON = (json: string) => {
    if (!json.trim()) {
      setOutput('');
      setError(null);
      setParsed(null);
      return;
    }

    try {
      let _parsed = JSON.parse(json);

      if (sortKeys) {
        _parsed = sortObjectKeys(_parsed);
      }

      const formatted = JSON.stringify(_parsed, null, indentSize);
      setOutput(formatted);
      setParsed(_parsed);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOutput('');
      setParsed(null);
    }
  };

  const sortObjectKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObjectKeys);

    const sorted: any = {};
    Object.keys(obj)
      .sort()
      .forEach((key) => {
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
    navigator.clipboard.writeText(text).then(() => toast.show('Copied to clipboard'));
  };

  const loadExample = () => {
    const example = {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        zipCode: '12345',
      },
      hobbies: ['reading', 'coding', 'gaming'],
      active: true,
    };
    setInput(JSON.stringify(example, null, 2));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <FileText className="w-5 h-5 text-neutral-900" />
            </div>
            <div>
              <CardTitle>JSON Formatter</CardTitle>
              <p className="text-neutral-400 text-sm">Validate, format, and analyze JSON data</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-neutral-800/40 rounded-lg border border-neutral-700/50">
            <div className="space-y-2">
              <label className="block text-sm text-neutral-300 font-medium">Indent Size</label>
              <Select
                value={indentSize.toString()}
                onValueChange={(value) => setIndentSize(Number(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                  <SelectItem value="1">1 space</SelectItem>
                  <SelectItem value="0">Minified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sortKeys"
                checked={sortKeys}
                onChange={(e) => setSortKeys(e.target.checked)}
                className="w-4 h-4 accent-brand-500"
              />
              <label htmlFor="sortKeys" className="text-sm text-neutral-300 font-medium">
                Sort Keys Alphabetically
              </label>
            </div>

            <div className="flex gap-3 ml-auto">
              <Button variant="outline" onClick={minifyJSON}>
                <Minimize className="w-4 h-4 mr-2" />
                Minify
              </Button>
              <Button variant="outline" onClick={loadExample}>
                <Image className="w-4 h-4 mr-2" />
                Load Example
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-neutral-400" />
                  <label className="text-sm text-neutral-300 font-medium">JSON Input</label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(input)}
                  disabled={!input}
                >
                  <Copy className="w-3 h-3 mr-2" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your JSON here..."
                className="font-mono text-sm h-96 resize-none"
              />
            </div>

            {/* Output */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-neutral-400" />
                  <label className="text-sm text-neutral-300 font-medium">Formatted Output</label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(output)}
                  disabled={!output}
                >
                  <Copy className="w-3 h-3 mr-2" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={output}
                readOnly
                placeholder="Formatted JSON will appear here..."
                className="font-mono text-sm h-96 resize-none"
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>JSON Parse Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Statistics */}
          {output && !error && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  JSON Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-700/30">
                    <span className="text-neutral-400 text-xs font-medium uppercase tracking-wide">
                      Characters
                    </span>
                    <div className="text-white text-lg font-semibold mt-1">
                      {output.length.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-700/30">
                    <span className="text-neutral-400 text-xs font-medium uppercase tracking-wide">
                      Lines
                    </span>
                    <div className="text-white text-lg font-semibold mt-1">
                      {output.split('\n').length}
                    </div>
                  </div>
                  <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-700/30">
                    <span className="text-neutral-400 text-xs font-medium uppercase tracking-wide">
                      Minified Size
                    </span>
                    <div className="text-white text-lg font-semibold mt-1">
                      {parsed ? JSON.stringify(parsed).length : 0} chars
                    </div>
                  </div>
                  <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-700/30">
                    <span className="text-neutral-400 text-xs font-medium uppercase tracking-wide">
                      Compression
                    </span>
                    <div className="text-brand-500 text-lg font-semibold mt-1">
                      {parsed && output.length
                        ? ((1 - JSON.stringify(parsed).length / output.length) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JsonFormatter;
