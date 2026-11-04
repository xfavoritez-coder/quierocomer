'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getBridgeUrl, setBridgeUrl, getBridgeStatus, printTest, printKitchenComanda, listPrinters, setupPrinter, getKitchenMode, setKitchenMode } from '@/lib/pos/bridge'
import { buildPrintAgentInstaller, buildPrintAgentUninstaller } from '@/lib/ecommerce/printAgentScript'

const POS_DRIVER_URL = 'https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/drivers/diver-generico-pos.exe'

// ── Types ────────────────────────────────────────────────────────────
interface PedidosCfg {
  autoDeliverPickup?: boolean
  uberEnabled?: boolean
  pedidosyaEnabled?: boolean
  customerAbsorbsSurcharge?: boolean
}

interface PrintCfg {
  printMode: 'off' | 'manual' | 'auto'
  printPaperWidth: 58 | 80
  printCopies: 1 | 2
  kitchenComanda: boolean
  printTarget: 'default' | 'name' | 'ip'
  printerName: string | null
  printerIp: string | null
  kitchenPrintTarget: 'same' | 'name' | 'ip'
  kitchenPrinterName: string | null
  kitchenPrinterIp: string | null
  printToken: string | null
  [key: string]: unknown
}

const PRINT_CFG_DEFAULTS: PrintCfg = {
  printMode: 'manual', printPaperWidth: 80, printCopies: 1,
  kitchenComanda: false, printTarget: 'default',
  printerName: null, printerIp: null,
  kitchenPrintTarget: 'same', kitchenPrinterName: null, kitchenPrinterIp: null,
  printToken: null,
}

// ── Shared style helpers ─────────────────────────────────────────────
const selSt: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--line)', background: 'var(--sunk)',
  color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: '0.86rem',
  outline: 'none', boxSizing: 'border-box',
}
const inputSt: React.CSSProperties = { ...selSt }

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 28, marginBottom: 10 }}>
      {children}
    </div>
  )
}

function PosToggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{ flexShrink: 0, width: 48, height: 28, borderRadius: 999, border: 'none', cursor: disabled ? 'wait' : 'pointer', background: checked ? 'var(--amber)' : 'var(--line)', position: 'relative', transition: 'background .2s', opacity: disabled ? 0.6 : 1 }}
    >
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

