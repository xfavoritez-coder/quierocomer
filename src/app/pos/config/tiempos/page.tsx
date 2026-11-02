'use client'

// Tiempos de entrega (retiro / delivery / repartidor) editables desde el POS.
// Mismo dato que "Tiempo de entrega estimado" del panel (ecommerceStoreConfig).
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import PosHeader from '../../components/PosHeader'
import { usePosRestaurant } from '../../lib/usePosRestaurant'

export default function PosTiemposPage() {
  const router = useRouter()
  const { restaurantId } = usePosRestaurant()
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null)
  const [pickup, setPickup] = useState('')
  const [delivery, setDelivery] = useState('')
  const [driver, setDriver] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!restaurantId) return
    fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.config) { setCfg(d.config); setPickup(String(d.config.waitTimePickup ?? '')); setDelivery(String(d.config.waitTimeDelivery ?? '')); setDriver(String(d.config.waitTimeDriver ?? '')) } })
      .catch(() => {})
  }, [restaurantId])

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    try {
      const next = { ...cfg, waitTimePickup: pickup.trim(), waitTimeDelivery: delivery.trim(), waitTimeDriver: driver.trim() }
      const res = await fetch('/api/panel/ecommerce/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, config: next }) })
      if (!res.ok) { toast.error('No se pudo guardar'); setSaving(false); return }
      setCfg(next)
      toast.success('Tiempos guardados')
    } catch { toast.error('Error de conexión') }
    setSaving(false)
  }

  const field = (label: string, value: string, onChange: (v: string) => void, hint?: string) => (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="ej: 20-30"
          style={{ flex: 1, minWidth: 0, padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 16, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
        <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>min</span>
      </div>
      {hint && <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{hint}</span>}
    </label>
  )

  return (
    <div className="pos-shell">
      <PosHeader mode="back" eyebrow="Configuración" subtitle="Tiempos de entrega" onBack={() => router.push('/pos')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 18 }}>
          Lo que ve el cliente al pedir. Puedes usar un rango (ej: 20-30). El de <b>repartidor</b> se incluye en los datos del pedido.
        </p>
        {field('Retiro', pickup, setPickup)}
        {field('Delivery', delivery, setDelivery)}
        {field('Repartidor', driver, setDriver, 'Tiempo estimado para el repartidor (se envía en el JSON de pedidos).')}
        <button onClick={save} disabled={saving || !cfg}
          style={{ marginTop: 6, width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: saving || !cfg ? 'default' : 'pointer', opacity: saving || !cfg ? 0.6 : 1 }}>
          {saving ? 'Guardando…' : 'Guardar tiempos'}
        </button>
      </div>
    </div>
  )
}
