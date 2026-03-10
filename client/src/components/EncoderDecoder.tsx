import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Copy, ArrowLeftRight, Trash2, Binary, AlertCircle, Shuffle } from 'lucide-react';
import { useToast } from './ToastProvider';

type EncodingType = 'base64' | 'url' | 'hex' | 'binary';

const ENCODING_INFO: Record<EncodingType, string> = {
  base64:
    'Base64 encoding converts binary data to a text format using 64 different ASCII characters. Commonly used for encoding data in URLs, cookies, and email attachments.',
  url: 'URL encoding (percent-encoding) replaces unsafe characters with %XX where XX is the hexadecimal value. Used to encode URLs and form data for safe transmission.',
  hex: 'Hexadecimal encoding represents each byte as two hexadecimal digits (00-FF). Commonly used for representing binary data in a human-readable format.',
  binary:
    'Binary encoding represents each character as its 8-bit binary equivalent. Shows the raw binary representation of text data.',
};

export const EncoderDecoder: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [encodingType, setEncodingType] = useState<EncodingType>('base64');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

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
            result = Array.from(text, (char) =>
              char.charCodeAt(0).toString(16).padStart(2, '0'),
            ).join('');
            break;
          case 'binary':
            result = Array.from(text, (char) =>
              char.charCodeAt(0).toString(2).padStart(8, '0'),
            ).join(' ');
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
            result =
              cleanHex
                .match(/.{1,2}/g)
                ?.map((byte) => String.fromCharCode(parseInt(byte, 16)))
                .join('') || '';
            break;
          case 'binary':
            // Remove spaces and validate
            const cleanBinary = text.replace(/\s/g, '');
            if (!/^[01]+$/.test(cleanBinary) || cleanBinary.length % 8 !== 0) {
              throw new Error('Invalid binary string');
            }
            result =
              cleanBinary
                .match(/.{8}/g)
                ?.map((byte) => String.fromCharCode(parseInt(byte, 2)))
                .join('') || '';
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
    navigator.clipboard.writeText(text).then(() => toast.show('Copied to clipboard'));
  };

  const swapMode = () => {
    setMode(mode === 'encode' ? 'decode' : 'encode');
    setInput(output);
    setOutput(input);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  const examples: Record<EncodingType, Record<'encode' | 'decode', string>> = {
    base64: { encode: 'Hello World', decode: 'SGVsbG8gV29ybGQ=' },
    url: { encode: 'Hello World!', decode: 'Hello%20World%21' },
    hex: { encode: 'ABC', decode: '414243' },
    binary: { encode: 'ABC', decode: '01000001 01000010 01000011' },
  };

  const loadExample = () => {
    setInput(examples[encodingType][mode]);
  };

  const inputLabel = mode === 'encode' ? 'Plain Text' : `${encodingType.toUpperCase()} Input`;
  const outputLabel = mode === 'encode' ? `${encodingType.toUpperCase()} Output` : 'Plain Text';

  return (
    <div className="max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Binary className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Encoder / Decoder</CardTitle>
              <p className="text-muted-foreground text-sm">
                Encode and decode text in various formats
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-4 p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <div className="space-y-2">
              <Label>Encoding Type</Label>
              <Select
                value={encodingType}
                onValueChange={(v) => setEncodingType(v as EncodingType)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base64">Base64</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="hex">Hex</SelectItem>
                  <SelectItem value="binary">Binary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mode</Label>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'encode' | 'decode')}>
                <TabsList>
                  <TabsTrigger value="encode">Encode</TabsTrigger>
                  <TabsTrigger value="decode">Decode</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={swapMode} title="Swap input ↔ output">
                <ArrowLeftRight className="w-4 h-4 mr-1.5" />
                Swap
              </Button>
              <Button variant="outline" size="sm" onClick={loadExample}>
                <Shuffle className="w-4 h-4 mr-1.5" />
                Example
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll}>
                <Trash2 className="w-4 h-4 mr-1.5" />
                Clear
              </Button>
            </div>
          </div>

          {/* Input / Output */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{inputLabel}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(input)}
                  disabled={!input}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  mode === 'encode'
                    ? 'Enter text to encode...'
                    : `Enter ${encodingType} to decode...`
                }
                className="font-mono text-sm h-48 resize-none"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{outputLabel}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(output)}
                  disabled={!output}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={output}
                readOnly
                placeholder="Output will appear here..."
                className="font-mono text-sm h-48 resize-none"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Info panel */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">About {encodingType.toUpperCase()}</h4>
              <p className="text-sm text-muted-foreground">{ENCODING_INFO[encodingType]}</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default EncoderDecoder;
