import { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar.js';
import { TerminalPane } from './components/TerminalPane.js';
import { ApiTester } from './components/ApiTester.js';
import { WebhookDumper } from './components/WebhookDumper.js';
import { Guide } from './components/Guide.js';
import { API_BASE } from './hooks/useTerminalSession.js';
import React from 'react';
const DnsInspector = React.lazy(() => import('./components/DnsInspector'));
const SSEListener = React.lazy(() => import('./components/SSEListener'));
const EmailSecurityChecker = React.lazy(() => import('./components/EmailSecurityChecker'));
const JwtDecoder = React.lazy(() => import('./components/JwtDecoder'));
const EncoderDecoder = React.lazy(() => import('./components/EncoderDecoder'));
const JsonFormatter = React.lazy(() => import('./components/JsonFormatter'));
const HashGenerator = React.lazy(() => import('./components/HashGenerator'));
const UuidGenerator = React.lazy(() => import('./components/UuidGenerator'));
const PasswordGenerator = React.lazy(() => import('./components/PasswordGenerator'));
const NumberBaseConverter = React.lazy(() => import('./components/NumberBaseConverter'));
import type { OsImage } from './types/index.js';
import { Analytics } from "@vercel/analytics/react";

type Tab = 'terminal' | 'api' | 'dev-tools' | 'network' | 'encoders' | 'webhook' | 'guide';

type DevToolTab = 'jwt' | 'json' | 'hash' | 'uuid' | 'password' | 'number';
type NetworkToolTab = 'dns' | 'sse' | 'email';

function DevToolsTabs() {
  const [activeTab, setActiveTab] = useState<DevToolTab>('jwt');

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg mb-4">
        {[
          { id: 'jwt' as DevToolTab, label: 'JWT', icon: '🔐' },
          { id: 'json' as DevToolTab, label: 'JSON', icon: '📄' },
          { id: 'hash' as DevToolTab, label: 'Hash', icon: '🔒' },
          { id: 'uuid' as DevToolTab, label: 'UUID', icon: '🆔' },
          { id: 'password' as DevToolTab, label: 'Password', icon: '🔑' },
          { id: 'number' as DevToolTab, label: 'Numbers', icon: '🔢' },
        ].map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTab(tool.id)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === tool.id
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span className="mr-1">{tool.icon}</span>
            {tool.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'jwt' && (
          <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
            <JwtDecoder />
          </React.Suspense>
        )}
        {activeTab === 'json' && (
          <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
            <JsonFormatter />
          </React.Suspense>
        )}
        {activeTab === 'hash' && (
          <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
            <HashGenerator />
          </React.Suspense>
        )}
        {activeTab === 'uuid' && (
          <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
            <UuidGenerator />
          </React.Suspense>
        )}
        {activeTab === 'password' && (
          <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
            <PasswordGenerator />
          </React.Suspense>
        )}
        {activeTab === 'number' && (
          <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
            <NumberBaseConverter />
          </React.Suspense>
        )}
      </div>
    </div>
  );
}

function NetworkToolsTabs() {
  const [activeTab, setActiveTab] = useState<NetworkToolTab>('dns');

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg mb-4">
        {[
          { id: 'dns' as NetworkToolTab, label: 'DNS', icon: '🌐' },
          { id: 'sse' as NetworkToolTab, label: 'SSE', icon: '📡' },
          { id: 'email' as NetworkToolTab, label: 'Email', icon: '📧' },
        ].map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTab(tool.id)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === tool.id
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span className="mr-1">{tool.icon}</span>
            {tool.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dns' && (
          <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
            <DnsInspector />
          </React.Suspense>
        )}
        {activeTab === 'sse' && (
          <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
            <SSEListener />
          </React.Suspense>
        )}
        {activeTab === 'email' && (
          <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
            <EmailSecurityChecker />
          </React.Suspense>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('terminal');
  const [osImages, setOsImages] = useState<OsImage[]>([]);

  // Fetch OS images from backend (falls back gracefully)
  useEffect(() => {
    fetch(`${API_BASE}/api/os-images`)
      .then((r) => r.json())
      .then((data: OsImage[]) => setOsImages(data))
      .catch(() => {
        // Fallback if backend is not running yet
        setOsImages([
          {
            id: 'ubuntu',
            label: 'Ubuntu 22.04',
            image: 'ubuntu:22.04',
            shell: 'bash',
            description: 'Most popular Linux distro.',
            badge: 'LTS',
          },
          {
            id: 'debian',
            label: 'Debian 12',
            image: 'debian:bookworm-slim',
            shell: 'bash',
            description: 'Stable, minimal Debian.',
            badge: 'Stable',
          },
          {
            id: 'alpine',
            label: 'Alpine 3.19',
            image: 'alpine:3.19',
            shell: 'sh',
            description: 'Ultra-lightweight, 5 MB.',
            badge: 'Tiny',
          },
          {
            id: 'fedora',
            label: 'Fedora 40',
            image: 'fedora:40',
            shell: 'bash',
            description: 'Cutting-edge RHEL-based.',
            badge: 'Latest',
          },
          {
            id: 'archlinux',
            label: 'Arch Linux',
            image: 'archlinux:base',
            shell: 'bash',
            description: 'Rolling release. Minimal.',
            badge: 'Rolling',
          },
        ]);
      });
  }, []);

  return (
    <div className="flex flex-col min-h-dvh bg-surface-950">
      <Analytics/>
      <Navbar activeTab={tab} onTabChange={setTab} />

      {/* Subtle radial gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-brand-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-indigo-600/4 rounded-full blur-3xl" />
        {tab === 'webhook' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-violet-600/3 rounded-full blur-3xl" />
        )}
      </div>

      <main className="flex-1 flex flex-col min-h-0 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-5">
        <div className="flex-1 min-h-0 overflow-hidden">
          {tab === 'terminal' ? (
            <TerminalPane osImages={osImages} />
          ) : tab === 'api' ? (
            <ApiTester />
          ) : tab === 'dev-tools' ? (
            <DevToolsTabs />
          ) : tab === 'network' ? (
            <NetworkToolsTabs />
          ) : tab === 'encoders' ? (
            <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
              <EncoderDecoder />
            </React.Suspense>
          ) : tab === 'webhook' ? (
            <WebhookDumper />
          ) : tab === 'guide' ? (
            <Guide />
          ) : null}
        </div>
      </main>
    </div>
  );
}
