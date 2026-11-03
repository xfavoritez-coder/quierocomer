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
  historial: '/pos/historial',
  caja: '/pos/caja',
  mesas: '/pos/config/mesas',
  garzones: '/pos/config/garzones',
  impresora: '/pos/config',
  sonido: '/pos/config/sonido',
}

// Drawer de Ajustes del POS (caja, mesas, garzones, impresora). Compartido por
// todas las pantallas del POS para que el menú del header sea idéntico.
export default function PosMenuDrawer({ cashSession, restaurant, onClose, onNavigate, onInline }: { cashSession: boolean; restaurant: PosRestaurant | null; onClose: () => void; onNavigate: (url: string) => void; onInline?: (id: string) => void }) {
  const items: DrawerItem[] = [
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
      label: 'Configurar mesas',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
      inline: 'mesas',
    },
    {
      label: 'Garzones',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>,
      inline: 'garzones',
    },
    {
      label: 'Impresora',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="3" width="12" height="6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/></svg>,
      inline: 'impresora',
    },
    {
      label: 'Sonido de pedidos',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>,
      inline: 'sonido',
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
