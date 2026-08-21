'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PosHeader from '../components/PosHeader'
import { getBridgeUrl, setBridgeUrl, getBridgeStatus, printTest } from '@/lib/pos/bridge'

export default function PosConfigPage() {
  const router = useRouter()
  const [bridgeUrl, setBridgeUrlState] = useState('')
  const [status, setStatus] = useState<any>(null)
  const [checking, setChecking] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setBridgeUrlState(getBridgeUrl())
  }, [])

  const handleCheck = async () => {
    setChecking(true)
    setStatus(null)
    const s = await getBridgeStatus()
    setStatus(s)
    setChecking(false)
  }

  const handleSave = () => {
    setBridgeUrl(bridgeUrl.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    const r = await printTest()
    if (!r.ok) alert('Error al imprimir prueba: ' + r.error)
    else alert('Comanda de prueba enviada. Revisa la impresora.')
    setTesting(false)
  }

  const printerOk = status?.printer?.ok
  const printerError = status?.printer?.error
  const availablePrinters = status?.printer?.availablePrinters

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Configuración"
        subtitle="Impresora y puente"
        onBack={() => router.push('/pos')}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', maxWidth: 560, margin: '0 auto', width: '100%' }}>

        {/* Puente */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Puente de impresión
          </h2>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>
                URL del puente (IP o localhost)
              </label>
              <input
                value={bridgeUrl}
                onChange={e => setBridgeUrlState(e.target.value)}
                placeholder="http://localhost:7777"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--line)', background: 'var(--sunk)',
                  fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--ink)',
                  outline: 'none',
                }}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--ink-3)', margin: '5px 0 0' }}>
                Si el puente está en este PC usa localhost. Si está en otro PC de la red, usa su IP local (ej: http://192.168.1.10:7777)
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: saved ? 'var(--jade)' : 'var(--amber)', color: '#fff',
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                }}
              >
                {saved ? 'Guardado' : 'Guardar'}
              </button>
              <button
                onClick={handleCheck}
                disabled={checking}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  border: '1px solid var(--line)', background: 'var(--sunk)',
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--ink)',
                }}
              >
                {checking ? 'Verificando...' : 'Verificar estado'}
              </button>
            </div>
          </div>
        </section>

        {/* Estado */}
        {status && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Estado
            </h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
              <StatusRow label="Puente" value={status.ok ? `Conectado (v${status.bridge?.version})` : 'No responde'} ok={status.ok} />
              {status.printer && (
                <StatusRow label="Impresora" value={printerOk ? `OK (${status.printer.mode})` : (printerError || 'Error')} ok={printerOk} />
              )}
              {status.queue && (
                <StatusRow label="Cola" value={status.queue.pending === 0 ? 'Sin pendientes' : `${status.queue.pending} pendiente(s)`} ok={status.queue.pending === 0} />
              )}

              {/* Si el nombre de impresora no se encontró, mostrar las disponibles */}
              {availablePrinters && availablePrinters.length > 0 && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--sunk)', borderRadius: 10 }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', margin: '0 0 6px' }}>
                    Impresoras disponibles en este PC:
                  </p>
                  {availablePrinters.map((name: string) => (
                    <p key={name} style={{ fontSize: '0.78rem', fontFamily: 'var(--mono)', color: 'var(--ink)', margin: '2px 0' }}>
                      • {name}
                    </p>
                  ))}
                  <p style={{ fontSize: '0.72rem', color: 'var(--ink-3)', margin: '8px 0 0' }}>
                    Copia el nombre exacto al config.json del puente (campo "printerName")
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Prueba */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Prueba de impresión
          </h2>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--ink-2)', margin: '0 0 12px' }}>
              Imprime una comanda de prueba para verificar que la impresora está funcionando.
            </p>
            <button
              onClick={handleTest}
              disabled={testing}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                background: 'var(--amber)', color: '#fff',
                fontWeight: 700, fontSize: '0.9rem', cursor: testing ? 'not-allowed' : 'pointer',
                opacity: testing ? 0.7 : 1,
              }}
            >
              {testing ? 'Imprimiendo...' : 'Imprimir comanda de prueba'}
            </button>
          </div>
        </section>

        {/* Instrucciones */}
        <section>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Configurar el puente
          </h2>
          <div style={{ background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
            <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Descarga pos-bridge.exe (o corre node src/index.js en la carpeta print-bridge)',
                'Abre config.json y ajusta printerName al nombre exacto de tu impresora en Windows',
                'Para USB: deja type "usb". Para red/Ethernet: cambia a type "tcp" e ingresa la IP',
                'Doble clic en pos-bridge.exe — debe mostrar "Listo. Esperando comandas..."',
                'Vuelve aquí, ingresa la URL del puente y haz clic en Verificar estado',
              ].map((step, i) => (
                <li key={i} style={{ fontSize: '0.80rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
          </div>
        </section>

      </div>
    </div>
  )
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--ink-2)' }}>{label}</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: ok ? 'var(--jade)' : '#e05252', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? 'var(--jade)' : '#e05252', display: 'inline-block' }} />
        {value}
      </span>
    </div>
  )
}
