'use client'

import { useState, useEffect, useCallback } from 'react'

interface PedidosCfg {
  autoDeliverPickup?: boolean
  uberEnabled?: boolean
  pedidosyaEnabled?: boolean
  customerAbsorbsSurcharge?: boolean
}

function PosToggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button role="switch" aria-checked={checked} disabled={disabled} onClick={onChange}
      style={{ flexShrink: 0, width: 48, height: 28, borderRadius: 999, border: 'none', cursor: disabled ? 'wait' : 'pointer', background: checked ? 'var(--amber)' : 'var(--line)', position: 'relative', transition: 'background .2s', opacity: disabled ? 0.6 : 1 }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
    </button>
  )
}

function ToggleRow({ title, desc, checked, disabled, onChange }: { title: string; desc: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--sunk)', border: `1px solid ${checked ? 'var(--amber)' : 'var(--line)'}`, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 3 }}>{desc}</div>
      </div>
      <PosToggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}

export default function PosConfigPedidosPanel({ restaurantId, title, onBack }: { restaurantId: string; title?: string; onBack?: () => void; onDone?: () => void }) {
  const [pedidos,   setPedidos]   = useState<PedidosCfg>({})
  const [posMode,   setPosMode]   = useState(false)
  const [showDesc,  setShowDesc]  = useState(false)
  const [savingPed, setSavingPed] = useState(false)

  const loadPedidos = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders/settings?restaurantId=${restaurantId}`)
      const d = await r.json()
      if (r.ok && d.config) {
        setPedidos(d.config)
        if (typeof d.posModeEffective === 'boolean') setPosMode(d.posModeEffective)
        if (typeof d.posShowDescriptions === 'boolean') setShowDesc(d.posShowDescriptions)
      }
    } catch { /* noop */ }
  }, [restaurantId])
  useEffect(() => { loadPedidos() }, [loadPedidos])

  const updatePedidos = async (patch: Partial<PedidosCfg & { posMode?: boolean }>) => {
    if (!restaurantId) return
    if (typeof patch.posMode === 'boolean') setPosMode(patch.posMode)
    else setPedidos(p => ({ ...p, ...patch }))
    setSavingPed(true)
    try {
      await fetch('/api/panel/ecommerce/pos-orders/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, config: patch }),
      })
    } catch { /* noop */ }
    setSavingPed(false)
  }

  const updateShowDesc = async (v: boolean) => {
    if (!restaurantId) return
    setShowDesc(v); setSavingPed(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, posShowDescriptions: v }),
      })
      if (!r.ok) setShowDesc(!v)
    } catch { setShowDesc(!v) }
    setSavingPed(false)
  }

  return (
    <div className="pos-scroll">
      <div style={{ padding: '20px 16px 48px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {onBack && <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--sunk)', cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg></button>}
            <p className="pos-inner-title" style={{ margin: 0 }}>{title}</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <ToggleRow title="Gestionar todos los pedidos del POS" desc="Activado: el tablero se alimenta SOLO de pedidos que envía tu POS (Toteat) y NO trae los de ecommerce ni manuales (evita duplicados)." checked={posMode} disabled={savingPed} onChange={() => updatePedidos({ posMode: !posMode })} />
          {([
            { key: 'autoDeliverPickup' as const, title: 'Auto-entregar retiro', desc: 'Los pedidos de retiro pasan a «Entregado» al marcarlos «Listo».' },
            { key: 'uberEnabled'          as const, title: 'Solicitar Uber Direct',  desc: 'Muestra el botón Uber en las tarjetas. Desactívalo si no usas Uber.' },
            { key: 'pedidosyaEnabled'     as const, title: 'Solicitar PedidosYa',    desc: 'Muestra el botón PedidosYa en las tarjetas. Desactívalo si no lo usas.' },
            { key: 'customerAbsorbsSurcharge' as const, title: 'Cliente paga cargo de servicio', desc: 'El cargo de la plataforma se suma al despacho que paga el cliente.' },
          ] as { key: keyof PedidosCfg; title: string; desc: string }[]).map(({ key, title, desc }) => {
            const checked = key === 'uberEnabled' || key === 'pedidosyaEnabled' ? pedidos[key] !== false : !!pedidos[key]
            return <ToggleRow key={key} title={title} desc={desc} checked={checked} disabled={savingPed} onChange={() => updatePedidos({ [key]: !checked })} />
          })}
          <ToggleRow title="Mostrar descripción de productos" desc="En «Tomar pedidos» muestra la descripción debajo del nombre de cada producto." checked={showDesc} disabled={savingPed} onChange={() => updateShowDesc(!showDesc)} />

        </div>
      </div>
    </div>
  )
}
