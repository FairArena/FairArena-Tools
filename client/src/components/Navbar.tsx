import { Zap, Terminal, Globe, Code2, Network, Binary, Webhook, BookOpen, Link2 } from 'lucide-react';

type TabId = 'terminal' | 'api' | 'dev-tools' | 'network' | 'encoders' | 'webhook' | 'guide' | 'clipsync';

interface NavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const NAV_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'terminal', label: 'Terminal', icon: <Terminal className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'api', label: 'API Tester', icon: <Globe className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'dev-tools', label: 'Dev Tools', icon: <Code2 className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'network', label: 'Network', icon: <Network className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'encoders', label: 'Encoders', icon: <Binary className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'webhook', label: 'Webhooks', icon: <Webhook className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'clipsync', label: 'ClipSync', icon: <Link2 className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'guide', label: 'Guide', icon: <BookOpen className="w-3.5 h-3.5 shrink-0" /> },
];

export function Navbar({ activeTab, onTabChange }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-3">
        {/* ── Logo ── */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-white text-sm tracking-tight hidden sm:block">
            FairArena
          </span>
        </div>

        {/* ── Separator ── */}
        <div className="h-5 w-px bg-slate-800 hidden sm:block shrink-0" />

        {/* ── Nav tabs ── */}
        <nav
          className="flex items-stretch h-14 overflow-x-auto no-scrollbar gap-0.5 flex-1"
          role="tablist"
          aria-label="Main navigation"
        >
            {NAV_TABS.map(({ id, label, icon }) => {
              const visibilityClass =
              id === 'terminal' || id === 'webhook' ? 'hidden sm:flex' : 'flex';
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => onTabChange(id)}
                  className={[
                    `${visibilityClass} relative items-center gap-1.5 px-3 h-full text-xs font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm`,
                    activeTab === id ? 'text-white' : 'text-slate-400 hover:text-slate-100',
                  ].join(' ')}
                >
                  {icon}
                  <span className="hidden sm:inline">{label}</span>
                  {/* Active underline */}
                  {activeTab === id && (
                    <span
                      aria-hidden
                      className="absolute bottom-0 inset-x-1 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    />
                  )}
                </button>
              );
            })}
        </nav>

        {/* ── Status badge ── */}
        <div className="flex items-center shrink-0">
          <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/70 border border-slate-800 px-2.5 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
            Free · No login
          </span>
        </div>
      </div>
    </header>
  );
}
