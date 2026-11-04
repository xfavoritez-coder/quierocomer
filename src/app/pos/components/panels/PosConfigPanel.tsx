'use client'

import { useState } from 'react'
import PosConfigImpresionPanel from './PosConfigImpresionPanel'
import PosConfigPedidosPanel from './PosConfigPedidosPanel'
import PosConfigToteatPanel from './PosConfigToteatPanel'
import PosSonidoPanel from './PosSonidoPanel'
import PosMesasConfigPanel from './PosMesasConfigPanel'
import PosGarzonesPanel from './PosGarzonesPanel'
type SectionId = 'impresion' | 'pedidos' | 'toteat' | 'sonido' | 'mesas' | 'usuarios'

interface SectionItem {
  id: SectionId
  icon: string
  title: string
  desc: string
  component: React.ComponentType<{ restaurantId: string; title?: string; onDone?: () => void }>
}

const SECTIONS: SectionItem[] = [
  { id: 'impresion', icon: '🖨️', title: 'Impresión',           desc: 'Agente, configuración de papel e impresora',              component: PosConfigImpresionPanel },
  { id: 'pedidos',   icon: '🛒', title: 'Pedidos',             desc: 'Modo POS, canales y comportamiento de pedidos',           component: PosConfigPedidosPanel },
  { id: 'toteat',    icon: '🔗', title: 'Integración Toteat',  desc: 'Webhook y token de conexión con tu POS',                  component: PosConfigToteatPanel },
  { id: 'sonido',    icon: '🔊', title: 'Sonido',              desc: 'Aviso sonoro al llegar un pedido',                        component: PosSonidoPanel },
  { id: 'mesas',     icon: '🪑', title: 'Mesas',               desc: 'Crear y configurar mesas del salón',                     component: PosMesasConfigPanel },
  { id: 'usuarios',  icon: '👤', title: 'Usuarios',            desc: 'Garzones, cajeros y permisos',                           component: PosGarzonesPanel },
]

export default function PosConfigPanel({ restaurantId, title, onDone }: { restaurantId: string; title?: string; onDone?: () => void }) {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null)

  const active = activeSection ? SECTIONS.find(s => s.id === activeSection) ?? null : null

  if (active) {
    const SubPanel = active.component
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Back row — solo flecha, título va dentro del sub-panel */}
        <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)', flexShrink: 0 }}>
          <div style={{ maxWidth: 520, margin: '0 auto', width: '100%', padding: '8px 16px' }}>
            <button
              onClick={() => setActiveSection(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: '0.82rem', fontWeight: 600 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg>
              Configuración
            </button>
          </div>
        </div>
        <SubPanel restaurantId={restaurantId} title={active.title} />
      </div>
    )
  }

  return (
    <div className="pos-scroll">
      <div style={{ padding: '20px 16px 48px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
        {title && <p className="pos-inner-title">{title}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                border: '1px solid var(--line)', borderRadius: 14,
                padding: '14px 16px', background: 'var(--surface)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                fontFamily: 'var(--sans)',
                transition: 'background .12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
            >
              <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{section.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink)' }}>{section.title}</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.4 }}>{section.desc}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
