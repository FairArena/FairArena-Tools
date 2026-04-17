import { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar.js';
import { TerminalPane } from './components/TerminalPane.js';
import { ApiTester } from './components/ApiTester.js';
import { WebhookDumper } from './components/WebhookDumper.js';
import { Guide } from './components/Guide.js';
import { ClipSync } from './components/ClipSync.js';
import { UrlShortener } from './components/UrlShortener.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { NotFound } from './components/NotFound.js';
import { API_BASE } from './hooks/useTerminalSession.js';
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Key,
  FileJson,
  Hash,
  Fingerprint,
  Lock,
  Calculator,
  Globe,
  Radio,
  Mail,
} from 'lucide-react';
import { Spinner } from './components/Loading.js';
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
import RateLimitTester from './components/RateLimitTester';
import type { OsImage } from './types/index.js';
import ToastProvider from './components/ToastProvider';
import { Analytics } from '@vercel/analytics/react';
import { Spotlight } from './components/ui/spotlight-new.js';
import Footer from './components/Footer.js';

type Tab =
  | 'terminal'
  | 'api'
  | 'dev-tools'
  | 'network'
  | 'encoders'
  | 'webhook'
  | 'guide'
  | 'clipsync'
  | 'tempmail'
  | 'rate-limit'
  | 'url-shortener';

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-24 text-neutral-500">
    <Spinner className="w-5 h-5" />
  </div>
);

function DevToolsTabs() {
  return (
    <Tabs defaultValue="jwt" className="h-full flex flex-col min-h-0">
      <TabsList className="h-auto shrink-0 bg-neutral-900/60 border border-neutral-800 rounded-xl p-1.5 flex gap-1 overflow-x-auto no-scrollbar w-full mb-4">
        <TabsTrigger
          value="jwt"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-brand-500/10 data-[state=active]:border data-[state=active]:border-brand-500/30"
        >
          <Key className="w-3.5 h-3.5" />
          JWT
        </TabsTrigger>
        <TabsTrigger
          value="json"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-brand-500/10 data-[state=active]:border data-[state=active]:border-brand-500/30"
        >
          <FileJson className="w-3.5 h-3.5" />
          JSON
        </TabsTrigger>
        <TabsTrigger
          value="hash"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
        >
          <Hash className="w-3.5 h-3.5" />
          Hash
        </TabsTrigger>
        <TabsTrigger
          value="uuid"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
        >
          <Fingerprint className="w-3.5 h-3.5" />
          UUID
        </TabsTrigger>
        <TabsTrigger
          value="password"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-brand-500/10 data-[state=active]:border data-[state=active]:border-brand-500/30"
        >
          <Lock className="w-3.5 h-3.5" />
          Password
        </TabsTrigger>
        <TabsTrigger
          value="number"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-brand-500/10 data-[state=active]:border data-[state=active]:border-brand-500/30"
        >
          <Calculator className="w-3.5 h-3.5" />
          Numbers
        </TabsTrigger>
      </TabsList>
      <div className="flex-1 min-h-0 overflow-hidden">
        <TabsContent value="jwt" className="h-full mt-0">
          <React.Suspense fallback={<LoadingFallback />}>
            <JwtDecoder />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="json" className="h-full mt-0">
          <React.Suspense fallback={<LoadingFallback />}>
            <JsonFormatter />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="hash" className="h-full mt-0">
          <React.Suspense fallback={<LoadingFallback />}>
            <HashGenerator />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="uuid" className="h-full mt-0">
          <React.Suspense fallback={<LoadingFallback />}>
            <UuidGenerator />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="password" className="h-full mt-0">
          <React.Suspense fallback={<LoadingFallback />}>
            <PasswordGenerator />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="number" className="h-full mt-0">
          <React.Suspense fallback={<LoadingFallback />}>
            <NumberBaseConverter />
          </React.Suspense>
        </TabsContent>
      </div>
    </Tabs>
  );
}

function NetworkToolsTabs() {
  return (
    <Tabs defaultValue="dns" className="h-full flex flex-col min-h-0">
      <TabsList className="h-auto shrink-0 bg-neutral-900/60 border border-neutral-800 rounded-xl p-1.5 flex gap-1 overflow-x-auto no-scrollbar w-full mb-4">
        <TabsTrigger
          value="dns"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-brand-500/10 data-[state=active]:border data-[state=active]:border-brand-500/30"
        >
          <Globe className="w-3.5 h-3.5" />
          DNS
        </TabsTrigger>
        <TabsTrigger
          value="sse"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-brand-500/10 data-[state=active]:border data-[state=active]:border-brand-500/30"
        >
          <Radio className="w-3.5 h-3.5" />
          SSE
        </TabsTrigger>
        <TabsTrigger
          value="email"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-brand-500/10 data-[state=active]:border data-[state=active]:border-brand-500/30"
        >
          <Mail className="w-3.5 h-3.5" />
          Email Security
        </TabsTrigger>
      </TabsList>
      <div className="flex-1 min-h-0 overflow-hidden">
        <TabsContent value="dns" className="h-full mt-0">
          <React.Suspense fallback={<LoadingFallback />}>
            <DnsInspector />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="sse" className="h-full mt-0">
          <React.Suspense fallback={<LoadingFallback />}>
            <SSEListener />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="email" className="h-full mt-0">
          <React.Suspense fallback={<LoadingFallback />}>
            <EmailSecurityChecker />
          </React.Suspense>
        </TabsContent>
      </div>
    </Tabs>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    // Auto-select ClipSync if the URL hash contains a room link
    if (typeof window !== 'undefined') {
      if (/^#clipsync\/[a-z0-9]{6,12}\//.test(window.location.hash)) return 'clipsync';
      if (window.matchMedia('(max-width: 639px)').matches) return 'api';
    }
    return 'terminal';
  });
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
    <ErrorBoundary>
      <ToastProvider>
        <div className="flex relative flex-col overflow-x-hidden w-full h-auto bg-neutral-950">
          <Analytics />
          <Navbar activeTab={tab} onTabChange={setTab} />
          <Spotlight />
          {/* Subtle radial gradient backdrop */}
          <div className="pointer-events-none fixed inset-0 -z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-brand-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-brand-500/3 rounded-full blur-3xl" />
            {tab === 'webhook' && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-brand-500/3 rounded-full blur-3xl" />
            )}
          </div>

          <main className="flex-1 flex mt-10 flex-col min-h-0 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-5">
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
                <React.Suspense
                  fallback={
                    <div className="flex items-center justify-center h-64">
                      <Spinner />
                    </div>
                  }
                >
                  <EncoderDecoder />
                </React.Suspense>
              ) : tab === 'webhook' ? (
                <WebhookDumper />
              ) : tab === 'guide' ? (
                <Guide />
              ) : tab === 'clipsync' ? (
                <ClipSync />
              ) : tab === 'url-shortener' ? (
                <UrlShortener />
              ) : tab === 'rate-limit' ? (
                <RateLimitTester />
              ) : (
                <NotFound />
              )}
            </div>
          </main>

          <Footer onTabChange={setTab} />
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}
