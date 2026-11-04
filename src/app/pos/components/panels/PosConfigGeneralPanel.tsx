'use client'

import { useEffect, useRef, useState } from 'react'

const PRESETS = ['', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60', '75', '90']

const DEFAULT_TAB_KEY = 'pos:defaultTab'
type DefaultTab = 'todos' | 'mesas' | 'retiro' | 'delivery'

export default function PosConfigGeneralPanel({ restaurantId }: { restaurantId: string }) {
  const cfgRef = useRef<Record<string, unknown> | null>(null)
  const [pickup,   setPickup]   = useState('')
  const [delivery, setDelivery] = useState('')
  const [driver,   setDriver]   = useState('')
  const [ready,    setReady]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [saveMsg,  setSaveMsg]  = useState('')

  const [defaultTab, setDefaultTab] = useState<DefaultTab>('todos')

  useEffect(() => {
    if (!restaurantId) return
    fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.config) {
          cfgRef.current = d.config
          setPickup(String(d.config.waitTimePickup ?? ''))
          setDelivery(String(d.config.waitTimeDelivery ?? ''))
          setDriver(String(d.config.waitTimeDriver ?? ''))
          setReady(true)
        }
      })
      .catch(() => {})
  }, [restaurantId])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DEFAULT_TAB_KEY)
      if (stored === 'mesas' || stored === 'retiro' || stored === 'delivery' || stored === 'todos') {
        setDefaultTab(stored)
      }
    } catch { /* noop */ }
  }, [])

  const save = async (patch: Record<string, string>) => {
    const cfg = cfgRef.current
    if (!cfg) return
    const next = { ...cfg, ...patch }
    cfgRef.current = next
    setSaving(true); setSaveMsg('')
    try {
      const res = await fetch('/api/panel/ecommerce/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, config: next }),
      })
      if (!res.ok) setSaveMsg('No se pudo guardar')
      else setSaveMsg('✓ Guardado')
    } catch { setSaveMsg('Error de conexión') }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleDefaultTabChange = (v: DefaultTab) => {
    setDefaultTab(v)
    try { localStorage.setItem(DEFAULT_TAB_KEY, v) } catch { /* noop */ }
  }

  const selSt: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid var(--line)', background: 'var(--sunk)',
    color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: '0.86rem',
    outline: 'none', boxSizing: 'border-box',
  }

  const timeRow = (
    icon: React.ReactNode,
    label: string,
    value: string,
    setValue: (v: string) => void,
    key: string,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--ink-3)', display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 600 }}>{label}</span>
      <select
        value={value}
        onChange={e => { setValue(e.target.value); save({ [key]: e.target.value }) }}
        style={{ ...selSt, width: 'auto', minWidth: 120 }}
        disabled={!ready}
      >
        {value && !PRESETS.includes(value) && <option value={value}>{value} min</option>}
        {PRESETS.map(p => <option key={p} value={p}>{p ? `${p} min` : '—'}</option>)}
      </select>
    </div>
  )

  return (
    <div className="pos-scroll">
      <div style={{ padding: '20px 16px 48px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Tiempos de entrega */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)', marginBottom: 4 }}>Tiempos de entrega</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.5 }}>
              Tiempo estimado que ve el cliente al hacer un pedido online.
            </div>
            {timeRow(
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h3l2 6M5.5 17.5 9 7h5l2 5"/></svg>,
              'Delivery', delivery, setDelivery, 'waitTimeDelivery',
            )}
            {timeRow(
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4z"/><path d="M4 6h16M9 10a3 3 0 0 0 6 0"/></svg>,
              'Retiro', pickup, setPickup, 'waitTimePickup',
            )}
            <div style={{ borderBottom: 'none' }}>
              {timeRow(
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="7" r="3.5"/><path d="M5 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/></svg>,
                'Repartidor', driver, setDriver, 'waitTimeDriver',
              )}
            </div>
            {saveMsg && (
              <p style={{ fontSize: '0.76rem', fontWeight: 600, color: saveMsg.startsWith('✓') ? '#16a34a' : '#e05252', margin: '8px 0 0', textAlign: 'right' }}>{saveMsg}</p>
            )}
          </div>

          {/* Vista por defecto */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)', marginBottom: 4 }}>Vista por defecto al abrir el POS</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.5 }}>
              Pestaña que aparece seleccionada cada vez que abres el POS.
            </div>
            <select
              value={defaultTab}
              onChange={e => handleDefaultTabChange(e.target.value as DefaultTab)}
              style={selSt}
            >
              <option value="todos">Todos</option>
              <option value="mesas">Mesas</option>
              <option value="retiro">Retiro</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>

        </div>
      </div>
    </div>
  )
}
