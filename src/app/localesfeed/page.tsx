'use client'

import { useState, useEffect, useMemo } from 'react'

type Local = {
  name: string
  address: string
  lat: number
  lng: number
  website: string
  provider: string
  rating: number
  reviews: number
  comuna: string
}

const PROVIDER_COLORS: Record<string, string> = {
  Fudo: '#4ade80',
  Justo: '#60a5fa',
  OlaClick: '#f59e0b',
  Queresto: '#a78bfa',
  Gourmedia: '#f472b6',
  Toteat: '#fb923c',
}

export default function LocalesFeedPage() {
  const [locales, setLocales] = useState<Local[]>([])
  const [filter, setFilter] = useState<string | null>(null)
  const [comunaFilter, setComunaFilter] = useState<string | null>(null)

  useEffect(() => {
    fetch('/locales-feed.json')
      .then(r => r.json())
      .then(setLocales)
      .catch(() => {})
  }, [])

  const providers = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of locales) counts[l.provider] = (counts[l.provider] || 0) + 1
    return Object.entries(counts).sort(([, a], [, b]) => b - a)
  }, [locales])

  const comunas = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of locales) counts[l.comuna] = (counts[l.comuna] || 0) + 1
    return Object.entries(counts).sort(([, a], [, b]) => b - a)
  }, [locales])

  const filtered = useMemo(() => {
    return locales.filter(l =>
      (!filter || l.provider === filter) &&
      (!comunaFilter || l.comuna === comunaFilter)
    ).sort((a, b) => (b.rating || 0) - (a.rating || 0))
  }, [locales, filter, comunaFilter])

  if (locales.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#111', minHeight: '100vh' }}>
        <p style={{ fontSize: 18 }}>Cargando locales...</p>
        <p style={{ fontSize: 13, color: '#555' }}>Si no carga, ejecuta: npx ts-node --skip-project scripts/listar-santiago-proveedores.ts</p>
      </div>
    )
  }

  return (
    <div style={{ background: '#111', minHeight: '100vh', color: '#fff', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>
          Locales con carta extraíble
        </h1>
        <p style={{ fontSize: 14, color: '#888', margin: '0 0 20px' }}>
          {locales.length} restaurantes en Santiago con Fudo, Justo, OlaClick, Queresto, Gourmedia o Toteat
        </p>

        {/* Provider filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={() => setFilter(null)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: !filter ? '#F4A623' : '#222', color: !filter ? '#000' : '#888',
            border: 'none',
          }}>
            Todos ({locales.length})
          </button>
          {providers.map(([p, count]) => (
            <button key={p} onClick={() => setFilter(filter === p ? null : p)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: filter === p ? PROVIDER_COLORS[p] || '#F4A623' : '#222',
              color: filter === p ? '#000' : PROVIDER_COLORS[p] || '#888',
              border: 'none',
            }}>
              {p} ({count})
            </button>
          ))}
        </div>

        {/* Comuna filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          <button onClick={() => setComunaFilter(null)} style={{
            padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
            background: !comunaFilter ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: !comunaFilter ? '#fff' : '#555', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            Todas
          </button>
          {comunas.map(([c, count]) => (
            <button key={c} onClick={() => setComunaFilter(comunaFilter === c ? null : c)} style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
              background: comunaFilter === c ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: comunaFilter === c ? '#fff' : '#555', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {c} ({count})
            </button>
          ))}
        </div>

        {/* Results count */}
        <p style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>
          {filtered.length} resultados
        </p>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((l, i) => (
            <a key={i} href={l.website} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              textDecoration: 'none', cursor: 'pointer',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: `${PROVIDER_COLORS[l.provider] || '#F4A623'}20`,
                border: `1px solid ${PROVIDER_COLORS[l.provider] || '#F4A623'}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: PROVIDER_COLORS[l.provider] || '#F4A623',
              }}>
                {l.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.name}
                </p>
                <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.address}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{
                  padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                  background: `${PROVIDER_COLORS[l.provider] || '#F4A623'}20`,
                  color: PROVIDER_COLORS[l.provider] || '#F4A623',
                }}>
                  {l.provider}
                </span>
                {l.rating && (
                  <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>
                    ⭐ {l.rating} ({l.reviews})
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
