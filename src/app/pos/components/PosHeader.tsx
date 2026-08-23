'use client'

import { usePendingSyncCount } from '@/lib/pos'

interface PosHeaderProps {
  mode?: 'brand' | 'back'
  eyebrow?: string
  subtitle?: string
  syncing?: boolean
  onBack?: () => void
  onMenu?: () => void
  onPendingClick?: () => void
  onBrandClick?: () => void
  rightSlot?: React.ReactNode
  centerSlot?: React.ReactNode
}

export default function PosHeader({
  mode = 'brand', eyebrow, subtitle, onBack, onMenu, onPendingClick, onBrandClick, rightSlot, centerSlot,
}: PosHeaderProps) {
  const pendingCount = usePendingSyncCount()

  return (
    <header className={`pos-bar${centerSlot ? ' has-center' : ''}`}>
      {mode === 'brand' ? (
        <div className="pos-brand" onClick={onBrandClick} style={onBrandClick ? { cursor: 'pointer' } : undefined}>
          <span className="mk">Q</span>
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

      {centerSlot && <div className="pos-bar-center">{centerSlot}</div>}

      <div className="pos-bar-right">
        {mode === 'brand' && pendingCount > 0 && (
          <button
            className="pos-pending-btn"
            onClick={onPendingClick}
            title={`${pendingCount} eventos pendientes de sincronizar`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 8v4l3 3"/>
              <circle cx="12" cy="12" r="9"/>
            </svg>
            {pendingCount}
          </button>
        )}
        {rightSlot}
        {onMenu && (
          <button className="pos-hamburger" onClick={onMenu} aria-label="Menú">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18"/>
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}
