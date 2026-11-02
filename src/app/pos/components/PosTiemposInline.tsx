'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

// Tiempos de entrega (retiro / delivery / repartidor) EDITABLES inline en el menú
// del POS. Autoguarda en el ecommerceStoreConfig del local. Valores en minutos.
const PRESETS = ['', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60', '75', '90']

export default function PosTiemposInline({ restaurantId }: { restaurantId: string }) {
  const cfgRef = useRef<Record<string, unknown> | null>(null)
  const [pickup, setPickup] = useState('')
  const [delivery, setDelivery] = useState('')
  const [driver, setDriver] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!restaurantId) return
    fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.config) { cfgRef.current = d.config; setPickup(String(d.config.waitTimePickup ?? '')); setDelivery(String(d.config.waitTimeDelivery ?? '')); setDriver(String(d.config.waitTimeDriver ?? '')); setReady(true) } })
      .catch(() => {})
  }, [restaurantId])

  const save = async (patch: Record<string, string>) => {
    const cfg = cfgRef.current
    if (!cfg) return
    const next = { ...cfg, ...patch }
    cfgRef.current = next
    try {
      const res = await fetch('/api/panel/ecommerce/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, config: next }) })
      if (!res.ok) toast.error('No se pudo guardar')
    } catch { toast.error('Error de conexión') }
  }

  const sel: React.CSSProperties = { appearance: 'auto', padding: '7px 10px', borderRadius: 9, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', minWidth: 92 }

  const row = (icon: React.ReactNode, label: string, value: string, setValue: (v: string) => void, key: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <span style={{ color: 'var(--ink-3)', display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)' }}>{label}</span>
      <select value={PRESETS.includes(value) ? value : value} onChange={(e) => { setValue(e.target.value); save({ [key]: e.target.value }) }} style={sel} disabled={!ready}>
        {value && !PRESETS.includes(value) && <option value={value}>{value} min</option>}
        {PRESETS.map(p => <option key={p} value={p}>{p ? `${p} min` : '—'}</option>)}
      </select>
    </div>
  )

  return (
    <div style={{ margin: '4px 14px 10px', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Tiempos de entrega</span>
      </div>
      {row(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h3l2 6M5.5 17.5 9 7h5l2 5"/></svg>, 'Delivery', delivery, setDelivery, 'waitTimeDelivery')}
      {row(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4z"/><path d="M4 6h16M9 10a3 3 0 0 0 6 0"/></svg>, 'Retiro en local', pickup, setPickup, 'waitTimePickup')}
      {row(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="7" r="3.5"/><path d="M5 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/></svg>, 'Repartidor', driver, setDriver, 'waitTimeDriver')}
    </div>
  )
}
