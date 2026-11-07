'use client'

import { useState, useRef, useEffect } from 'react'
import { usePendingSyncCount } from '@/lib/pos'

interface BranchOption { id: string; name: string; branchName?: string | null; logoUrl?: string | null }

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

function BranchLogo({ branch, size = 36 }: { branch: BranchOption; size?: number }) {
  const initials = (branch.branchName ?? branch.name)
    .split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
  if (branch.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={branch.logoUrl}
        alt={branch.name}
        style={{ width: size, height: size, borderRadius: size * 0.28, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--line)' }}
      />
    )
  }
  // Fallback: initials with deterministic color
  const hue = branch.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: `hsl(${hue},55%,48%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--sans)', fontSize: size * 0.36, fontWeight: 900, color: '#fff',
      border: '1px solid rgba(0,0,0,.08)',
    }}>
      {initials}
    </div>
  )
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
    ? 'Todas'
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
            {/* ── Trigger ── */}
            <div
              className="pos-brand"
              onClick={showBranchDrop ? () => setDropOpen(o => !o) : onBrandClick}
              style={{ cursor: showBranchDrop || onBrandClick ? 'pointer' : undefined, userSelect: 'none' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="QuieroComer" className="mk-logo" />
              {storeName && (
                <div className="pos-brand-store">
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{storeName}</span>
                  {displayBranchName && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color: isAllMode ? 'var(--amber-press)' : 'var(--ink-3)' }}>
                      {displayBranchName}
                      {showBranchDrop && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          style={{ opacity: 0.5, transition: 'transform .15s', transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── Dropdown panel ── */}
            {showBranchDrop && dropOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 10px)', left: 0, zIndex: 200,
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
                boxShadow: '0 12px 40px rgba(0,0,0,.16)', minWidth: 260, maxWidth: 320,
                overflow: 'hidden',
              }}>
                {/* Header del panel */}
                <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Seleccionar sucursal
                  </div>
                </div>

                {/* Opciones individuales */}
                <div style={{ padding: '6px' }}>
                  {branches.map(b => {
                    const isActive = selectedBranchMode === b.id
                    return (
                      <button
                        key={b.id}
                        onClick={() => { onBranchSelect(b.id); setDropOpen(false) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          width: '100%', padding: '10px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                          background: isActive ? 'var(--amber-tint)' : 'transparent',
                          borderLeft: isActive ? '3px solid var(--amber)' : '3px solid transparent',
                          transition: '.12s',
                        }}
                      >
                        <BranchLogo branch={b} size={40} />
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, color: isActive ? 'var(--amber-press)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.name}
                          </div>
                          {b.branchName && (
                            <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: isActive ? 'var(--amber-press)' : 'var(--ink-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {b.branchName}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber-press)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Separador */}
                <div style={{ height: 1, background: 'var(--line)', margin: '0 6px' }} />

                {/* Todas las sucursales */}
                <div style={{ padding: '6px' }}>
                  <button
                    onClick={() => { onBranchSelect('todas'); setDropOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', padding: '10px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: isAllMode ? 'var(--amber-tint)' : 'transparent',
                      borderLeft: isAllMode ? '3px solid var(--amber)' : '3px solid transparent',
                      transition: '.12s',
                    }}
                  >
                    {/* Mini logos apilados */}
                    <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                      {branches.slice(0, 3).map((b, i) => (
                        <div key={b.id} style={{ position: 'absolute', top: i * 6, left: i * 6, zIndex: 3 - i }}>
                          <BranchLogo branch={b} size={28} />
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, color: isAllMode ? 'var(--amber-press)' : 'var(--ink)' }}>
                        Todas las sucursales
                      </div>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: isAllMode ? 'var(--amber-press)' : 'var(--ink-3)', marginTop: 1 }}>
                        {branches.length} locales · vista consolidada
                      </div>
                    </div>
                    {isAllMode && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber-press)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                </div>
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
