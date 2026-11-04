'use client'

// Configuración del sonido de pedidos (ecommerce): activar + elegir el tipo.
import { useState } from 'react'
import {
  isOrderSoundEnabled, setOrderSoundEnabled, primeOrderSound, playOrderAlert,
  getOrderSoundType, setOrderSoundType, SOUND_OPTIONS, type SoundType,
} from '../../lib/orderSound'

export default function PosSonidoPanel({ restaurantId, title, onBack }: { restaurantId: string; title?: string; onBack?: () => void; onDone?: () => void }) {
  const [soundOn, setSoundOn] = useState(isOrderSoundEnabled())
  const [soundType, setSoundTypeState] = useState<SoundType>(getOrderSoundType())

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setOrderSoundEnabled(next)
    if (next) { primeOrderSound(); playOrderAlert() }
  }
  const pickSound = (t: SoundType) => {
    setSoundTypeState(t)
    setOrderSoundType(t)
    primeOrderSound(); playOrderAlert(t)
  }

  return (
    <div className="pos-scroll">
      <div style={{ flex: 1, padding: '24px 16px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {onBack && <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--sunk)', cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg></button>}
            <p className="pos-inner-title" style={{ margin: 0 }}>{title}</p>
          </div>
        )}
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 18 }}>
          Suena fuerte cada vez que entra un pedido de la tienda online. Elige el sonido y pruébalo.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Sonido de pedidos</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Activa el aviso sonoro</div>
          </div>
          <button onClick={toggleSound} role="switch" aria-checked={soundOn} aria-label="Sonido de pedidos"
            style={{ flexShrink: 0, width: 50, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', background: soundOn ? 'var(--amber)' : 'var(--line-strong)', position: 'relative', transition: 'background .2s' }}>
            <span style={{ position: 'absolute', top: 3, left: soundOn ? 25 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
          </button>
        </div>

        {soundOn && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>Tipo de sonido</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SOUND_OPTIONS.map(s => (
                <button key={s.id} onClick={() => pickSound(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 600, textAlign: 'left',
                    border: `1.5px solid ${soundType === s.id ? 'var(--amber)' : 'var(--line)'}`,
                    background: soundType === s.id ? 'var(--amber-tint)' : 'var(--sunk)',
                    color: soundType === s.id ? 'var(--amber-press)' : 'var(--ink)',
                  }}>
                  {s.label}
                  <span style={{ fontSize: 13, color: soundType === s.id ? 'var(--amber-press)' : 'var(--ink-3)' }}>{soundType === s.id ? '✓ Elegido · tocar para oír' : 'Oír'}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
