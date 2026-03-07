import { useEffect, useState } from 'react'
import { Navbar } from './components/Navbar.js'
import { TerminalPane } from './components/TerminalPane.js'
import { ApiTester } from './components/ApiTester.js'
import type { OsImage } from './types/index.js'

type Tab = 'terminal' | 'api'

export default function App() {
  const [tab, setTab] = useState<Tab>('terminal')
  const [osImages, setOsImages] = useState<OsImage[]>([])

  // Fetch OS images from backend (falls back gracefully)
  useEffect(() => {
    fetch('/api/os-images')
      .then((r) => r.json())
      .then((data: OsImage[]) => setOsImages(data))
      .catch(() => {
        // Fallback if backend is not running yet
        setOsImages([
          { id: 'ubuntu',    label: 'Ubuntu 22.04', image: 'ubuntu:22.04',          shell: 'bash', description: 'Most popular Linux distro.', badge: 'LTS'     },
          { id: 'debian',    label: 'Debian 12',    image: 'debian:bookworm-slim',   shell: 'bash', description: 'Stable, minimal Debian.',      badge: 'Stable' },
          { id: 'alpine',    label: 'Alpine 3.19',  image: 'alpine:3.19',            shell: 'sh',   description: 'Ultra-lightweight, 5 MB.',     badge: 'Tiny'   },
          { id: 'fedora',    label: 'Fedora 40',    image: 'fedora:40',              shell: 'bash', description: 'Cutting-edge RHEL-based.',      badge: 'Latest' },
          { id: 'archlinux', label: 'Arch Linux',   image: 'archlinux:base',         shell: 'bash', description: 'Rolling release. Minimal.',    badge: 'Rolling'},
        ])
      })
  }, [])

  return (
    <div className="flex flex-col min-h-dvh bg-surface-950">
      <Navbar activeTab={tab} onTabChange={setTab} />

      {/* Subtle radial gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-brand-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-indigo-600/4 rounded-full blur-3xl" />
      </div>

      <main className="flex-1 flex flex-col max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-5 min-h-0">
        {tab === 'terminal' ? (
          <div className="flex-1 flex flex-col min-h-0" style={{ height: 'calc(100dvh - 56px - 2.5rem)' }}>
            <TerminalPane osImages={osImages} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0" style={{ height: 'calc(100dvh - 56px - 2.5rem)' }}>
            <ApiTester />
          </div>
        )}
      </main>
    </div>
  )
}
