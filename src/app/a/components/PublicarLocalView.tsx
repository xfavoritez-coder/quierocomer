'use client'

import { useState } from 'react'
import FeedFooter from './FeedFooter'

export default function PublicarLocalView({
  onBack,
  isDark,
}: {
  onBack?: () => void
  isDark?: boolean
}) {
  const [nombre, setNombre] = useState('')
  const [nombreLocal, setNombreLocal] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) { setError('Ingresa tu nombre.'); return }
    if (!nombreLocal.trim()) { setError('Ingresa el nombre de tu local.'); return }
    if (!ciudad.trim()) { setError('Ingresa tu ciudad.'); return }
    if (!email.includes('@')) { setError('Ingresa un email válido.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/feed/publicar-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          nombreLocal: nombreLocal.trim(),
          ciudad: ciudad.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim() || undefined,
          mensaje: mensaje.trim() || undefined,
        }),
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
      <div style={{ padding: '10px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => sent ? setSent(false) : onBack?.()} style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
            cursor: 'pointer',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 22, fontWeight: 700, color: isDark ? '#fff' : '#111', margin: 0 }}>
            Publicar mi local
          </h1>
        </div>

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
              ¡Solicitud enviada!
            </p>
            <p style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', margin: 0, lineHeight: 1.5 }}>
              Nos ponemos en contacto contigo pronto para publicar tu local.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Tu nombre <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Tu nombre"
                required
                style={inputStyle}
                autoComplete="name"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Nombre de tu local <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                type="text"
                value={nombreLocal}
                onChange={e => setNombreLocal(e.target.value)}
                placeholder="Nombre del restaurante"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Ciudad <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                type="text"
                value={ciudad}
                onChange={e => setCiudad(e.target.value)}
                placeholder="Santiago, Valparaíso..."
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Correo electrónico <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                style={inputStyle}
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>WhatsApp</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="+56 9 1234 5678"
                style={inputStyle}
                autoComplete="tel"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Mensaje (opcional)</label>
              <textarea
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                placeholder="¿Algo que quieras contarnos?"
                rows={4}
                style={{
                  ...inputStyle,
                  minHeight: 100,
                  resize: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                background: loading ? (isDark ? 'rgba(244,166,35,0.6)' : 'rgba(244,166,35,0.5)') : '#F4A623',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Enviando...' : 'Enviar solicitud'}
            </button>

            {error && (
              <p style={{ marginTop: 12, fontSize: 13, color: '#e53e3e', textAlign: 'center', lineHeight: 1.4 }}>
                {error}
              </p>
            )}

          </form>
        )}
      </div>

      {!sent && <FeedFooter isDark={isDark} />}
    </div>
  )
}
