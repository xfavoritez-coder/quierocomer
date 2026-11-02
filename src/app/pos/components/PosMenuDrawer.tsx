'use client'

import type { PosRestaurant } from '../lib/usePosRestaurant'
import PosTiemposInline from './PosTiemposInline'

// Drawer de Ajustes del POS (caja, mesas, garzones, impresora). Compartido por
// todas las pantallas del POS para que el menú del header sea idéntico.
export default function PosMenuDrawer({ cashSession, restaurant, onClose, onNavigate }: { cashSession: boolean; restaurant: PosRestaurant | null; onClose: () => void; onNavigate: (url: string) => void }) {
  const items = [
    {
      label: cashSession ? 'Ver caja' : 'Abrir caja',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M7 15h3"/></svg>,
      href: '/pos/caja',
    },
    {
      label: 'Configurar mesas',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
      href: '/pos/config/mesas',
    },
    {
      label: 'Garzones',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>,
      href: '/pos/config/garzones',
    },
    {
      label: 'Impresora',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="3" width="12" height="6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/></svg>,
      href: '/pos/config',
    },
    {
      label: 'Sonido de pedidos',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>,
      href: '/pos/config/sonido',
    },
  ]

  return (
    <>
      <div className="pos-drawer-overlay" onClick={onClose} />
      <div className="pos-drawer">
        {restaurant && (
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--amber-tint)', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {restaurant.logoUrl
                  ? <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--amber-press)' }}>{restaurant.name.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>POS · {restaurant.slug}</div>
              </div>
            </div>
          </div>
        )}
        <div className="pos-drawer-header" style={restaurant ? { borderBottom: 0, paddingTop: 12, paddingBottom: 8 } : undefined}>
          <span style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Ajustes</span>
          <button onClick={onClose} className="pos-drawer-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="pos-drawer-items">
          {items.map(item => (
            <button
              key={item.label}
              className="pos-drawer-item"
              onClick={() => { onClose(); onNavigate(item.href) }}
            >
              <span className="pos-drawer-ic">{item.icon}</span>
              <span>{item.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          ))}
          {/* Tiempos de entrega — editables inline (como pidió el usuario) */}
          {restaurant?.id && <PosTiemposInline restaurantId={restaurant.id} />}
        </div>
      </div>
    </>
  )
}
