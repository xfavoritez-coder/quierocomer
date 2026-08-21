'use client'

import { useOnlineStatus, usePendingSyncCount } from '@/lib/pos'

interface PosHeaderProps {
  title: string
  syncing?: boolean
  onBack?: () => void
}

export default function PosHeader({ title, syncing, onBack }: PosHeaderProps) {
  const online = useOnlineStatus()
  const pendingCount = usePendingSyncCount()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-white/80 backdrop-blur-lg border-b border-stone-100">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-stone-100 transition-colors -ml-2"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <h1
          className="text-lg font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {pendingCount > 0 && (
          <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-medium tabular-nums">
            {pendingCount}
          </span>
        )}
        {syncing && (
          <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
        )}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              online ? 'bg-emerald-500' : 'bg-red-400'
            }`}
          />
        </div>
      </div>
    </header>
  )
}
