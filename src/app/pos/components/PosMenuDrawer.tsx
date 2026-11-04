'use client'

import type { PosRestaurant } from '../lib/usePosRestaurant'
import PosTiemposInline from './PosTiemposInline'

type DrawerItem = {
  label: string
  icon: React.ReactNode
  inline?: string
  href?: string
}

// Fallback URLs for inline items when onInline is not provided (e.g. from PosTopBar)
const INLINE_FALLBACK_URLS: Record<string, string> = {
  carta: '/pos/carta',
  caja: '/pos/caja',
  config: '/pos',
}

// Drawer de Ajustes del POS (caja, mesas, garzones, impresora). Compartido por
// todas las pantallas del POS para que el menú del header sea idéntico.
export default function PosMenuDrawer({ cashSession, restaurant, onClose, onNavigate, onInline }: { cashSession: boolean; restaurant: PosRestaurant | null; onClose: () => void; onNavigate: (url: string) => void; onInline?: (id: string) => void }) {
  const items: DrawerItem[] = [
    {
      label: 'KDS',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
      href: '/pos/kds',
    },
    {
      label: 'Carta',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
      inline: 'carta',
    },
    {
      label: 'Historial de pedidos',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>,
      inline: 'historial',
    },
    {
      label: 'Caja',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M7 15h3"/></svg>,
      inline: 'caja',
    },
    {
      label: 'Reportes',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
      inline: 'reportes',
    },
    {
      label: 'Configuración',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
      inline: 'config',
    },
  ]

  return (
    <>
      <div className="pos-drawer-overlay" onClick={onClose} />
      <div className="pos-drawer">
        <div className="pos-drawer-header" style={{ borderBottom: '1px solid var(--line)', gap: 10 }}>
          {restaurant ? (
            <>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--amber-tint)', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {restaurant.logoUrl
                  ? <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: 'var(--amber-press)' }}>{restaurant.name.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant.name}</div>
                {restaurant.branchName && <div style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant.branchName}</div>}
              </div>
            </>
          ) : (
            <span style={{ flex: 1 }} />
          )}
          <button onClick={onClose} className="pos-drawer-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="pos-drawer-items">
          {/* Tiempos de entrega — editables inline, arriba del menú */}
          {restaurant?.id && <PosTiemposInline restaurantId={restaurant.id} />}
          {items.map(item => (
            <button
              key={item.label}
              className="pos-drawer-item"
              onClick={() => {
                onClose()
                if (item.inline) {
                  if (onInline) {
                    onInline(item.inline)
                  } else {
                    const fallback = INLINE_FALLBACK_URLS[item.inline]
                    if (fallback) onNavigate(fallback)
                  }
                } else if (item.href) {
                  onNavigate(item.href)
                }
              }}
            >
              <span className="pos-drawer-ic">{item.icon}</span>
              <span>{item.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
