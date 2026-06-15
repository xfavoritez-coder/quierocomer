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
  extracted?: 'ok' | 'fail' | null
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
  const [search, setSearch] = useState('')

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
    for (const l of locales) if (l.comuna) counts[l.comuna] = (counts[l.comuna] || 0) + 1
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  }, [locales])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return locales.filter(l =>
      (!filter || l.provider === filter) &&
      (!comunaFilter || l.comuna === comunaFilter) &&
      (!q || l.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ||
       l.address.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q))
    ).sort((a, b) => (b.rating || 0) - (a.rating || 0))
  }, [locales, filter, comunaFilter, search])

  if (locales.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#111', minHeight: '100vh', fontFamily: 'system-ui' }}>
        <p style={{ fontSize: 18 }}>Cargando locales...</p>
        <p style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
          Ejecuta: <code style={{ background: '#222', padding: '2px 8px', borderRadius: 4 }}>npx ts-node --skip-project scripts/listar-santiago-proveedores.ts</code>
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: '#111', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Header */}
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>
          Locales con carta extraíble
        </h1>
        <p style={{ fontSize: 14, color: '#666', margin: '0 0 20px' }}>
          {locales.length} restaurantes en Santiago con proveedores de carta digital
        </p>

        {/* Search */}
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o dirección..."
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 14,
            background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff',
            outline: 'none', marginBottom: 14, boxSizing: 'border-box',
          }}
        />

        {/* Provider filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <Chip active={!filter} onClick={() => setFilter(null)} color="#F4A623">
            Todos ({locales.length})
          </Chip>
          {providers.map(([p, count]) => (
            <Chip key={p} active={filter === p} onClick={() => setFilter(filter === p ? null : p)} color={PROVIDER_COLORS[p]}>
              {p} ({count})
            </Chip>
          ))}
        </div>

        {/* Comuna filter */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 20, maxHeight: 80, overflowY: 'auto' }}>
          <MiniChip active={!comunaFilter} onClick={() => setComunaFilter(null)}>Todas</MiniChip>
          {comunas.map(([c, count]) => (
            <MiniChip key={c} active={comunaFilter === c} onClick={() => setComunaFilter(comunaFilter === c ? null : c)}>
              {c} ({count})
            </MiniChip>
          ))}
        </div>

        {/* Count */}
        <p style={{ fontSize: 12, color: '#444', marginBottom: 12 }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </p>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 2fr 100px 60px 80px',
          padding: '8px 14px', fontSize: 11, color: '#555', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: 0.5,
          borderBottom: '1px solid #222',
        }}>
          <span>Local</span>
          <span>Dirección</span>
          <span>Proveedor</span>
          <span>Estado</span>
          <span style={{ textAlign: 'right' }}>Rating</span>
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((l, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 100px 60px 80px',
              padding: '12px 14px', alignItems: 'center',
              borderBottom: '1px solid #1a1a1a',
              transition: 'background 0.1s',
            }}
              onMouseOver={e => (e.currentTarget.style.background = '#1a1a1a')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Name + link */}
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>{l.name}</p>
                <a href={l.website} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: PROVIDER_COLORS[l.provider] || '#888', textDecoration: 'none', wordBreak: 'break-all' }}>
                  {l.website.replace(/https?:\/\//, '').substring(0, 50)}
                </a>
              </div>

              {/* Address */}
              <p style={{ fontSize: 13, color: '#888', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.address || '—'}
              </p>

              {/* Provider badge */}
              <span style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: `${PROVIDER_COLORS[l.provider] || '#888'}15`,
                color: PROVIDER_COLORS[l.provider] || '#888',
                textAlign: 'center',
              }}>
                {l.provider}
              </span>

              {/* Extraction status */}
              <div>
                {l.extracted === 'ok' && (
                  <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>Extraído</span>
                )}
                {l.extracted === 'fail' && (
                  <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Falló</span>
                )}
                {!l.extracted && (
                  <span style={{ fontSize: 10, color: '#555' }}>Pendiente</span>
                )}
              </div>

              {/* Rating */}
              <div style={{ textAlign: 'right' }}>
                {l.rating ? (
                  <>
                    <span style={{ fontSize: 13, color: '#F4A623', fontWeight: 600 }}>⭐ {l.rating}</span>
                    <p style={{ fontSize: 10, color: '#444', margin: '1px 0 0' }}>{l.reviews} reviews</p>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: '#333' }}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#444' }}>
            No se encontraron resultados
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ active, onClick, color, children }: {
  active: boolean; onClick: () => void; color?: string; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      background: active ? (color || '#F4A623') : '#1a1a1a',
      color: active ? '#000' : (color || '#888'),
      border: active ? 'none' : '1px solid #2a2a2a',
    }}>
      {children}
    </button>
  )
}

function MiniChip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
      background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
      color: active ? '#fff' : '#555',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {children}
    </button>
  )
}
