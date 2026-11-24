'use client'

import { useState, useEffect, useCallback } from 'react'
import type { StoreTenant } from '@/lib/ecommerce/storefront-data'
import type { DayHours } from '@/lib/ecommerce/hours'

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

function SocialIcon({ type, url, dark }: { type: string; url: string; dark: boolean }) {
  const color = dark ? '#94a3b8' : '#6b7280'
  const hoverBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const icons: Record<string, React.ReactNode> = {
    instagram: <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
    tiktok: <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.4a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.83z"/></svg>,
    facebook: <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    youtube: <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {icons[type] || null}
    </a>
  )
}

function resolveUrl(raw: string, prefix: string): string {
  if (raw.startsWith('http')) return raw
  return `${prefix}${raw.replace(/^@/, '')}`
}

// ── Modal de Política de Privacidad ──

const UPDATED = 'octubre de 2026'

function PrivacyModal({ tenant, onClose, dark }: { tenant: StoreTenant; onClose: () => void; dark: boolean }) {
  const name = tenant.name
  const contactEmail = tenant.privacyEmail || tenant.contactEmail || null
  const contactPhone = tenant.privacyPhone || tenant.whatsapp || tenant.phone || null
  const contactAddress = tenant.privacyAddress || tenant.address || null
  const contactParts: string[] = []
  if (contactEmail) contactParts.push(`correo ${contactEmail}`)
  if (contactPhone) contactParts.push(`WhatsApp/teléfono ${contactPhone}`)
  const contactLine = contactParts.length ? contactParts.join(' o ') : 'los canales de contacto publicados en la tienda'

  const bg = dark ? '#0f172a' : '#fff'
  const text = dark ? '#e2e8f0' : '#333'
  const heading = dark ? '#f1f5f9' : '#111'
  const muted = dark ? '#64748b' : '#888'
  const borderC = dark ? '#1e293b' : '#eee'

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', overflowY: 'auto', padding: '24px 12px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: bg, borderRadius: 16, maxWidth: 720, width: '100%', margin: '20px auto', padding: '36px 24px 48px', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 8, border: 'none', background: dark ? '#1e293b' : '#f5f5f4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted, fontSize: 18 }}>
          ✕
        </button>

        <p style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a7b2e', fontWeight: 800, margin: 0 }}>{name}</p>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '6px 0 4px', color: heading, letterSpacing: '-0.02em' }}>Política de Privacidad</h2>
        <p style={{ fontSize: '0.85rem', color: muted, margin: '0 0 16px' }}>Última actualización: {UPDATED}</p>

        <div style={{ fontSize: '0.95rem', lineHeight: 1.65, color: text }}>
          <p>
            Esta Política de Privacidad describe cómo <strong>{name}</strong> (&quot;nosotros&quot;) trata la información de las personas que usan su
            tienda online y su aplicación para realizar pedidos. La plataforma que da soporte a esta tienda es <strong>QuieroComer</strong>,
            que actúa como proveedor tecnológico. Al usar la tienda o la app aceptas esta política.
          </p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '24px 0 8px', color: heading }}>1. Qué información recopilamos</h3>
          <ul style={{ paddingLeft: 20, margin: '0 0 8px' }}>
            <li><strong>Datos de contacto y entrega:</strong> nombre, teléfono y dirección de entrega que ingresas al hacer un pedido.</li>
            <li><strong>Datos del pedido:</strong> los productos que pides, notas, totales e historial de compras en la tienda.</li>
            <li><strong>Notificaciones:</strong> un identificador del dispositivo (token de notificaciones push) para avisarte del estado de tu pedido.</li>
            <li><strong>Datos técnicos:</strong> información básica del dispositivo y de uso necesaria para que la tienda funcione.</li>
          </ul>
          <p>
            <strong>Pagos:</strong> los pagos con tarjeta se procesan a través de pasarelas externas (Webpay/Transbank, MercadoPago o Flow).
            <strong> No almacenamos los números de tu tarjeta</strong>; esos datos los maneja directamente la pasarela de pago.
          </p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '24px 0 8px', color: heading }}>2. Para qué usamos tu información</h3>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>Procesar, preparar y despachar tus pedidos.</li>
            <li>Enviarte notificaciones sobre el estado de tu pedido.</li>
            <li>Permitir el seguimiento del repartidor y la comunicación contigo cuando es necesario.</li>
            <li>Operar, mantener y mejorar la tienda y la app.</li>
          </ul>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '24px 0 8px', color: heading }}>3. Con quién compartimos tu información</h3>
          <p>Compartimos datos solo con quienes son necesarios para completar tu pedido:</p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li><strong>Repartidores</strong> propios o externos: nombre, teléfono y dirección para la entrega.</li>
            <li><strong>Pasarelas de pago</strong> (Webpay, MercadoPago, Flow): para procesar el cobro de forma segura.</li>
            <li><strong>QuieroComer</strong>, como proveedor de la plataforma, para alojar y operar la tienda.</li>
          </ul>
          <p style={{ marginTop: 8 }}>No vendemos tu información personal a terceros.</p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '24px 0 8px', color: heading }}>4. Seguridad y conservación</h3>
          <p>
            La información viaja <strong>cifrada</strong> (HTTPS). Conservamos tus datos el tiempo necesario para operar los pedidos y cumplir
            obligaciones legales y contables, y luego los eliminamos o anonimizamos.
          </p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '24px 0 8px', color: heading }}>5. Tus derechos y eliminación de datos</h3>
          <p>
            Puedes solicitar acceder, corregir o <strong>eliminar</strong> tus datos personales escribiéndonos a {contactLine}. Atenderemos tu
            solicitud en un plazo razonable, salvo que la ley exija conservar cierta información.
          </p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '24px 0 8px', color: heading }}>6. Menores de edad</h3>
          <p>La tienda y la app están dirigidas a mayores de 18 años. No recopilamos de forma intencional datos de menores de edad.</p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '24px 0 8px', color: heading }}>7. Cambios a esta política</h3>
          <p>Podemos actualizar esta política. Publicaremos la versión vigente en esta misma página con su fecha de actualización.</p>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '24px 0 8px', color: heading }}>8. Contacto</h3>
          <p>
            Ante cualquier duda sobre tu privacidad, contáctanos a {contactLine}
            {contactAddress ? ` · ${contactAddress}` : ''}.
          </p>
        </div>

        <p style={{ fontSize: '0.78rem', color: muted, marginTop: 32, borderTop: `1px solid ${borderC}`, paddingTop: 16 }}>
          {name} · Tienda operada con QuieroComer.
        </p>
      </div>
    </div>
  )
}

