'use client'

import { useState } from 'react'
import type { PosRestaurant } from '../lib/usePosRestaurant'
import { isOrderSoundEnabled, setOrderSoundEnabled, primeOrderSound, playOrderAlert, getOrderSoundType, setOrderSoundType, SOUND_OPTIONS, type SoundType } from '../lib/orderSound'

// Drawer de Ajustes del POS (caja, mesas, garzones, impresora). Compartido por
// todas las pantallas del POS para que el menú del header sea idéntico.
export default function PosMenuDrawer({ cashSession, restaurant, onClose, onNavigate }: { cashSession: boolean; restaurant: PosRestaurant | null; onClose: () => void; onNavigate: (url: string) => void }) {
  const [soundOn, setSoundOn] = useState(isOrderSoundEnabled())
  const [soundType, setSoundTypeState] = useState<SoundType>(getOrderSoundType())
  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setOrderSoundEnabled(next)
    if (next) { primeOrderSound(); playOrderAlert() } // gesto del usuario → desbloquea audio + prueba
  }
  const pickSound = (t: SoundType) => {
    setSoundTypeState(t)
    setOrderSoundType(t)
    primeOrderSound(); playOrderAlert(t) // preview
  }

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
      label: 'Tiempos de entrega',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
      href: '/pos/config/tiempos',
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
          {/* Sonido de pedidos (ecommerce) */}
          <div className="pos-drawer-item" style={{ cursor: 'default' }}>
            <span className="pos-drawer-ic">
              {soundOn
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span>Sonido de pedidos</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Suena fuerte al entrar un pedido</span>
            </span>
            <button
              onClick={toggleSound}
              role="switch"
              aria-checked={soundOn}
              aria-label="Sonido de pedidos"
              style={{ marginLeft: 'auto', flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: soundOn ? 'var(--amber)' : 'var(--line-strong)', position: 'relative', transition: 'background .2s' }}
            >
              <span style={{ position: 'absolute', top: 3, left: soundOn ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
            </button>
          </div>
          {/* Selector de sonido — toca uno para elegirlo y escucharlo */}
          {soundOn && (
            <div style={{ padding: '2px 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SOUND_OPTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => pickSound(s.id)}
                  style={{
                    padding: '7px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--sans)',
                    border: `1px solid ${soundType === s.id ? 'var(--amber)' : 'var(--line-strong)'}`,
                    background: soundType === s.id ? 'var(--amber-tint)' : 'var(--sunk)',
                    color: soundType === s.id ? 'var(--amber-press)' : 'var(--ink-2)',
                  }}
                >
                  {soundType === s.id ? '🔊 ' : ''}{s.label}
                </button>
              ))}
            </div>
          )}
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
        </div>
      </div>
    </>
  )
}
