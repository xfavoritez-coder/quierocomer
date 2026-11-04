'use client'

import { useState, useEffect, useCallback } from 'react'

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

export default function PosConfigToteatPanel({ restaurantId, title, onBack }: { restaurantId: string; title?: string; onBack?: () => void; onDone?: () => void }) {
  const [toteatToken,   setToteatToken]   = useState<string | null>(null)
  const [testingToteat, setTestingToteat] = useState(false)
  const [toteatMsg,     setToteatMsg]     = useState('')

  const loadToteat = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders/config?restaurantId=${restaurantId}`)
      const d = await r.json()
      if (r.ok) setToteatToken(d.token ?? null)
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

  const webhookBase     = typeof window !== 'undefined' ? window.location.origin : 'https://quierocomer.com'
  const webhookUrl      = `${webhookBase}/api/ecommerce/toteat/webhook`
  const webhookUrlToken = toteatToken ? `${webhookUrl}?token=${toteatToken}` : webhookUrl

  const amberBtn: React.CSSProperties = { padding: '12px 14px', borderRadius: 12, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'var(--sans)' }

  return (
    <div className="pos-scroll">
      <div style={{ padding: '20px 16px 48px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {onBack && <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-2)', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg></button>}
            <p className="pos-inner-title" style={{ margin: 0 }}>{title}</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <p style={{ fontSize: '0.82rem', color: 'var(--ink-2)', margin: 0, lineHeight: 1.5 }}>
            En Toteat, configura el <strong>Post Hook URL</strong> de pedidos con esta URL y agrega el header <strong>x-webhook-token</strong>. Si Toteat no permite headers, usa la URL con token incluido.
          </p>

          {!toteatToken ? (
            <button onClick={generateToteatToken} style={{ ...amberBtn, alignSelf: 'flex-start' }}>Generar token del local</button>
          ) : (
            <>
              <CopyField label="Post Hook URL" value={webhookUrl} />
              <CopyField label="Header · x-webhook-token" value={toteatToken} />
              <CopyField label="URL con token incluido" value={webhookUrlToken} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={testToteat} disabled={testingToteat} style={{ ...amberBtn, opacity: testingToteat ? 0.6 : 1 }}>
                  {testingToteat ? 'Probando…' : '📡 Probar conexión'}
                </button>
                <span style={{ fontSize: '0.74rem', color: 'var(--ink-3)', flex: 1 }}>Envía un pedido de prueba para verificar el token.</span>
              </div>
              {toteatMsg && <p style={{ fontSize: '0.82rem', fontWeight: 600, color: toteatMsg.startsWith('✓') ? '#16a34a' : '#e05252', margin: 0 }}>{toteatMsg}</p>}
              <button onClick={generateToteatToken} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)' }}>Regenerar token (invalida el anterior)</button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
