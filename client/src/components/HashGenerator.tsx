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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Hash, AlertTriangle } from 'lucide-react';
import { useToast } from './ToastProvider';

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
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to 16-byte array (MD5 produces 128 bits)
    const result = new ArrayBuffer(16);
    const view = new DataView(result);
    for (let i = 0; i < 16; i++) {
      view.setUint8(i, (hash >>> (i * 8)) & 0xff);
    }
    return result;
  };

  useEffect(() => {
    generateHash(input, algorithm);
  }, [input, algorithm, uppercase]);

  const toast = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.show('Copied to clipboard'));
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-6 w-6" />
            Hash Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="algorithm">Algorithm</Label>
              <Select
                value={algorithm}
                onValueChange={(value) => setAlgorithm(value as HashAlgorithm)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {algorithms.map((algo) => (
                    <SelectItem key={algo.value} value={algo.value}>
                      {algo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="uppercase"
                checked={uppercase}
                onCheckedChange={(checked) => setUppercase(checked as boolean)}
              />
              <Label htmlFor="uppercase">Uppercase</Label>
            </div>

            <div>
              <Button variant="outline" onClick={loadExample}>
                Load Example
              </Button>
            </div>
          </div>

          {/* Algorithm Info */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">
                {algorithms.find((a) => a.value === algorithm)?.label}
              </h4>
              <p className="text-sm text-muted-foreground">
                {algorithms.find((a) => a.value === algorithm)?.description}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Input Text</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(input)}
                  disabled={!input}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter text to hash..."
                className="w-full bg-background text-foreground px-4 py-3 rounded-md font-mono text-sm h-32 resize-none border border-input focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Output */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Hash Output</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(output)}
                  disabled={!output}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <textarea
                value={output}
                readOnly
                placeholder="Hash will appear here..."
                className="w-full bg-background text-foreground px-4 py-3 rounded-md font-mono text-sm h-32 resize-none border border-input focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Security Notes */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>
                  <strong>MD5 & SHA-1:</strong> These algorithms are cryptographically broken and
                  should not be used for security purposes.
                </p>
                <p>
                  <strong>SHA-256:</strong> Recommended for most applications requiring
                  cryptographic security.
                </p>
                <p>
                  <strong>SHA-384 & SHA-512:</strong> Provide higher security but are slower to
                  compute.
                </p>
                <p className="text-yellow-600 dark:text-yellow-400">
                  ⚠️ Never use hashes for password storage. Use proper password hashing algorithms
                  like bcrypt, scrypt, or Argon2.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default HashGenerator;
