'use client'

import { useOnlineStatus, usePendingSyncCount } from '@/lib/pos'

interface PosHeaderProps {
  mode?: 'brand' | 'back'
  eyebrow?: string
  subtitle?: string
  syncing?: boolean
  onBack?: () => void
  rightSlot?: React.ReactNode
}

export default function PosHeader({ mode = 'brand', eyebrow, subtitle, syncing, onBack, rightSlot }: PosHeaderProps) {
  const online = useOnlineStatus()
  const pendingCount = usePendingSyncCount()

  const dotClass = syncing ? 'dot syncing' : online ? 'dot' : 'dot offline'

  return (
    <header className="pos-bar">
      {mode === 'brand' ? (
        <div className="pos-brand">
          <span className="mk">Q</span>
          QuieroComer
          <small>POS</small>
        </div>
      ) : (
        <div className="pos-back">
          {onBack && (
            <button className="bk" onClick={onBack}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          )}
          <div>
            {eyebrow && <div className="pos-back-title">{eyebrow}</div>}
            {subtitle && <div className="pos-back-sub">{subtitle}</div>}
          </div>
        </div>
      )}

      <div className="pos-bar-right">
        {pendingCount > 0 && (
          <span className="pos-tip">{pendingCount} pend.</span>
        )}
        <div className="pos-live">
          <span className={dotClass} />
          {online ? 'En linea' : 'Sin conexion'}
        </div>
        {rightSlot}
      </div>
    </header>
  )
}
