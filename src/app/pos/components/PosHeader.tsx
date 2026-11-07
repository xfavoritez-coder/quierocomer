'use client'

import { useState, useRef, useEffect } from 'react'
import { usePendingSyncCount } from '@/lib/pos'

interface BranchOption { id: string; name: string; branchName?: string | null }

interface PosHeaderProps {
  mode?: 'brand' | 'back'
  eyebrow?: string
  subtitle?: string
  storeName?: string
  branchName?: string | null
  syncing?: boolean
  onBack?: () => void
  onMenu?: () => void
  onPendingClick?: () => void
  onBrandClick?: () => void
  rightSlot?: React.ReactNode
  centerSlot?: React.ReactNode
  branches?: BranchOption[]
  selectedBranchMode?: string
  onBranchSelect?: (id: string) => void
}

export default function PosHeader({
  mode = 'brand', eyebrow, subtitle, storeName, branchName, onBack, onMenu, onPendingClick, onBrandClick, rightSlot, centerSlot,
  branches, selectedBranchMode, onBranchSelect,
}: PosHeaderProps) {
  const pendingCount = usePendingSyncCount()
  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropOpen) return
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const showBranchDrop = branches && branches.length > 1 && onBranchSelect
  const isAllMode = selectedBranchMode === 'todas'
  const activeBranch = showBranchDrop && !isAllMode
    ? branches.find(b => b.id === selectedBranchMode)
    : null
  const displayBranchName = isAllMode
    ? 'Todas las sucursales'
    : (activeBranch?.branchName ?? activeBranch?.name ?? branchName ?? null)

  return (
    <header className={`pos-bar${centerSlot ? ' has-center' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {onMenu && (
          <button className="pos-hamburger" onClick={onMenu} aria-label="Menú">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18"/>
            </svg>
          </button>
        )}
        {mode === 'brand' ? (
          <div ref={dropRef} style={{ position: 'relative' }}>
            <div
              className="pos-brand"
              onClick={showBranchDrop ? () => setDropOpen(o => !o) : onBrandClick}
              style={{ cursor: showBranchDrop || onBrandClick ? 'pointer' : undefined }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="QuieroComer" className="mk-logo" />
              {storeName && (
                <div className="pos-brand-store">
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{storeName}</span>
                  {displayBranchName && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color: isAllMode ? 'var(--amber-press)' : 'var(--ink-3)' }}>
                      {displayBranchName}
                      {showBranchDrop && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.6, transition: 'transform .15s', transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
            {showBranchDrop && dropOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 100,
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 200, overflow: 'hidden',
              }}>
                {branches.map(b => {
                  const label = b.branchName || b.name
                  const isActive = selectedBranchMode === b.id
                  return (
                    <button
                      key={b.id}
                      onClick={() => { onBranchSelect(b.id); setDropOpen(false) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '10px 14px', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--sans)', fontSize: 13, fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--amber-press)' : 'var(--ink)',
                        background: isActive ? 'var(--amber-tint)' : 'transparent',
                      }}
                    >
                      {isActive && <span style={{ marginRight: 6 }}>✓</span>}
                      {label}
                    </button>
                  )
                })}
                <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                <button
                  onClick={() => { onBranchSelect('todas'); setDropOpen(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--sans)', fontSize: 13, fontWeight: isAllMode ? 700 : 500,
                    color: isAllMode ? 'var(--amber-press)' : 'var(--ink)',
                    background: isAllMode ? 'var(--amber-tint)' : 'transparent',
                  }}
                >
                  {isAllMode && <span style={{ marginRight: 6 }}>✓</span>}
                  Todas las sucursales
                </button>
              </div>
            )}
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
      </div>

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
      </div>
    </header>
  )
}
