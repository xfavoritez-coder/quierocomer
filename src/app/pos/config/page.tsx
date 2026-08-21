'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PosHeader from '../components/PosHeader'
import { getBridgeUrl, setBridgeUrl, getBridgeStatus, printTest } from '@/lib/pos/bridge'

export default function PosConfigPage() {
  const router = useRouter()
  const [status, setStatus] = useState<any>(null)
  const [checking, setChecking] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  // Al entrar, buscar el puente automáticamente
  useEffect(() => {
    autoDetect()
  }, [])

  const autoDetect = async () => {
    setChecking(true)
    setStatus(null)
    // Intentar localhost primero, luego la URL guardada
    const urls = ['http://localhost:7777', getBridgeUrl()].filter(Boolean)
    for (const url of [...new Set(urls)]) {
      setBridgeUrl(url)
      const s = await getBridgeStatus()
      if (s.ok) {
        setStatus({ ...s, url })
        setChecking(false)
        return
      }
    }
    setStatus({ ok: false, error: 'Puente no encontrado. ¿Está abierto pos-bridge.exe?' })
    setChecking(false)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestMsg('')
    const r = await printTest()
    setTestMsg(r.ok ? '✓ Revisa la impresora' : '✗ ' + r.error)
    setTesting(false)
  }

  const configured = status?.ok && status?.configured
  const printerName = status?.connection?.printerName || status?.connection?.ip

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Configuración"
        subtitle="Impresora"
        onBack={() => router.push('/pos')}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 16px', maxWidth: 480, margin: '0 auto', width: '100%' }}>

        {checking ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 40 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--line)', borderTopColor: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--ink-2)', fontSize: '0.88rem' }}>Buscando puente de impresión...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : configured ? (
          /* ── ESTADO: CONECTADO Y CONFIGURADO ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'var(--jade-tint)', border: '1.5px solid var(--jade)',
              borderRadius: 18, padding: '24px 20px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🖨️</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)', marginBottom: 4 }}>
                {printerName}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--jade)', fontWeight: 600 }}>
                ✓ Impresora conectada
              </div>
            </div>

            <button
              onClick={handleTest}
              disabled={testing}
              style={{
                padding: '16px', borderRadius: 14, border: 'none',
                background: 'var(--amber)', color: '#fff',
                fontWeight: 700, fontSize: '0.95rem',
                cursor: testing ? 'not-allowed' : 'pointer',
                opacity: testing ? 0.7 : 1,
              }}
            >
              {testing ? 'Imprimiendo...' : '🖨️  Imprimir comanda de prueba'}
            </button>

            {testMsg && (
              <p style={{
                textAlign: 'center', fontWeight: 600, fontSize: '0.88rem',
                color: testMsg.startsWith('✓') ? 'var(--jade)' : '#e05252'
              }}>
                {testMsg}
              </p>
            )}

            <button
              onClick={autoDetect}
              style={{
                padding: '12px', borderRadius: 12,
                border: '1px solid var(--line)', background: 'var(--sunk)',
                color: 'var(--ink-2)', fontSize: '0.82rem', cursor: 'pointer'
              }}
            >
              Cambiar impresora
            </button>
          </div>

        ) : status?.ok && !status?.configured ? (
          /* ── PUENTE ACTIVO PERO SIN IMPRESORA CONFIGURADA ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'var(--amber-tint-2)', border: '1.5px solid var(--amber)',
              borderRadius: 18, padding: '24px 20px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                Puente activo, sin impresora
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Abre <b>http://localhost:7777</b> en el PC conectado a la impresora y elige tu impresora ahí.
              </p>
            </div>
            <button onClick={autoDetect} style={{ padding: '14px', borderRadius: 12, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Verificar de nuevo
            </button>
          </div>

        ) : (
          /* ── PUENTE NO ENCONTRADO ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'var(--sunk)', border: '1px solid var(--line)',
              borderRadius: 18, padding: '28px 20px'
            }}>
              <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 12 }}>🔌</div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>
                Cómo conectar la impresora
              </h2>
              {[
                { n: 1, t: 'Descarga pos-bridge.exe en el PC conectado a la impresora' },
                { n: 2, t: 'Haz doble clic para abrirlo — se abre el navegador solo' },
                { n: 3, t: 'Elige tu impresora de la lista que aparece' },
                { n: 4, t: 'Vuelve aquí y toca "Buscar de nuevo"' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{
                    minWidth: 28, height: 28, borderRadius: '50%',
                    background: 'var(--amber)', color: '#fff',
                    fontWeight: 700, fontSize: '0.82rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{s.n}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--ink-2)', lineHeight: 1.5, paddingTop: 4 }}>{s.t}</span>
                </div>
              ))}
            </div>

            <button
              onClick={autoDetect}
              style={{
                padding: '16px', borderRadius: 14, border: 'none',
                background: 'var(--amber)', color: '#fff',
                fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
              }}
            >
              Buscar de nuevo
            </button>

            {status?.error && (
              <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-3)' }}>
                {status.error}
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
