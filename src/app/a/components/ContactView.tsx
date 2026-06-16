'use client'

import { useState } from 'react'

export default function ContactView({
  onBack,
  isDark,
}: {
  onBack?: () => void
  isDark?: boolean
}) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)',
    marginBottom: 6,
    display: 'block',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    fontSize: 15,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'}`,
    background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
    color: isDark ? '#fff' : '#111',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const placeholderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.includes('@')) { setError('Ingresa un email válido.'); return }
    if (!mensaje.trim()) { setError('El mensaje no puede estar vacío.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/feed/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() || undefined, email: email.trim(), mensaje: mensaje.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al enviar. Intenta de nuevo.'); return }
      setSent(true)
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ paddingBottom: 100 }}>

      {/* ─── Sticky header ─── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: isDark ? 'rgba(14,14,14,0.97)' : 'rgba(245,244,241,0.97)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        padding: '14px 16px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 18, fontWeight: 700, color: isDark ? '#fff' : '#111' }}>
          Contacto
        </span>
      </div>

      <div style={{ padding: '24px 16px 0' }}>

        {sent ? (
          <div style={{
            padding: '32px 20px', borderRadius: 14, textAlign: 'center',
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F4A623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 14px' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p style={{ fontSize: 17, fontWeight: 700, color: isDark ? '#fff' : '#111', margin: '0 0 8px' }}>
              ¡Mensaje enviado!
            </p>
            <p style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', margin: 0, lineHeight: 1.5 }}>
              Gracias por escribirnos. Te respondemos pronto.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>

            {/* Nombre */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Nombre <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10, opacity: 0.7 }}>(opcional)</span></label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Tu nombre"
                style={{ ...inputStyle, '--placeholder-color': placeholderColor } as React.CSSProperties}
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                style={inputStyle}
                autoComplete="email"
              />
            </div>

            {/* Mensaje */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Mensaje</label>
              <textarea
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                placeholder="¿En qué podemos ayudarte?"
                required
                rows={5}
                style={{
                  ...inputStyle,
                  minHeight: 120,
                  resize: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                background: loading ? (isDark ? 'rgba(244,166,35,0.6)' : 'rgba(244,166,35,0.5)') : '#F4A623',
                color: '#000',
                fontWeight: 700,
                fontSize: 16,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Enviando...' : 'Enviar mensaje'}
            </button>

            {error && (
              <p style={{
                marginTop: 12, fontSize: 13, color: '#e53e3e',
                textAlign: 'center', lineHeight: 1.4,
              }}>
                {error}
              </p>
            )}

          </form>
        )}

      </div>
    </div>
  )
}
