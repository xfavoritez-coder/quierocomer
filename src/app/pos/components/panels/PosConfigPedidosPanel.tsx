'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PaymentMethodConfig } from '@/lib/ecommerce/config'

interface PedidosCfg {
  autoDeliverPickup?: boolean
  uberEnabled?: boolean
  pedidosyaEnabled?: boolean
  customerAbsorbsSurcharge?: boolean
  prepAlertMinutes?: number
}

function PosToggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button role="switch" aria-checked={checked} disabled={disabled} onClick={onChange}
      style={{ flexShrink: 0, width: 48, height: 28, borderRadius: 999, border: 'none', cursor: disabled ? 'wait' : 'pointer', background: checked ? 'var(--amber)' : 'var(--line)', position: 'relative', transition: 'background .2s', opacity: disabled ? 0.6 : 1 }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
    </button>
  )
}

function MinutesRow({ title, desc, value, disabled, onInput, onCommit }: { title: string; desc: string; value: string; disabled?: boolean; onInput: (v: string) => void; onCommit: () => void }) {
  const active = (parseInt(value, 10) || 0) > 0
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--sunk)', border: `1px solid ${active ? 'var(--amber)' : 'var(--line)'}`, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 3 }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <input
          type="number" inputMode="numeric" min={0} max={600}
          value={value} disabled={disabled}
          onChange={(e) => onInput(e.target.value.replace(/\D/g, ''))}
          onBlur={onCommit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={{ width: 64, textAlign: 'right', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 15, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink)', outline: 'none' }}
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--ink-2)', fontWeight: 600 }}>min</span>
      </div>
    </div>
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
  const [prepMin,   setPrepMin]   = useState('60')
  const [readyMin,  setReadyMin]  = useState('30')
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([])
  const [sharkposEnabled, setSharkposEnabled] = useState(false)
  const [savingMethods, setSavingMethods] = useState(false)

  const loadPedidos = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders/settings?restaurantId=${restaurantId}`)
      const d = await r.json()
      if (r.ok && d.config) {
        setPedidos(d.config)
        setPrepMin(String(typeof d.config.prepAlertMinutes === 'number' ? d.config.prepAlertMinutes : 60))
        setReadyMin(String(typeof d.config.readyAlertMinutes === 'number' ? d.config.readyAlertMinutes : 30))
        if (typeof d.posModeEffective === 'boolean') setPosMode(d.posModeEffective)
        if (typeof d.posShowDescriptions === 'boolean') setShowDesc(d.posShowDescriptions)
      }
      if (r.ok && Array.isArray(d.paymentMethods)) setMethods(d.paymentMethods)
      if (r.ok && typeof d.sharkposEnabled === 'boolean') setSharkposEnabled(d.sharkposEnabled)
    } catch { /* noop */ }
  }, [restaurantId])

  const setMethodAt = (i: number, patch: Partial<PaymentMethodConfig>) => setMethods(ms => ms.map((m, idx) => idx === i ? { ...m, ...patch } : m))
  const addMethod = () => setMethods(ms => [...ms, { key: '', label: '', emitsFiscal: false }])
  const removeMethod = (i: number) => setMethods(ms => ms.filter((_, idx) => idx !== i))
  const saveMethods = async () => {
    if (!restaurantId) return
    const clean = methods.map(m => ({ ...m, label: (m.label || '').trim() })).filter(m => m.label)
    if (!clean.length) return
    setSavingMethods(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, config: { paymentMethods: clean } }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && Array.isArray(d.config?.paymentMethods)) setMethods(d.config.paymentMethods)
    } catch { /* noop */ }
    setSavingMethods(false)
  }
  useEffect(() => { loadPedidos() }, [loadPedidos])

  const saveMinutes = async (field: 'prepAlertMinutes' | 'readyAlertMinutes', raw: string, setRaw: (s: string) => void) => {
    if (!restaurantId) return
    const n = Math.min(600, Math.max(0, parseInt(raw, 10) || 0))
    setRaw(String(n))
    setPedidos(p => ({ ...p, [field]: n }))
    setSavingPed(true)
    try {
      await fetch('/api/panel/ecommerce/pos-orders/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, config: { [field]: n } }),
      })
    } catch { /* noop */ }
    setSavingPed(false)
  }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
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

          {/* Alertas de retiro */}
          <MinutesRow
            title="Alerta de retiro en preparación"
            desc="Avisa con un modal si un pedido de retiro lleva demasiado tiempo «En preparación». 0 = desactivado."
            value={prepMin} disabled={savingPed}
            onInput={setPrepMin} onCommit={() => saveMinutes('prepAlertMinutes', prepMin, setPrepMin)}
          />
          <MinutesRow
            title="Alerta de retiro sin retirar"
            desc="Avisa si un retiro lleva demasiado tiempo «Listo» sin que el cliente lo retire (sugiere llamarlo). 0 = desactivado."
            value={readyMin} disabled={savingPed}
            onInput={setReadyMin} onCommit={() => saveMinutes('readyAlertMinutes', readyMin, setReadyMin)}
          />

          {/* Métodos de pago */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)', marginBottom: 4 }}>Métodos de pago</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 10 }}>
              {sharkposEnabled
                ? 'Agrega o quita métodos. «Emite documento fiscal» = al cobrar con ese método se emite la boleta.'
                : '«Emite documento fiscal» solo tiene efecto cuando el local tiene la boleta electrónica configurada.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {methods.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px' }}>
                  <input value={m.label} onChange={e => setMethodAt(i, { label: e.target.value })} placeholder="Nombre del método"
                    style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: '0.88rem' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--ink-2)', fontWeight: 600, maxWidth: 88, lineHeight: 1.2 }}>Emite documento fiscal</span>
                    <PosToggle checked={m.emitsFiscal} onChange={() => setMethodAt(i, { emitsFiscal: !m.emitsFiscal })} />
                  </div>
                  <button type="button" aria-label="Eliminar método" onClick={() => removeMethod(i)}
                    style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={addMethod} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px dashed var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>+ Agregar método</button>
                <button type="button" disabled={savingMethods} onClick={saveMethods} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: savingMethods ? 'wait' : 'pointer', opacity: savingMethods ? 0.6 : 1 }}>{savingMethods ? 'Guardando…' : 'Guardar métodos'}</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
