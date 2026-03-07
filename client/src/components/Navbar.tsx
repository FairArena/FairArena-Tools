import { Terminal, Zap } from 'lucide-react'

interface NavbarProps {
  activeTab: 'terminal' | 'api'
  onTabChange: (tab: 'terminal' | 'api') => void
}

export function Navbar({ activeTab, onTabChange }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 glass border-b border-slate-700/50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center shadow-lg">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-white tracking-tight hidden sm:block">
            FairArena
          </span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-700 shrink-0" />

        {/* Tabs */}
        <nav className="flex items-center gap-1" role="tablist">
          <TabButton
            label="Terminal"
            icon={<TerminalIcon />}
            active={activeTab === 'terminal'}
            onClick={() => onTabChange('terminal')}
          />
          <TabButton
            label="API Tester"
            icon={<ApiIcon />}
            active={activeTab === 'api'}
            onClick={() => onTabChange('api')}
          />
        </nav>

        {/* Right badge */}
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
            Free · No login
          </span>
        </div>
      </div>
    </header>
  )
}

function TabButton({
  label, icon, active, onClick,
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-slate-700/70 text-white'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function TerminalIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function ApiIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  )
}
