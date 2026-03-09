import { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar.js';
import { TerminalPane } from './components/TerminalPane.js';
import { ApiTester } from './components/ApiTester.js';
import { WebhookDumper } from './components/WebhookDumper.js';
import { Guide } from './components/Guide.js';
import { API_BASE } from './hooks/useTerminalSession.js';
import React from 'react';
const DnsInspector = React.lazy(() => import('./components/DnsInspector.js'));
import type { OsImage } from './types/index.js';
import { Analytics } from "@vercel/analytics/react";

type Tab = 'terminal' | 'api' | 'webhook' | 'dns' | 'guide';

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
          ) : tab === 'webhook' ? (
            <WebhookDumper />
          ) : tab === 'guide' ? (
            <Guide />
          ) : (
            // DNS inspector
            // Lazy-load to avoid increasing bundle for unrelated flows
            <React.Suspense fallback={<div className="text-slate-400">Loading...</div>}>
              <DnsInspector />
            </React.Suspense>
          )}
        </div>
      </main>
    </div>
  );
}