function CopyField({ label, value }: { label: string; value: string }) {
  const copy = () => navigator.clipboard?.writeText(value).catch(() => {})
  return (
    <div>
      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px' }}>
        <code style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</code>
        <button onClick={copy} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Copiar</button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
export default function PosImpressoraPanel({ restaurantId, title }: { restaurantId: string; title?: string; onDone?: () => void }) {

  // ── Bridge state ─────────────────────────────────────────────
  const [status, setStatus] = useState<any>(null)
  const [checking, setChecking] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [printers, setPrinters] = useState<string[] | null>(null)
  const [picking, setPicking] = useState(false)
  const [dlMsg, setDlMsg] = useState('')
  const [kitchen, setKitchen] = useState(false)

  // ── Print config state (ecommerceStoreConfig) ─────────────────
  const [printCfg, setPrintCfg] = useState<PrintCfg>(PRINT_CFG_DEFAULTS)
  const [loadingPrint, setLoadingPrint] = useState(true)
  const [savingPrint, setSavingPrint] = useState(false)
  const printerNameRef = useRef<HTMLInputElement>(null)
  const printerIpRef = useRef<HTMLInputElement>(null)
  const kitchenNameRef = useRef<HTMLInputElement>(null)
  const kitchenIpRef = useRef<HTMLInputElement>(null)

  // ── Toteat state ──────────────────────────────────────────────
  const [toteatToken, setToteatToken] = useState<string | null>(null)
  const [testingToteat, setTestingToteat] = useState(false)
  const [toteatMsg, setToteatMsg] = useState('')
  const [toteatOpen, setToteatOpen] = useState(false)

  // ── Pedidos state ─────────────────────────────────────────────
  const [pedidos, setPedidos] = useState<PedidosCfg>({})
  const [posMode, setPosMode] = useState(false)
  const [showDesc, setShowDesc] = useState(false)
  const [savingPed, setSavingPed] = useState(false)

  // ── Bridge init ───────────────────────────────────────────────
  useEffect(() => { autoDetect() }, [])
  useEffect(() => { setKitchen(getKitchenMode()) }, [])

  // ── Load print config ─────────────────────────────────────────
  const loadPrintCfg = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      const d = await r.json()
      if (r.ok && d.config) {
        const c = d.config
        setPrintCfg({
          printMode: c.printMode ?? 'manual',
          printPaperWidth: c.printPaperWidth ?? 80,
          printCopies: c.printCopies ?? 1,
          kitchenComanda: c.kitchenComanda ?? false,
          printTarget: c.printTarget ?? 'default',
          printerName: c.printerName ?? null,
          printerIp: c.printerIp ?? null,
          kitchenPrintTarget: c.kitchenPrintTarget ?? 'same',
          kitchenPrinterName: c.kitchenPrinterName ?? null,
          kitchenPrinterIp: c.kitchenPrinterIp ?? null,
          printToken: c.printToken ?? null,
          ...c,
        })
      }
    } catch { /* noop */ }
    setLoadingPrint(false)
  }, [restaurantId])
  useEffect(() => { loadPrintCfg() }, [loadPrintCfg])

  const savePrintPatch = async (patch: Partial<PrintCfg>) => {
    if (!restaurantId) return
    const next = { ...printCfg, ...patch }
    setPrintCfg(next)
    setSavingPrint(true)
    try {
      const r = await fetch('/api/panel/ecommerce/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, config: next }),
      })
      const d = await r.json()
      if (r.ok && d.config) setPrintCfg({ ...next, ...d.config })
    } catch { /* noop */ }
    setSavingPrint(false)
  }

  // ── Load Toteat config ────────────────────────────────────────
  const loadToteat = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders/config?restaurantId=${restaurantId}`)
      const d = await r.json()
      if (r.ok) { setToteatToken(d.token ?? null); if (!d.token) setToteatOpen(true) }
    } catch { /* noop */ }
  }, [restaurantId])
  useEffect(() => { loadToteat() }, [loadToteat])

  const generateToteatToken = async () => {
    if (!restaurantId) return
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
      })
      const d = await r.json()
      if (r.ok) { setToteatToken(d.token); setToteatMsg('Token generado') }
      else setToteatMsg(d.error || 'Error al generar')
    } catch { setToteatMsg('Error de conexión') }
  }

  const testToteat = async () => {
    if (!restaurantId) return
    setTestingToteat(true); setToteatMsg('')
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
      })
      const d = await r.json()
      if (!r.ok) { setToteatMsg(d.error || 'La prueba falló'); setTestingToteat(false); return }
      const created = d.webhook?.created ?? 0
      setToteatMsg(created > 0 ? '✓ Funciona — pedido de prueba recibido en el tablero.' : 'El webhook respondió, pero no creó el pedido de prueba.')
      loadToteat()
    } catch { setToteatMsg('Error de conexión') }
    setTestingToteat(false)
  }

  // ── Load pedidos config ───────────────────────────────────────
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

  // ── Bridge functions ──────────────────────────────────────────
  const toggleKitchen = () => { const v = !kitchen; setKitchen(v); setKitchenMode(v) }

  const autoDetect = async () => {
    setChecking(true); setStatus(null); setPrinters(null)
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
      ? await printKitchenComanda({ jobId: 'test-cocina', type: 'delivery', orderLabel: '#TEST', customerName: 'Juan Pérez', customerPhone: '+56 9 1234 5678', customerAddress: 'Av. Siempre Viva 742, depto 3B', sentBy: 'prueba', items: [{ quantity: 2, dish_name: 'Roll California', modifiers: [{ name: 'Sin palta', price_adjustment: 0 }], note: 'Bien frío' }, { quantity: 1, dish_name: 'Gyoza de verdura', modifiers: [], note: 'Sin salsa de soya' }] })
      : await printTest()
    setTestMsg(r.ok ? '✓ Revisa la impresora' : '✗ ' + (r.error || 'Error'))
    setTesting(false)
  }

  const openPicker = async () => { setPicking(true); setPrinters(null); const r = await listPrinters(); setPrinters(r.ok ? (r.printers || []) : []) }
  const choose = async (name: string) => {
    const r = await setupPrinter({ target: 'name', name })
    if (r.ok) { setTestMsg('✓ Impresora guardada'); setPicking(false); autoDetect() }
    else setTestMsg('✗ ' + (r.error || 'Error'))
  }

  // ── Download helpers ──────────────────────────────────────────
  const fileSlug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'local'

  const downloadInstaller = async () => {
    setDlMsg('Preparando…')
    try {
      let token = printCfg.printToken
      let storeName = ''
      if (!token) {
        const r = await fetch(`/api/pos/print-token?restaurantId=${restaurantId}`).then(x => x.json())
        if (!r?.ok || !r.token) { setDlMsg(r?.error || 'No se pudo preparar el token'); return }
        token = r.token; storeName = r.storeName || ''
        setPrintCfg(c => ({ ...c, printToken: token! }))
      }
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://quierocomer.com'
      const script = buildPrintAgentInstaller(token!, base, storeName)
      const blob = new Blob([script], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `instalar-agente-${fileSlug(storeName)}.bat`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setDlMsg('Descargado. Haz doble clic en el .bat para instalarlo.')
    } catch { setDlMsg('No se pudo descargar') }
  }

  const downloadUninstaller = () => {
    const script = buildPrintAgentUninstaller(printCfg.printToken || undefined)
    const blob = new Blob([script], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'desinstalar-agente.bat'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const generatePrintToken = async () => {
    if (!restaurantId) return
    const rnd = crypto?.randomUUID?.().replace(/-/g, '') ?? Math.random().toString(36).slice(2).repeat(2)
    await savePrintPatch({ printToken: rnd, printTokenAt: new Date().toISOString() } as any)
  }

  // ── Render helpers ─────────────────────────────────────────────
  const connected = !!status?.ok
  const hasPrinter = connected && !!status?.printer?.ok
  const printerName = status?.printer?.name || ''
  const amberBtn: React.CSSProperties = { padding: '14px', borderRadius: 12, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--sans)', textAlign: 'left' }
  const ghostBtn: React.CSSProperties = { padding: '12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'var(--sans)' }
  const webhookBase = typeof window !== 'undefined' ? window.location.origin : 'https://quierocomer.com'
  const webhookUrl = `${webhookBase}/api/ecommerce/toteat/webhook`
  const webhookUrlToken = toteatToken ? `${webhookUrl}?token=${toteatToken}` : webhookUrl

  return (
    <div className="pos-scroll">
      <div style={{ flex: 1, padding: '24px 16px 48px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
        {title && <p className="pos-inner-title">{title}</p>}

        {/* ══ 1. AGENTE DE IMPRESIÓN ══════════════════════════════════ */}
        <SectionHead>Agente de impresión</SectionHead>
        {checking ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '28px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--line)', borderTopColor: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--ink-2)', fontSize: '0.86rem' }}>Buscando el agente…</p>
          </div>
        ) : connected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: hasPrinter ? 'var(--jade-tint)' : 'var(--amber-tint-2)', border: `1.5px solid ${hasPrinter ? 'var(--jade)' : 'var(--amber)'}`, borderRadius: 16, padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 6 }}>🖨️</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', marginBottom: 3 }}>{hasPrinter ? (printerName || 'Impresora lista') : 'Sin impresora elegida'}</div>
              <div style={{ fontSize: '0.8rem', color: hasPrinter ? 'var(--jade)' : 'var(--amber-press)', fontWeight: 600 }}>{hasPrinter ? '✓ Agente conectado' : 'Agente conectado — elige una impresora'}</div>
            </div>
            {hasPrinter && <button onClick={handleTest} disabled={testing} style={{ ...amberBtn, opacity: testing ? 0.7 : 1 }}>{testing ? 'Imprimiendo…' : '🖨️  Imprimir comanda de prueba'}</button>}
            {testMsg && <p style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.86rem', color: testMsg.startsWith('✓') ? 'var(--jade)' : '#e05252' }}>{testMsg}</p>}
            {picking ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--ink-2)', fontWeight: 600 }}>Elige la impresora de este equipo:</p>
                {printers === null ? <p style={{ fontSize: '0.82rem', color: 'var(--ink-3)' }}>Cargando…</p>
                  : printers.length === 0 ? <p style={{ fontSize: '0.82rem', color: 'var(--ink-3)' }}>No se encontraron impresoras instaladas.</p>
                  : printers.map(p => <button key={p} onClick={() => choose(p)} style={{ ...ghostBtn, textAlign: 'left', padding: '12px 14px' }}>{p}</button>)}
                <button onClick={() => setPicking(false)} style={ghostBtn}>Cancelar</button>
              </div>
            ) : <button onClick={openPicker} style={ghostBtn}>{hasPrinter ? 'Cambiar impresora' : 'Elegir impresora'}</button>}
            <button onClick={autoDetect} style={ghostBtn}>Verificar de nuevo</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 16, padding: '24px 16px' }}>
              <div style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: 10 }}>🔌</div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>Conecta la impresora</h2>
              {[
                'Descarga el instalador del agente (botón de abajo)',
                'Haz doble clic en el .bat — se instala solo y queda junto al reloj',
                'Vuelve aquí y toca "Buscar de nuevo", luego elige tu impresora',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span style={{ fontSize: '0.83rem', color: 'var(--ink-2)', lineHeight: 1.5, paddingTop: 2 }}>{t}</span>
                </div>
              ))}
            </div>
            <button onClick={downloadInstaller} style={amberBtn}>⬇️  Descargar agente de impresión</button>
            {dlMsg && <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-2)' }}>{dlMsg}</p>}
            <button onClick={autoDetect} style={ghostBtn}>Buscar de nuevo</button>
            {status?.error && <p style={{ textAlign: 'center', fontSize: '0.76rem', color: 'var(--ink-3)' }}>{status.error}</p>}
          </div>
        )}

        {/* Comandas de cocina — test mode del bridge */}
        <ToggleRow title="Comandas de cocina (prueba)" desc="Cuando imprimas una comanda de prueba arriba, usa el formato de cocina: letra grande, cliente y dirección, sin precios." checked={kitchen} onChange={toggleKitchen} />

        {/* ══ 2. CONFIGURACIÓN DE IMPRESIÓN ════════════════════════════ */}
        <SectionHead>Configuración de impresión</SectionHead>
        {loadingPrint ? (
          <p style={{ color: 'var(--ink-3)', fontSize: '0.84rem', padding: '12px 0' }}>Cargando…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Modo de impresión</div>
              <select value={printCfg.printMode} onChange={e => savePrintPatch({ printMode: e.target.value as 'off' | 'manual' | 'auto' })} style={selSt} disabled={savingPrint}>
                <option value="off">Desactivada</option>
                <option value="manual">Manual (botón en cada pedido)</option>
                <option value="auto">Automática (imprime al llegar el pedido)</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Ancho del papel</div>
              <select value={printCfg.printPaperWidth} onChange={e => savePrintPatch({ printPaperWidth: Number(e.target.value) === 58 ? 58 : 80 })} style={selSt} disabled={savingPrint}>
                <option value={80}>80 mm (estándar)</option>
                <option value={58}>58 mm (chica)</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Copias por comanda</div>
              <select value={printCfg.printCopies} onChange={e => savePrintPatch({ printCopies: Number(e.target.value) === 2 ? 2 : 1 })} style={selSt} disabled={savingPrint}>
                <option value={1}>1 copia</option>
                <option value={2}>2 copias</option>
              </select>
            </div>

            <ToggleRow
              title="Comanda de cocina"
              desc="Imprime también una comanda de cocina con letra grande: producto, modificadores, comentarios, cliente y dirección. Sin precios. Requiere reinstalar el agente una vez."
              checked={printCfg.kitchenComanda}
              disabled={savingPrint}
              onChange={() => savePrintPatch({ kitchenComanda: !printCfg.kitchenComanda })}
            />

            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Impresora del agente</div>
              <select value={printCfg.printTarget} onChange={e => savePrintPatch({ printTarget: e.target.value as 'default' | 'name' | 'ip' })} style={selSt} disabled={savingPrint}>
                <option value="default">Predeterminada de Windows</option>
                <option value="name">Por nombre exacto</option>
                <option value="ip">Por IP de red (directo, sin driver)</option>
              </select>
            </div>
            {printCfg.printTarget === 'name' && (
              <input ref={printerNameRef} type="text" defaultValue={printCfg.printerName || ''} onBlur={e => savePrintPatch({ printerName: e.target.value.trim() || null })} placeholder="Nombre exacto, ej: POS-80" style={inputSt} />
            )}
            {printCfg.printTarget === 'ip' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input ref={printerIpRef} type="text" defaultValue={printCfg.printerIp || ''} onBlur={e => savePrintPatch({ printerIp: e.target.value.trim() || null })} placeholder="IP de la impresora, ej: 192.168.1.50" style={inputSt} />
                <p style={{ fontSize: '0.74rem', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>IP fija, acepta ESC/POS en puerto 9100. Para otro puerto: <code>192.168.1.50:9100</code></p>
              </div>
            )}

            {printCfg.kitchenComanda && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Impresora de cocina</div>
                  <select value={printCfg.kitchenPrintTarget} onChange={e => savePrintPatch({ kitchenPrintTarget: e.target.value as 'same' | 'name' | 'ip' })} style={selSt} disabled={savingPrint}>
                    <option value="same">La misma de caja (una sola impresora)</option>
                    <option value="name">Otra impresora · por nombre exacto</option>
                    <option value="ip">Otra impresora · por IP de red</option>
                  </select>
                </div>
                {printCfg.kitchenPrintTarget === 'name' && (
                  <input ref={kitchenNameRef} type="text" defaultValue={printCfg.kitchenPrinterName || ''} onBlur={e => savePrintPatch({ kitchenPrinterName: e.target.value.trim() || null })} placeholder="Nombre exacto, ej: COCINA-80" style={inputSt} />
                )}
                {printCfg.kitchenPrintTarget === 'ip' && (
                  <input ref={kitchenIpRef} type="text" defaultValue={printCfg.kitchenPrinterIp || ''} onBlur={e => savePrintPatch({ kitchenPrinterIp: e.target.value.trim() || null })} placeholder="IP impresora cocina, ej: 192.168.1.51" style={inputSt} />
                )}
              </div>
            )}

            {/* Token + downloads */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-2)' }}>Token del agente</div>
              {printCfg.printToken ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
                    <code style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{printCfg.printToken}</code>
                    <button onClick={() => navigator.clipboard?.writeText(printCfg.printToken!).catch(() => {})} style={{ flexShrink: 0, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--sans)' }}>Copiar</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={downloadInstaller} style={{ ...amberBtn, padding: '10px 14px', fontSize: '0.82rem' }}>⬇️ Instalador</button>
                    <a href={POS_DRIVER_URL} download style={{ ...ghostBtn, padding: '10px 14px', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>⬇️ Driver impresora</a>
                    <button onClick={handleTest} disabled={testing} style={{ ...ghostBtn, padding: '10px 14px', fontSize: '0.82rem', opacity: testing ? 0.6 : 1 }}>{testing ? 'Imprimiendo…' : '🖨️ Imprimir prueba'}</button>
                    <button onClick={generatePrintToken} style={{ ...ghostBtn, padding: '10px 14px', fontSize: '0.82rem' }}>Regenerar token</button>
                  </div>
                  <button onClick={downloadUninstaller} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)' }}>Descargar desinstalador</button>
                  <p style={{ fontSize: '0.72rem', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>Guarda el <code>.bat</code> y haz doble clic. Si aparece aviso de Windows: <em>Más información → Ejecutar de todas formas</em>. El agente queda junto al reloj y arranca con Windows.</p>
                </>
              ) : (
                <button onClick={generatePrintToken} style={{ ...ghostBtn, alignSelf: 'flex-start' }}>Generar token del agente</button>
              )}
              {dlMsg && <p style={{ fontSize: '0.78rem', color: 'var(--ink-2)', margin: 0 }}>{dlMsg}</p>}
            </div>
          </div>
        )}

        {/* ══ 3. CONEXIÓN CON TOTEAT ════════════════════════════════════ */}
        <SectionHead>Conexión con Toteat</SectionHead>
        <div style={{ background: 'var(--sunk)', border: `1px solid ${toteatToken ? 'var(--line)' : 'var(--amber)'}`, borderRadius: 14, overflow: 'hidden' }}>
          <button onClick={() => setToteatOpen(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)', fontFamily: 'var(--sans)', textAlign: 'left' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9rem' }}>Webhook Toteat {toteatToken ? '' : '· pendiente'}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ transform: toteatOpen ? 'rotate(180deg)' : 'none', transition: '.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {toteatOpen && (
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-2)', margin: 0, lineHeight: 1.5 }}>
                En Toteat, configura el <strong>Post Hook URL</strong> de pedidos con esta URL y agrega el header <strong>x-webhook-token</strong>. Si Toteat no permite headers, usa la URL con token incluido.
              </p>
              {!toteatToken ? (
                <button onClick={generateToteatToken} style={{ ...amberBtn, alignSelf: 'flex-start' }}>Generar token del local</button>
              ) : (
                <>
                  <CopyField label="Post Hook URL" value={webhookUrl} />
                  <CopyField label="Header · x-webhook-token" value={toteatToken} />
                  <CopyField label="Alternativa · URL con token" value={webhookUrlToken} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={testToteat} disabled={testingToteat} style={{ ...amberBtn, opacity: testingToteat ? 0.6 : 1, fontSize: '0.86rem', padding: '10px 14px' }}>
                      {testingToteat ? 'Probando…' : '📡 Probar conexión'}
                    </button>
                    <span style={{ fontSize: '0.74rem', color: 'var(--ink-3)', flex: 1 }}>Envía un pedido de prueba para verificar el token y el tablero.</span>
                  </div>
                  {toteatMsg && <p style={{ fontSize: '0.82rem', fontWeight: 600, color: toteatMsg.startsWith('✓') ? 'var(--jade)' : '#e05252', margin: 0 }}>{toteatMsg}</p>}
                  <button onClick={generateToteatToken} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)' }}>Regenerar token (invalida el anterior)</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ══ 4. PEDIDOS ═══════════════════════════════════════════════ */}
        <SectionHead>Pedidos</SectionHead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow
            title="Gestionar todos los pedidos del POS"
            desc="Activado: el tablero se alimenta SOLO de pedidos que envía tu POS (Toteat) y NO trae los de ecommerce ni manuales (evita duplicados). Desactivado: los pedidos de ecommerce y manuales también aparecen aquí."
            checked={posMode}
            disabled={savingPed}
            onChange={() => updatePedidos({ posMode: !posMode })}
          />
          {([
            { key: 'autoDeliverPickup' as const, title: 'Auto-entregar retiro', desc: 'Los pedidos de retiro pasan a «Entregado» al marcarlos «Listo», sin acción extra.' },
            { key: 'uberEnabled' as const, title: 'Solicitar Uber Direct', desc: 'Muestra el botón Uber en las tarjetas para pedir repartidor. Desactívalo si no usas Uber.' },
            { key: 'pedidosyaEnabled' as const, title: 'Solicitar PedidosYa', desc: 'Muestra el botón PedidosYa en las tarjetas. Desactívalo si no usas PedidosYa.' },
            { key: 'customerAbsorbsSurcharge' as const, title: 'Cliente paga cargo de servicio', desc: 'El cargo de la plataforma de delivery se suma al despacho que paga el cliente.' },
          ] as { key: keyof PedidosCfg; title: string; desc: string }[]).map(({ key, title, desc }) => {
            const checked = key === 'uberEnabled' || key === 'pedidosyaEnabled' ? pedidos[key] !== false : !!pedidos[key]
            return <ToggleRow key={key} title={title} desc={desc} checked={checked} disabled={savingPed} onChange={() => updatePedidos({ [key]: !checked })} />
          })}
          <ToggleRow
            title="Mostrar descripción de productos"
            desc="En «Tomar pedidos» muestra la descripción debajo del nombre de cada producto."
            checked={showDesc}
            disabled={savingPed}
            onChange={() => updateShowDesc(!showDesc)}
          />
        </div>

      </div>
    </div>
  )
}
