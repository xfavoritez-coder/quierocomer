'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PosHeader from '../components/PosHeader'
import { usePosRestaurant } from '../lib/usePosRestaurant'
import { getBridgeUrl, setBridgeUrl, getBridgeStatus, printTest, printKitchenComanda, listPrinters, setupPrinter, getKitchenMode, setKitchenMode } from '@/lib/pos/bridge'
import { buildPrintAgentInstaller } from '@/lib/ecommerce/printAgentScript'
import { toast } from 'sonner'

interface PedidosCfg {
  autoDeliverPickup?: boolean
  uberEnabled?: boolean
  pedidosyaEnabled?: boolean
  customerAbsorbsSurcharge?: boolean
}

export default function PosConfigPage() {
  const router = useRouter()
  const { restaurantId } = usePosRestaurant()
  const [status, setStatus] = useState<any>(null)
  const [checking, setChecking] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [printers, setPrinters] = useState<string[] | null>(null)
  const [picking, setPicking] = useState(false)
  const [dlMsg, setDlMsg] = useState('')
  const [kitchen, setKitchen] = useState(false)
  const [pedidos, setPedidos] = useState<PedidosCfg>({})
  const [showDesc, setShowDesc] = useState(false)
  const [savingPed, setSavingPed] = useState(false)

  useEffect(() => { autoDetect() }, [])
  useEffect(() => { setKitchen(getKitchenMode()) }, [])

  const loadPedidos = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders/settings?restaurantId=${restaurantId}`)
      const d = await r.json()
      if (r.ok && d.config) { setPedidos(d.config); if (typeof d.posShowDescriptions === 'boolean') setShowDesc(d.posShowDescriptions) }
    } catch { /* noop */ }
  }, [restaurantId])
  useEffect(() => { loadPedidos() }, [loadPedidos])

  const updatePedidos = async (patch: Partial<PedidosCfg>) => {
    if (!restaurantId) return
    setPedidos(p => ({ ...p, ...patch }))
    setSavingPed(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, config: patch }) })
      if (!r.ok) { toast.error('No se pudo guardar'); loadPedidos() }
    } catch { toast.error('Error de conexión'); loadPedidos() }
    setSavingPed(false)
  }

  const updateShowDesc = async (v: boolean) => {
    if (!restaurantId) return
    setShowDesc(v)
    setSavingPed(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, posShowDescriptions: v }) })
      if (!r.ok) { toast.error('No se pudo guardar'); setShowDesc(!v) }
    } catch { toast.error('Error de conexión'); setShowDesc(!v) }
    setSavingPed(false)
  }

  const toggleKitchen = () => {
    const v = !kitchen
    setKitchen(v)
    setKitchenMode(v)
  }

  const autoDetect = async () => {
    setChecking(true)
    setStatus(null)
    setPrinters(null)
    const urls = ['http://localhost:7777', getBridgeUrl()].filter(Boolean)
    for (const url of [...new Set(urls)]) {
      setBridgeUrl(url)
      const s = await getBridgeStatus()
      if (s.ok) { setStatus({ ...s, url }); setChecking(false); return }
    }
    setStatus({ ok: false, error: 'Agente no encontrado. ¿Está instalado y corriendo en este equipo?' })
    setChecking(false)
  }

  const handleTest = async () => {
    setTesting(true); setTestMsg('')
    const r = kitchen
      ? await printKitchenComanda({
          jobId: 'test-cocina',
          type: 'delivery',
          orderLabel: '#TEST',
          customerName: 'Juan Pérez',
          customerPhone: '+56 9 1234 5678',
          customerAddress: 'Av. Siempre Viva 742, depto 3B',
          sentBy: 'prueba',
          items: [
            { quantity: 2, dish_name: 'Roll California', modifiers: [{ name: 'Sin palta', price_adjustment: 0 }], note: 'Bien frío' },
            { quantity: 1, dish_name: 'Gyoza de verdura', modifiers: [], note: 'Sin salsa de soya' },
          ],
        })
      : await printTest()
    setTestMsg(r.ok ? '✓ Revisa la impresora' : '✗ ' + (r.error || 'Error'))
    setTesting(false)
  }

  const openPicker = async () => {
    setPicking(true); setPrinters(null)
    const r = await listPrinters()
    setPrinters(r.ok ? (r.printers || []) : [])
  }

  const choose = async (name: string) => {
    const r = await setupPrinter({ target: 'name', name })
    if (r.ok) { setTestMsg('✓ Impresora guardada'); setPicking(false); autoDetect() }
    else setTestMsg('✗ ' + (r.error || 'Error'))
  }

  const downloadAgent = async () => {
    setDlMsg('Preparando…')
    try {
      const r = await fetch(`/api/pos/print-token?restaurantId=${restaurantId}`).then(x => x.json())
      if (!r?.ok || !r.token) { setDlMsg(r?.error || 'No se pudo preparar el agente'); return }
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://quierocomer.com'
      const script = buildPrintAgentInstaller(r.token, base, r.storeName || '')
      const blob = new Blob([script], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const slug = (r.storeName || 'local').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'local'
      const a = document.createElement('a')
      a.href = url; a.download = `instalar-agente-${slug}.bat`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setDlMsg('Descargado. Haz doble clic en el .bat para instalarlo.')
    } catch { setDlMsg('No se pudo descargar') }
  }

  const connected = !!status?.ok
  const hasPrinter = connected && !!status?.printer?.ok
  const printerName = status?.printer?.name || ''

  const amberBtn: React.CSSProperties = { padding: '16px', borderRadius: 14, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }
  const ghostBtn: React.CSSProperties = { padding: '12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: '0.82rem', cursor: 'pointer' }

  return (
    <div className="pos-shell">
      <PosHeader mode="back" eyebrow="Configuración" subtitle="Impresora" onBack={() => router.push('/pos')} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 16px', maxWidth: 480, margin: '0 auto', width: '100%' }}>

        {checking ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 40 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--line)', borderTopColor: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--ink-2)', fontSize: '0.88rem' }}>Buscando el agente de impresión…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>

        ) : connected ? (
          /* ── AGENTE CONECTADO ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: hasPrinter ? 'var(--jade-tint)' : 'var(--amber-tint-2)', border: `1.5px solid ${hasPrinter ? 'var(--jade)' : 'var(--amber)'}`, borderRadius: 18, padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🖨️</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)', marginBottom: 4 }}>
                {hasPrinter ? (printerName || 'Impresora lista') : 'Sin impresora elegida'}
              </div>
              <div style={{ fontSize: '0.82rem', color: hasPrinter ? 'var(--jade)' : 'var(--amber-press)', fontWeight: 600 }}>
                {hasPrinter ? '✓ Agente conectado' : 'Agente conectado — elige una impresora'}
              </div>
            </div>

            {hasPrinter && (
              <button onClick={handleTest} disabled={testing} style={{ ...amberBtn, opacity: testing ? 0.7 : 1 }}>
                {testing ? 'Imprimiendo…' : '🖨️  Imprimir comanda de prueba'}
              </button>
            )}

            {testMsg && (
              <p style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.88rem', color: testMsg.startsWith('✓') ? 'var(--jade)' : '#e05252' }}>{testMsg}</p>
            )}

            {picking ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--ink-2)', fontWeight: 600 }}>Elige la impresora de este equipo:</p>
                {printers === null ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--ink-3)' }}>Cargando impresoras…</p>
                ) : printers.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--ink-3)' }}>No se encontraron impresoras instaladas en Windows.</p>
                ) : printers.map(p => (
                  <button key={p} onClick={() => choose(p)} style={{ ...ghostBtn, textAlign: 'left', padding: '12px 14px' }}>{p}</button>
                ))}
                <button onClick={() => setPicking(false)} style={{ ...ghostBtn, marginTop: 4 }}>Cancelar</button>
              </div>
            ) : (
              <button onClick={openPicker} style={ghostBtn}>{hasPrinter ? 'Cambiar impresora' : 'Elegir impresora'}</button>
            )}

            <button onClick={autoDetect} style={ghostBtn}>Verificar de nuevo</button>
          </div>

        ) : (
          /* ── AGENTE NO ENCONTRADO ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 18, padding: '28px 20px' }}>
              <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 12 }}>🔌</div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>Conecta la impresora</h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--ink-2)', lineHeight: 1.5, textAlign: 'center', marginBottom: 16 }}>
                Instala el <b>agente de impresión</b> en este mismo equipo (el que tiene la impresora). Es el mismo agente del ecommerce: imprime al instante y sin internet.
              </p>
              {[
                { n: 1, t: 'Descarga el instalador del agente (botón de abajo)' },
                { n: 2, t: 'Haz doble clic en el .bat — se instala solo y queda junto al reloj' },
                { n: 3, t: 'Vuelve aquí y toca “Buscar de nuevo”, luego elige tu impresora' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ minWidth: 28, height: 28, borderRadius: '50%', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.n}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--ink-2)', lineHeight: 1.5, paddingTop: 4 }}>{s.t}</span>
                </div>
              ))}
            </div>

            <button onClick={downloadAgent} style={amberBtn}>⬇️  Descargar agente de impresión</button>
            {dlMsg && <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--ink-2)' }}>{dlMsg}</p>}

            <button onClick={autoDetect} style={ghostBtn}>Buscar de nuevo</button>

            {status?.error && (
              <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-3)' }}>{status.error}</p>
            )}
          </div>
        )}

        {/* ── Comandas de cocina (letra grande) ── */}
        <div style={{ marginTop: 24, background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink)' }}>Comandas de cocina</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-2)', lineHeight: 1.5, margin: '4px 0 0' }}>
                Imprime una comanda con <b>letra grande</b>: nombre del producto, modificadores y comentarios bien visibles, más el nombre del cliente, número de pedido y dirección. Sin precios.
              </p>
            </div>
            <button
              onClick={toggleKitchen}
              role="switch"
              aria-checked={kitchen}
              aria-label="Comandas de cocina"
              style={{ flexShrink: 0, width: 48, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', background: kitchen ? 'var(--amber)' : 'var(--line)', position: 'relative', transition: 'background .2s' }}
            >
              <span style={{ position: 'absolute', top: 3, left: kitchen ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
            </button>
          </div>
        </div>

        {/* ── Ajustes de pedidos ── */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Pedidos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              { key: 'autoDeliverPickup' as const, title: 'Auto-entregar retiro', desc: 'Los pedidos de retiro pasan a «Entregado» al marcarlos «Listo», sin acción extra.' },
              { key: 'uberEnabled' as const,        title: 'Solicitar Uber Direct', desc: 'Muestra el botón Uber en las tarjetas para pedir repartidor. Desactívalo si no usas Uber.' },
              { key: 'pedidosyaEnabled' as const,   title: 'Solicitar PedidosYa',  desc: 'Muestra el botón PedidosYa en las tarjetas. Desactívalo si no usas PedidosYa.' },
              { key: 'customerAbsorbsSurcharge' as const, title: 'Cliente paga cargo de servicio', desc: 'El cargo de la plataforma de delivery se suma al despacho que paga el cliente.' },
            ] as { key: keyof PedidosCfg; title: string; desc: string }[]).map(({ key, title, desc }) => {
              const checked = key === 'uberEnabled' || key === 'pedidosyaEnabled'
                ? pedidos[key] !== false
                : !!pedidos[key]
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--sunk)', border: `1px solid ${checked ? 'var(--amber)' : 'var(--line)'}`, borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>{title}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 3 }}>{desc}</div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={checked}
                    disabled={savingPed}
                    onClick={() => updatePedidos({ [key]: !checked })}
                    style={{ flexShrink: 0, width: 48, height: 28, borderRadius: 999, border: 'none', cursor: savingPed ? 'wait' : 'pointer', background: checked ? 'var(--amber)' : 'var(--line)', position: 'relative', transition: 'background .2s', opacity: savingPed ? 0.6 : 1 }}
                  >
                    <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                  </button>
                </div>
              )
            })}
            {/* Mostrar descripciones */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--sunk)', border: `1px solid ${showDesc ? 'var(--amber)' : 'var(--line)'}`, borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>Mostrar descripción de productos</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 3 }}>En «Tomar pedidos» muestra la descripción debajo del nombre de cada producto.</div>
              </div>
              <button
                role="switch"
                aria-checked={showDesc}
                disabled={savingPed}
                onClick={() => updateShowDesc(!showDesc)}
                style={{ flexShrink: 0, width: 48, height: 28, borderRadius: 999, border: 'none', cursor: savingPed ? 'wait' : 'pointer', background: showDesc ? 'var(--amber)' : 'var(--line)', position: 'relative', transition: 'background .2s', opacity: savingPed ? 0.6 : 1 }}
              >
                <span style={{ position: 'absolute', top: 3, left: showDesc ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
