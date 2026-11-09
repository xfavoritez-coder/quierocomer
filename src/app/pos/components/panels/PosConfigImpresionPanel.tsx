'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getBridgeUrl, setBridgeUrl, getBridgeStatus, printTest, printKitchenComanda,
  listPrinters, setupPrinter, getKitchenMode, setKitchenMode,
} from '@/lib/pos/bridge'
import { buildPrintAgentInstaller, buildPrintAgentUninstaller } from '@/lib/ecommerce/printAgentScript'

const POS_DRIVER_URL = 'https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/drivers/diver-generico-pos.exe'

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

const selSt: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--line)', background: 'var(--sunk)',
  color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: '0.86rem',
  outline: 'none', boxSizing: 'border-box',
}
const inputSt: React.CSSProperties = { ...selSt }

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

export default function PosConfigImpresionPanel({ restaurantId, title, onBack }: { restaurantId: string; title?: string; onBack?: () => void; onDone?: () => void }) {
  // Bridge state
  const [status,   setStatus]   = useState<any>(null)
  const [checking, setChecking] = useState(false)
  const [testing,  setTesting]  = useState(false)
  const [testMsg,  setTestMsg]  = useState('')
  const [printers, setPrinters] = useState<string[] | null>(null)
  const [picking,  setPicking]  = useState(false)
  const [dlMsg,    setDlMsg]    = useState('')
  const [kitchen,  setKitchen]  = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearMsg, setClearMsg] = useState('')

  // Print config state
  const [printCfg,     setPrintCfg]     = useState<PrintCfg>(PRINT_CFG_DEFAULTS)
  const [loadingPrint, setLoadingPrint] = useState(true)
  const [savingPrint,  setSavingPrint]  = useState(false)
  const printerNameRef   = useRef<HTMLInputElement>(null)
  const printerIpRef     = useRef<HTMLInputElement>(null)
  const kitchenNameRef   = useRef<HTMLInputElement>(null)
  const kitchenIpRef     = useRef<HTMLInputElement>(null)

  useEffect(() => { autoDetect() }, [])
  useEffect(() => { setKitchen(getKitchenMode()) }, [])

  const loadPrintCfg = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      const d = await r.json()
      if (r.ok && d.config) {
        const c = d.config
        setPrintCfg({
          printMode: c.printMode ?? 'manual', printPaperWidth: c.printPaperWidth ?? 80,
          printCopies: c.printCopies ?? 1, kitchenComanda: c.kitchenComanda ?? false,
          printTarget: c.printTarget ?? 'default', printerName: c.printerName ?? null,
          printerIp: c.printerIp ?? null, kitchenPrintTarget: c.kitchenPrintTarget ?? 'same',
          kitchenPrinterName: c.kitchenPrinterName ?? null, kitchenPrinterIp: c.kitchenPrinterIp ?? null,
          printToken: c.printToken ?? null, ...c,
        })
      }
    } catch { /* noop */ }
    setLoadingPrint(false)
  }, [restaurantId])
  useEffect(() => { loadPrintCfg() }, [loadPrintCfg])

  const savePrintPatch = async (patch: Partial<PrintCfg>) => {
    if (!restaurantId) return
    const next = { ...printCfg, ...patch }
    setPrintCfg(next); setSavingPrint(true)
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

  const clearPrintQueue = async () => {
    if (!restaurantId || clearing) return
    if (!window.confirm('¿Vaciar la cola de impresión de este local?\n\nTodos los pedidos pendientes quedarán marcados como impresos y el agente dejará de imprimirlos. No se borra ningún pedido.')) return
    setClearing(true); setClearMsg('')
    try {
      const r = await fetch('/api/panel/ecommerce/print-clear-queue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setClearMsg(d?.error || 'No se pudo vaciar la cola'); setClearing(false); return }
      setClearMsg(d.count > 0 ? `Cola vaciada: ${d.count} pedido${d.count === 1 ? '' : 's'} marcado${d.count === 1 ? '' : 's'} como impreso${d.count === 1 ? '' : 's'}.` : 'La cola ya estaba vacía.')
    } catch { setClearMsg('Error de conexión') }
    setClearing(false)
  }

  const generatePrintToken = async () => {
    if (!restaurantId) return
    const rnd = crypto?.randomUUID?.().replace(/-/g, '') ?? Math.random().toString(36).slice(2).repeat(2)
    await savePrintPatch({ printToken: rnd, printTokenAt: new Date().toISOString() } as any)
  }

  const connected   = !!status?.ok
  const hasPrinter  = connected && !!status?.printer?.ok
  const printerName = status?.printer?.name || ''
  const amberBtn: React.CSSProperties  = { padding: '12px 14px', borderRadius: 12, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'var(--sans)' }
  const ghostBtn: React.CSSProperties  = { padding: '10px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'var(--sans)' }

  return (
    <div className="pos-scroll">
      <div style={{ padding: '20px 16px 48px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {onBack && <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--sunk)', cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg></button>}
            <p className="pos-inner-title" style={{ margin: 0 }}>{title}</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Agente */}
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Agente</div>
          {checking ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', color: 'var(--ink-3)', fontSize: '0.84rem' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: '3px solid var(--line)', borderTopColor: 'var(--amber)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              Buscando el agente…
            </div>
          ) : connected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: hasPrinter ? '#dcfce7' : 'var(--amber-tint)', border: `1.5px solid ${hasPrinter ? '#16a34a' : 'var(--amber)'}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>🖨️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>{hasPrinter ? (printerName || 'Impresora lista') : 'Sin impresora elegida'}</div>
                  <div style={{ fontSize: '0.74rem', color: hasPrinter ? '#16a34a' : 'var(--amber-press)', fontWeight: 600 }}>{hasPrinter ? '✓ Agente conectado' : 'Agente conectado — elige una impresora'}</div>
                </div>
              </div>
              {hasPrinter && <button onClick={handleTest} disabled={testing} style={{ ...amberBtn, opacity: testing ? 0.7 : 1 }}>{testing ? 'Imprimiendo…' : '🖨️  Imprimir comanda de prueba'}</button>}
              {testMsg && <p style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.84rem', color: testMsg.startsWith('✓') ? '#16a34a' : '#e05252', margin: 0 }}>{testMsg}</p>}
              {picking ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--ink-2)', fontWeight: 600, margin: 0 }}>Elige la impresora:</p>
                  {printers === null ? <p style={{ fontSize: '0.82rem', color: 'var(--ink-3)', margin: 0 }}>Cargando…</p>
                    : printers.length === 0 ? <p style={{ fontSize: '0.82rem', color: 'var(--ink-3)', margin: 0 }}>No se encontraron impresoras instaladas.</p>
                    : printers.map(p => <button key={p} onClick={() => choose(p)} style={{ ...ghostBtn, textAlign: 'left' }}>{p}</button>)}
                  <button onClick={() => setPicking(false)} style={ghostBtn}>Cancelar</button>
                </div>
              ) : <button onClick={openPicker} style={ghostBtn}>{hasPrinter ? 'Cambiar impresora' : 'Elegir impresora'}</button>}
              <button onClick={autoDetect} style={ghostBtn}>Verificar de nuevo</button>
              <button onClick={clearPrintQueue} disabled={clearing} style={{ ...ghostBtn, color: 'var(--red, #dc2626)', borderColor: 'var(--red, #dc2626)', opacity: clearing ? 0.6 : 1 }}>
                {clearing ? 'Vaciando…' : 'Vaciar cola de impresión'}
              </button>
              {clearMsg && <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-2)', margin: 0 }}>{clearMsg}</p>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={downloadInstaller} style={amberBtn}>⬇️  Descargar agente de impresión</button>
              {dlMsg && <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-2)', margin: 0 }}>{dlMsg}</p>}
              <button onClick={autoDetect} style={ghostBtn}>Buscar de nuevo</button>
              <button onClick={clearPrintQueue} disabled={clearing} style={{ ...ghostBtn, color: 'var(--red, #dc2626)', borderColor: 'var(--red, #dc2626)', opacity: clearing ? 0.6 : 1 }}>
                {clearing ? 'Vaciando…' : 'Vaciar cola de impresión'}
              </button>
              {clearMsg && <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-2)', margin: 0 }}>{clearMsg}</p>}
            </div>
          )}

          {/* Comandas de cocina test mode */}
          <ToggleRow title="Modo cocina para comanda de prueba" desc="La prueba de impresión usa formato de cocina: letra grande, cliente y dirección, sin precios." checked={kitchen} onChange={toggleKitchen} />

          {/* Configuración de impresión */}
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, marginBottom: 4 }}>Configuración</div>
          {loadingPrint ? (
            <p style={{ color: 'var(--ink-3)', fontSize: '0.82rem', margin: 0 }}>Cargando…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Modo de impresión</div>
                <select value={printCfg.printMode} onChange={e => savePrintPatch({ printMode: e.target.value as 'off' | 'manual' | 'auto' })} style={selSt} disabled={savingPrint}>
                  <option value="off">Desactivada</option>
                  <option value="manual">Manual (botón en cada pedido)</option>
                  <option value="auto">Automática (imprime al llegar el pedido)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Ancho del papel</div>
                  <select value={printCfg.printPaperWidth} onChange={e => savePrintPatch({ printPaperWidth: Number(e.target.value) === 58 ? 58 : 80 })} style={selSt} disabled={savingPrint}>
                    <option value={80}>80 mm (estándar)</option>
                    <option value={58}>58 mm (chica)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Copias</div>
                  <select value={printCfg.printCopies} onChange={e => savePrintPatch({ printCopies: Number(e.target.value) === 2 ? 2 : 1 })} style={selSt} disabled={savingPrint}>
                    <option value={1}>1 copia</option>
                    <option value={2}>2 copias</option>
                  </select>
                </div>
              </div>
              <ToggleRow title="Comanda de cocina" desc="Imprime una comanda adicional con letra grande: producto, modificadores, comentarios, cliente. Sin precios." checked={printCfg.kitchenComanda} disabled={savingPrint} onChange={() => savePrintPatch({ kitchenComanda: !printCfg.kitchenComanda })} />
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Impresora del agente</div>
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
                  <p style={{ fontSize: '0.72rem', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>Acepta ESC/POS en puerto 9100. Para otro puerto: <code>192.168.1.50:9100</code></p>
                </div>
              )}
              {printCfg.kitchenComanda && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Impresora de cocina</div>
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
            </div>
          )}

          {/* Token + downloads */}
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, marginBottom: 4 }}>Token del agente</div>
          <div style={{ background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px' }}>
            {printCfg.printToken ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
                  <code style={{ flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{printCfg.printToken}</code>
                  <button onClick={() => navigator.clipboard?.writeText(printCfg.printToken!).catch(() => {})} style={{ flexShrink: 0, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--sans)' }}>Copiar</button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={downloadInstaller} style={{ ...amberBtn, fontSize: '0.8rem', padding: '8px 12px' }}>⬇️ Instalador</button>
                  <a href={POS_DRIVER_URL} download style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: '0.8rem', padding: '8px 12px' }}>⬇️ Driver</a>
                  <button onClick={handleTest} disabled={testing} style={{ ...ghostBtn, opacity: testing ? 0.6 : 1, fontSize: '0.8rem', padding: '8px 12px' }}>{testing ? 'Imprimiendo…' : '🖨️ Prueba'}</button>
                  <button onClick={generatePrintToken} style={{ ...ghostBtn, fontSize: '0.8rem', padding: '8px 12px' }}>Regenerar</button>
                </div>
                <button onClick={downloadUninstaller} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)' }}>Descargar desinstalador</button>
                <p style={{ fontSize: '0.72rem', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>Guarda el <code>.bat</code> y haz doble clic. Si aparece aviso de Windows: <em>Más información → Ejecutar de todas formas</em>.</p>
              </div>
            ) : (
              <button onClick={generatePrintToken} style={{ ...ghostBtn }}>Generar token del agente</button>
            )}
            {dlMsg && <p style={{ fontSize: '0.76rem', color: 'var(--ink-2)', margin: '8px 0 0' }}>{dlMsg}</p>}
          </div>

        </div>
      </div>
    </div>
  )
}
