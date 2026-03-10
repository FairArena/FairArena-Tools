import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Hash, Trash2 } from 'lucide-react';
import { useToast } from './ToastProvider';

type UUIDVersion = 'v4' | 'v1';

export const UuidGenerator: React.FC = () => {
  const [uuids, setUuids] = useState<string[]>([]);
  const [version, setVersion] = useState<UUIDVersion>('v4');
  const [count, setCount] = useState(1);
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);

  const generateUUIDv4 = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const generateUUIDv1 = (): string => {
    // Simple v1-like UUID (not RFC compliant, for demo purposes)
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    const node = 'xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

    const timeHigh = ((timestamp >> 32) & 0xFFFF).toString(16).padStart(4, '0');
    const timeMid = ((timestamp >> 16) & 0xFFFF).toString(16).padStart(4, '0');
    const timeLow = (timestamp & 0xFFFF).toString(16).padStart(4, '0');

    return `${timeLow}${timeMid}-1${timeHigh.slice(0, 3)}-1xxx-${random.toString(16).padStart(4, '0')}-${node}`;
  };

  const generateUUIDs = () => {
    const newUuids: string[] = [];
    for (let i = 0; i < count; i++) {
      let uuid = version === 'v4' ? generateUUIDv4() : generateUUIDv1();
      if (uppercase) uuid = uuid.toUpperCase();
      if (!hyphens) uuid = uuid.replace(/-/g, '');
      newUuids.push(uuid);
    }
    setUuids(newUuids);
  };

  const toast = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.show('Copied to clipboard'));
  };

  const copyAllToClipboard = () => {
    navigator.clipboard.writeText(uuids.join('\n')).then(() => toast.show('Copied all UUIDs'));
  };

  const clearAll = () => {
    setUuids([]);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-6 w-6" />
            UUID Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>Version</Label>
              <Select value={version} onValueChange={(value) => setVersion(value as UUIDVersion)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v4">UUID v4 (Random)</SelectItem>
                  <SelectItem value="v1">UUID v1 (Time-based)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Count</Label>
              <Select value={count.toString()} onValueChange={(value) => setCount(Number(value))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="uppercase"
                  checked={uppercase}
                  onCheckedChange={(checked) => setUppercase(checked as boolean)}
                />
                <Label htmlFor="uppercase">Uppercase</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hyphens"
                  checked={hyphens}
                  onCheckedChange={(checked) => setHyphens(checked as boolean)}
                />
                <Label htmlFor="hyphens">Hyphens</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={generateUUIDs}>
                Generate
              </Button>
              <Button variant="outline" onClick={clearAll}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          {/* Version Info */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">
                UUID {version.toUpperCase()}
              </h4>
              <div className="text-sm text-muted-foreground">
                {version === 'v4' && (
                  <p>Version 4 UUIDs are randomly generated and provide the highest entropy. They are suitable for most applications where uniqueness is the primary requirement.</p>
                )}
                {version === 'v1' && (
                  <p>Version 1 UUIDs are based on timestamp and MAC address. They can reveal when and where the UUID was generated, which may be a privacy concern.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generated UUIDs */}
          {uuids.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated UUIDs ({uuids.length})</CardTitle>
                  <Button variant="outline" size="sm" onClick={copyAllToClipboard}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {uuids.map((uuid, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div className="font-mono text-sm break-all flex-1 mr-2">
                          {uuid}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(uuid)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* UUID Information */}
          <Card>
            <CardHeader>
              <CardTitle>About UUIDs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>UUID (Universally Unique Identifier):</strong> A 128-bit number used to uniquely identify information in computer systems.
                </p>
                <p>
                  <strong>Format:</strong> 8-4-4-4-12 hexadecimal digits, totaling 36 characters including hyphens.
                </p>
                <p>
                  <strong>Uniqueness:</strong> The probability of generating duplicate UUIDs is extremely low (approximately 2^128 possibilities).
                </p>
                <p>
                  <strong>Use Cases:</strong> Database keys, session IDs, resource identifiers, and anywhere unique identification is needed.
                </p>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default UuidGenerator;