import { CheckCircle2 } from 'lucide-react'
import type { OsImage } from '../types/index.js'

const OS_ICONS: Record<string, string> = {
  ubuntu:    '🟠',
  debian:    '🌀',
  alpine:    '🏔️',
  fedora:    '🎩',
  archlinux: '🔷',
}

interface OSSelectorProps {
  images: OsImage[]
  selected: string
  disabled?: boolean
  onSelect: (id: string) => void
}

export function OSSelector({ images, selected, disabled, onSelect }: OSSelectorProps) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
        Choose Environment
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {images.map((img) => {
          const active = img.id === selected
          return (
            <button
              key={img.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(img.id)}
              className={`group relative flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 disabled:cursor-not-allowed ${
                active
                  ? 'border-brand-500/70 bg-brand-500/10 text-white'
                  : 'border-slate-700/50 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800/70'
              }`}
            >
              {/* Active check */}
              {active && (
                <CheckCircle2
                  className="absolute top-2 right-2 w-3.5 h-3.5 text-brand-400"
                  strokeWidth={2.5}
                />
              )}

              <span className="text-2xl leading-none">{OS_ICONS[img.id] ?? '🐧'}</span>

              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{img.label}</p>
                <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  active
                    ? 'bg-brand-500/20 text-brand-300'
                    : 'bg-slate-700/60 text-slate-400'
                }`}>
                  {img.badge}
                </span>
              </div>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 hidden md:block">
                {img.description}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
