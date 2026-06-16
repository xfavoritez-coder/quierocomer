'use client'

const dish = {
  restaurante: 'Mara Sushi',
  restauranteDireccion: 'Av. Apoquindo 4900, Las Condes, Santiago',
  restauranteLogo: 'https://lh3.googleusercontent.com/p/AF1QipN1234=s100',
  googleRating: 4.6,
  googleRatingCount: 312,
}

const mapsUrl = 'https://maps.google.com'

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ color: '#F4A623' }}>★</span>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{rating.toFixed(1)}</span>
      <span style={{ color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>({dish.googleRatingCount})</span>
    </span>
  )
}

function Logo() {
  return (
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#555', flexShrink: 0 }}>
      M
    </div>
  )
}

/* ── Opción 1: Minimalista ── */
function Option1() {
  return (
    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', padding: '4px 0' }}>
      <Logo />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>{dish.restaurante}</p>
        <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.restauranteDireccion}</p>
        <Stars rating={dish.googleRating} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        <span style={{ fontSize: 9, color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>Maps</span>
      </div>
    </a>
  )
}

/* ── Opción 2: Con color Maps ── */
function Option2() {
  return (
    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
      display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
      padding: '14px 16px', borderRadius: 14,
      background: 'rgba(234,67,53,0.06)', border: '1px solid rgba(234,67,53,0.18)',
      boxSizing: 'border-box',
    }}>
      <Logo />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>{dish.restaurante}</p>
        <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', margin: '2px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.restauranteDireccion}</p>
        <Stars rating={dish.googleRating} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#EA4335" stroke="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        <span style={{ fontSize: 9, color: '#EA4335', fontWeight: 700 }}>Maps</span>
      </div>
    </a>
  )
}

/* ── Opción 3: Separados ── */
function Option3() {
  return (
    <div>
      {/* Card local */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderRadius: 14,
        background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)',
        marginBottom: 8, boxSizing: 'border-box',
      }}>
        <Logo />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>{dish.restaurante}</p>
          <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', margin: '2px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.restauranteDireccion}</p>
          <Stars rating={dish.googleRating} />
        </div>
      </div>
      {/* Botón Maps separado */}
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 12, textDecoration: 'none', boxSizing: 'border-box', width: '100%',
        background: '#fff', border: '1px solid rgba(0,0,0,0.12)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#EA4335" stroke="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Ver en Google Maps</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
    </div>
  )
}

/* ── Opción 4: Full bleed mapa de fondo ── */
function Option4() {
  return (
    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
      display: 'block', borderRadius: 14, overflow: 'hidden', textDecoration: 'none', position: 'relative', height: 90,
      background: 'linear-gradient(135deg, #d4e8c2 0%, #b8d4a8 25%, #c8ddb8 50%, #a8c898 75%, #d0e8c0 100%)',
      boxSizing: 'border-box',
    }}>
      {/* Fake mapa */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }} viewBox="0 0 400 100" preserveAspectRatio="xMidYMid slice">
        <rect x="0" y="40" width="400" height="8" fill="#fff" opacity="0.8"/>
        <rect x="0" y="65" width="400" height="5" fill="#fff" opacity="0.6"/>
        <rect x="80" y="0" width="6" height="100" fill="#fff" opacity="0.7"/>
        <rect x="200" y="0" width="5" height="100" fill="#fff" opacity="0.6"/>
        <rect x="320" y="0" width="7" height="100" fill="#fff" opacity="0.5"/>
        <circle cx="195" cy="44" r="10" fill="#EA4335"/>
        <polygon points="195,54 188,44 202,44" fill="#EA4335"/>
      </svg>
      {/* Overlay info */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
      }}>
        <Logo />
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{dish.restaurante}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: '2px 0 0', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>Ver en Google Maps ↗</p>
        </div>
      </div>
    </a>
  )
}

export default function PreviewRestaurantCard() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#333', margin: 0 }}>Mockups — card restaurante en modal plato</h1>

        {[
          { label: '1 — Minimalista', component: <Option1 /> },
          { label: '2 — Con color Google Maps', component: <Option2 /> },
          { label: '3 — Separados (card + botón)', component: <Option3 /> },
          { label: '4 — Full bleed mapa de fondo', component: <Option4 /> },
        ].map(({ label, component }) => (
          <div key={label}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>{label}</p>
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              {component}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
