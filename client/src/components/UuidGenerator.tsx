import React, { useState } from 'react';

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyAllToClipboard = () => {
    navigator.clipboard.writeText(uuids.join('\n'));
  };

  const clearAll = () => {
    setUuids([]);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-lg">
        <h3 className="text-white text-2xl font-semibold mb-6">UUID Generator</h3>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Version</label>
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value as UUIDVersion)}
              className="bg-slate-800/40 text-white px-3 py-2 rounded-md"
            >
              <option value="v4">UUID v4 (Random)</option>
              <option value="v1">UUID v1 (Time-based)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Count</label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="bg-slate-800/40 text-white px-3 py-2 rounded-md"
            >
              <option value={1}>1</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hyphens"
                checked={hyphens}
                onChange={(e) => setHyphens(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="hyphens" className="text-sm text-slate-300">
                Hyphens
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={generateUUIDs}
              className="px-4 py-2 bg-brand-600 rounded-md text-white hover:bg-brand-700"
            >
              Generate
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Version Info */}
        <div className="mb-6 bg-slate-800/40 p-4 rounded">
          <h4 className="text-white font-semibold mb-2">
            UUID {version.toUpperCase()}
          </h4>
          <div className="text-sm text-slate-300">
            {version === 'v4' && (
              <p>Version 4 UUIDs are randomly generated and provide the highest entropy. They are suitable for most applications where uniqueness is the primary requirement.</p>
            )}
            {version === 'v1' && (
              <p>Version 1 UUIDs are based on timestamp and MAC address. They can reveal when and where the UUID was generated, which may be a privacy concern.</p>
            )}
          </div>
        </div>

        {/* Generated UUIDs */}
        {uuids.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-semibold">Generated UUIDs ({uuids.length})</h4>
              <button
                onClick={copyAllToClipboard}
                className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600"
              >
                Copy All
              </button>
            </div>

            <div className="bg-slate-800/40 rounded max-h-96 overflow-auto">
              {uuids.map((uuid, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border-b border-slate-700/50 last:border-b-0"
                >
                  <div className="font-mono text-sm text-white break-all">
                    {uuid}
                  </div>
                  <button
                    onClick={() => copyToClipboard(uuid)}
                    className="ml-2 px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600 shrink-0"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UUID Information */}
        <div className="bg-slate-800/40 p-4 rounded">
          <h4 className="text-white font-semibold mb-3">About UUIDs</h4>
          <div className="text-sm text-slate-300 space-y-2">
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
        </div>
      </div>
    </div>
  );
};

export default UuidGenerator;