interface FooterProps {
  tenant: StoreTenant
  primaryColor: string
  variant: 'modern' | 'base'
  brandMode?: boolean
  siblings?: { id: string; slug: string; name: string; branchName: string | null; hidden?: boolean }[]
  hideAddress?: boolean
}

export default function StoreFooter({ tenant, primaryColor, variant, brandMode, siblings, hideAddress }: FooterProps) {
  const dark = variant === 'modern'
  const bg = dark ? '#0f172a' : '#fafaf9'
  const border = dark ? '#1e293b' : '#e7e5e4'
  const text1 = dark ? '#e2e8f0' : '#1c1917'
  const text2 = dark ? '#94a3b8' : '#78716c'
  const text3 = dark ? '#64748b' : '#a8a29e'
  const accent = primaryColor

  const [showPrivacy, setShowPrivacy] = useState(false)

  // Abrir si la URL ya tiene /politica al montar
  useEffect(() => {
    if (window.location.pathname.endsWith('/politica')) setShowPrivacy(true)
  }, [])

  const openPrivacy = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setShowPrivacy(true)
    const url = window.location.pathname.replace(/\/politica$/, '') + '/politica'
    window.history.pushState({ privacy: true }, '', url)
  }, [])

  const closePrivacy = useCallback(() => {
    setShowPrivacy(false)
    // Si la URL actual termina en /politica, volver atrás
    if (window.location.pathname.endsWith('/politica')) {
      window.history.back()
    }
  }, [])

  // Manejar botón atrás del navegador
  useEffect(() => {
    const onPop = () => {
      if (!window.location.pathname.endsWith('/politica')) {
        setShowPrivacy(false)
      } else {
        setShowPrivacy(true)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (showPrivacy) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [showPrivacy])

  const ig = tenant.instagram?.trim()
  const igUrl = ig ? resolveUrl(ig, 'https://instagram.com/') : null
  const tk = (tenant as any).tiktok?.trim()
  const tkUrl = tk ? resolveUrl(tk, 'https://tiktok.com/@') : null
  const fb = (tenant as any).facebook?.trim()
  const fbUrl = fb ? (fb.startsWith('http') ? fb : `https://facebook.com/${fb}`) : null
  const yt = (tenant as any).youtube?.trim()
  const ytUrl = yt ? (yt.startsWith('http') ? yt : `https://youtube.com/${yt}`) : null
  const mapsUrl = (tenant as any).googleMapsUrl || (tenant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}` : null)

  const socials = [
    igUrl && { type: 'instagram', url: igUrl },
    tkUrl && { type: 'tiktok', url: tkUrl },
    fbUrl && { type: 'facebook', url: fbUrl },
    ytUrl && { type: 'youtube', url: ytUrl },
  ].filter(Boolean) as { type: string; url: string }[]

  const today = (() => { try { return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getDay() } catch { return -1 } })()
  const hours = tenant.weeklyHours

  const showAddress = !hideAddress && tenant.address
  const hasContact = tenant.whatsapp || tenant.phone || tenant.contactEmail || showAddress
  const hasHours = hours && hours.some((d: DayHours) => d.open)

  return (
    <>
      <footer style={{ background: bg, borderTop: `1px solid ${border}`, marginTop: 32 }}>
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '40px 20px 24px' }}>
          {/* Top section: logo + social */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {(tenant.faviconUrl || tenant.logoUrl) && (
                <img src={tenant.faviconUrl || tenant.logoUrl!} alt={tenant.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              )}
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: text1 }}>{tenant.name}</div>
                {tenant.branchName && (
                  <div style={{ fontSize: 12, color: text2, fontWeight: 500 }}>{tenant.branchName}</div>
                )}
              </div>
            </div>
            {socials.length > 0 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {socials.map(s => <SocialIcon key={s.type} type={s.type} url={s.url} dark={dark} />)}
              </div>
            )}
          </div>

          {/* Grid: contacto + horarios + links */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 28, marginBottom: 28 }}>
            {/* Contacto */}
            {hasContact && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: text3, marginBottom: 12 }}>Contacto</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {showAddress && (
                    <a href={mapsUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textDecoration: 'none', color: text2, fontSize: 13, lineHeight: 1.5 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={text3} strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {tenant.address}
                    </a>
                  )}
                  {tenant.whatsapp && (
                    <a href={`https://wa.me/${tenant.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: text2, fontSize: 13 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      {tenant.whatsapp}
                    </a>
                  )}
                  {!tenant.whatsapp && tenant.phone && (
                    <a href={`tel:${tenant.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: text2, fontSize: 13 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={text3} strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      {tenant.phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Horarios */}
            {hasHours && hours && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: text3, marginBottom: 12 }}>Horarios</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[1, 2, 3, 4, 5, 6, 0].map(d => {
                    const dh = hours[d]
                    const isToday = d === today
                    return (
                      <div key={d} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: isToday ? text1 : text2, fontWeight: isToday ? 700 : 400 }}>
                        <span>{DAY_LABELS[d]}{isToday ? <span style={{ color: accent, fontSize: 10, marginLeft: 4 }}>HOY</span> : ''}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{dh?.open ? `${dh.from} - ${dh.to}` : 'Cerrado'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Links */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: text3, marginBottom: 12 }}>Explorar</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {brandMode && siblings && siblings.filter(s => !s.hidden).length > 0 && (
                  <a href="/locales" style={{ fontSize: 13, color: text2, textDecoration: 'none' }}>Nuestros locales</a>
                )}
                {tenant.website && (
                  <a href={tenant.website.startsWith('http') ? tenant.website : `https://${tenant.website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: text2, textDecoration: 'none' }}>
                    Sitio web
                  </a>
                )}
                <a href="/politica" onClick={openPrivacy} style={{ fontSize: 13, color: text2, textDecoration: 'none', cursor: 'pointer' }}>Política de privacidad</a>
              </div>
            </div>

            {/* Sucursales */}
            {brandMode && siblings && siblings.filter(s => !s.hidden).length > 1 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: text3, marginBottom: 12 }}>Sucursales</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {siblings.filter(s => !s.hidden).map(s => (
                    <a key={s.id} href={`https://quierocomer.com/ecommerce/${s.slug}`} style={{ fontSize: 13, color: text2, textDecoration: 'none' }}>
                      {s.branchName || s.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: border, marginBottom: 16 }} />

          {/* Bottom: powered by */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11, color: text3 }} />
            <a href="https://quierocomer.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 11, color: text3 }}>
              Creado con
              <img src="https://quierocomer.com/logo.png" alt="QuieroComer" style={{ width: 14, height: 14 }} />
              <span style={{ fontWeight: 700, color: dark ? '#f59e0b' : '#d97706' }}>QuieroComer</span>
            </a>
          </div>
        </div>
      </footer>

      {showPrivacy && <PrivacyModal tenant={tenant} onClose={closePrivacy} dark={dark} />}
    </>
  )
}
