'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

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

type PlaceResult = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  mapsUrl: string
  website: string | null
  rating: number | null
  reviews: number | null
}

const PROVIDER_COLORS: Record<string, string> = {
  Fudo: '#4ade80',
  Justo: '#60a5fa',
  OlaClick: '#f59e0b',
  Queresto: '#a78bfa',
  Gourmedia: '#f472b6',
  Toteat: '#fb923c',
}

const LOCALSTORAGE_KEY = 'qc_mapa_places'
const PROSPECTOS_KEY = 'qc_mapa_prospectos'

export default function LocalesFeedPage() {
  const [tab, setTab] = useState<'lista' | 'mapa'>('lista')

  // Read tab from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'mapa') setTab('mapa')
  }, [])

  return (
    <div style={{ background: '#111', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Locales con carta extraíble</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #222', marginTop: 16 }}>
          <TabButton active={tab === 'lista'} onClick={() => setTab('lista')}>Lista proveedores</TabButton>
          <TabButton active={tab === 'mapa'} onClick={() => setTab('mapa')}>Prospección mapa</TabButton>
        </div>

        {tab === 'lista' && <TabLista />}
        {tab === 'mapa' && <TabMapa />}
      </div>
    </div>
  )
}

// ---- TAB LISTA (original) ----

function TabLista() {
  const [locales, setLocales] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [comunaFilter, setComunaFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/locales-feed.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => { setLocales(data); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Error desconocido'); setLoading(false) })
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

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#666', fontSize: 14 }}>Cargando locales...</div>
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        <p style={{ fontSize: 15, color: '#ef4444', marginBottom: 8 }}>Error al cargar locales-feed.json</p>
        <p style={{ fontSize: 13, color: '#555' }}>{error}</p>
      </div>
    )
  }

  if (locales.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        <p style={{ fontSize: 15 }}>No hay locales en el feed</p>
        <p style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
          Ejecuta: <code style={{ background: '#222', padding: '2px 8px', borderRadius: 4 }}>npx ts-node --skip-project scripts/listar-santiago-proveedores.ts</code>
        </p>
      </div>
    )
  }

  return (
    <>
      <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px' }}>
        {locales.length} restaurantes en Santiago con proveedores de carta digital
      </p>

      <input
        type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por nombre o dirección..."
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 14,
          background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff',
          outline: 'none', marginBottom: 14, boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Chip active={!filter} onClick={() => setFilter(null)} color="#F4A623">Todos ({locales.length})</Chip>
        {providers.map(([p, count]) => (
          <Chip key={p} active={filter === p} onClick={() => setFilter(filter === p ? null : p)} color={PROVIDER_COLORS[p]}>
            {p} ({count})
          </Chip>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 20, maxHeight: 80, overflowY: 'auto' }}>
        <MiniChip active={!comunaFilter} onClick={() => setComunaFilter(null)}>Todas</MiniChip>
        {comunas.map(([c, count]) => (
          <MiniChip key={c} active={comunaFilter === c} onClick={() => setComunaFilter(comunaFilter === c ? null : c)}>
            {c} ({count})
          </MiniChip>
        ))}
      </div>

      <p style={{ fontSize: 12, color: '#444', marginBottom: 12 }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 100px 60px 80px', padding: '8px 14px', fontSize: 11, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #222' }}>
        <span>Local</span><span>Dirección</span><span>Proveedor</span><span>Estado</span><span style={{ textAlign: 'right' }}>Rating</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filtered.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 100px 60px 80px', padding: '12px 14px', alignItems: 'center', borderBottom: '1px solid #1a1a1a', transition: 'background 0.1s' }}
            onMouseOver={e => (e.currentTarget.style.background = '#1a1a1a')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>{l.name}</p>
              <a href={l.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: PROVIDER_COLORS[l.provider] || '#888', textDecoration: 'none', wordBreak: 'break-all' }}>
                {l.website.replace(/https?:\/\//, '').substring(0, 50)}
              </a>
            </div>
            <p style={{ fontSize: 13, color: '#888', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.address || '—'}</p>
            <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: `${PROVIDER_COLORS[l.provider] || '#888'}15`, color: PROVIDER_COLORS[l.provider] || '#888', textAlign: 'center' }}>{l.provider}</span>
            <div>
              {l.extracted === 'ok' && <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>Extraído</span>}
              {l.extracted === 'fail' && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Falló</span>}
              {!l.extracted && <span style={{ fontSize: 10, color: '#555' }}>Pendiente</span>}
            </div>
            <div style={{ textAlign: 'right' }}>
              {l.rating ? (
                <>
                  <span style={{ fontSize: 13, color: '#F4A623', fontWeight: 600 }}>⭐ {l.rating}</span>
                  <p style={{ fontSize: 10, color: '#444', margin: '1px 0 0' }}>{l.reviews} reviews</p>
                </>
              ) : <span style={{ fontSize: 12, color: '#333' }}>—</span>}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#444' }}>No se encontraron resultados</div>}
    </>
  )
}

// ---- TAB MAPA ----

type ProspectoResult = {
  id: string
  name: string
  address: string
  mapsUrl: string
  status: 'encontrado' | 'sin_plataforma' | 'sin_fotos'
  provider?: string
  cartaUrl?: string
  fuenteMatch?: string
}

type ImportResult = {
  status: 'importing' | 'ok' | 'error'
  slug?: string
  dishCount?: number
  error?: string
}

const EXTRACTABLE_PROVIDERS = new Set([
  'Justo', 'OlaClick', 'UberEats', 'Fudo', 'Mercat', 'Gourmedia',
  'PedidosYa', 'Queresto', 'Web propia',
])

// Extrae la comuna de una dirección chilena tipo "Calle 123, Comuna, Región Metropolitana"
function extractComuna(address: string): string {
  const parts = address.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length < 2) return ''
  const candidate = parts.length >= 3 ? parts[parts.length - 2] : parts[parts.length - 1]
  return candidate.replace(/^\d+\s*/, '').trim()
}

function TabMapa() {
  const [places, setPlaces] = useState<PlaceResult[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Prospecting state
  const [prospecting, setProspecting] = useState(false)
  const [prospectLog, setProspectLog] = useState<string[]>([])
  const [prospectMap, setProspectMap] = useState<Record<string, ProspectoResult>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [prospectDone, setProspectDone] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Import state
  const [importing, setImporting] = useState(false)
  const [importMap, setImportMap] = useState<Record<string, ImportResult>>({})
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; name: string } | null>(null)

  // Manual carta URL editing
  const [editingCartaId, setEditingCartaId] = useState<string | null>(null)
  const [editingCartaUrl, setEditingCartaUrl] = useState('')

  async function saveCartaUrl(placeId: string, url: string) {
    if (!url.trim()) return
    // Detect provider from URL
    const u = url.toLowerCase()
    const provider = u.includes('ubereats.com') ? 'UberEats'
      : u.includes('pedidosya.cl') ? 'PedidosYa'
      : u.includes('getjusto.com') || u.includes('/pedir') ? 'Justo'
      : u.includes('fu.do') ? 'Fudo'
      : u.includes('ola.click') ? 'OlaClick'
      : u.includes('gour.media') ? 'Gourmedia'
      : u.includes('toteat.app') ? 'Toteat'
      : 'Web propia'
    const result: ProspectoResult = {
      id: placeId,
      name: places.find(p => p.id === placeId)?.name ?? '',
      address: places.find(p => p.id === placeId)?.address ?? '',
      mapsUrl: places.find(p => p.id === placeId)?.mapsUrl ?? '',
      status: 'encontrado',
      provider,
      cartaUrl: url.trim(),
      fuenteMatch: 'maps-website',
    }
    await fetch('/api/mapalocales/prospectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result }),
    })
    setProspectMap(m => ({ ...m, [placeId]: result }))
    setEditingCartaId(null)
    setEditingCartaUrl('')
  }

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/mapalocales/prospectos')
        if (!r.ok) return
        const rows: any[] = await r.json()

        // Si DB vacía, migrar desde localStorage
        if (rows.length === 0) {
          const oldPlaces: PlaceResult[] = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || '[]')
          if (oldPlaces.length > 0) {
            setPlaces(oldPlaces)
            const oldProspectos: Record<string, ProspectoResult> = JSON.parse(localStorage.getItem(PROSPECTOS_KEY) || '{}')
            setProspectMap(oldProspectos)
            // Subir a DB en background
            fetch('/api/mapalocales/prospectos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ places: oldPlaces }),
            }).catch(() => {})
            return
          }
        }

        setPlaces(rows.map(r => ({
          id: r.id, name: r.name, address: r.address ?? '',
          lat: r.lat ?? 0, lng: r.lng ?? 0,
          mapsUrl: r.mapsUrl ?? '', website: r.website,
          rating: r.rating, reviews: r.reviews,
        })))

        const map: Record<string, ProspectoResult> = {}
        const impMap: Record<string, ImportResult> = {}
        for (const r of rows) {
          if (r.status) {
            map[r.id] = {
              id: r.id, name: r.name, address: r.address ?? '',
              mapsUrl: r.mapsUrl ?? '', status: r.status,
              provider: r.provider, cartaUrl: r.cartaUrl, fuenteMatch: r.fuenteMatch,
            }
          }
          if (r.importedSlug) {
            impMap[r.id] = { status: 'ok', slug: r.importedSlug }
          }
        }
        setProspectMap(map)
        setImportMap(impMap)
      } catch {}
      finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const el = logContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [prospectLog])

  async function clearAll() {
    await fetch('/api/mapalocales/prospectos?all=1', { method: 'DELETE' }).catch(() => {})
    setPlaces([])
    setProspectMap({})
    setSelected(new Set())
  }

  function removePlace(id: string) {
    fetch('/api/mapalocales/prospectos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {})
    setPlaces(prev => prev.filter(p => p.id !== id))
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    setProspectMap(m => { const n = { ...m }; delete n[id]; return n })
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(p => p.id)))
    }
  }

  async function runProspecting() {
    const toProcess = places.filter(p => selected.has(p.id) && (p.rating == null || p.rating > 4) && (p.reviews == null || p.reviews >= 10)).map(p => ({
      id: p.id,
      name: p.name,
      address: p.address,
      mapsUrl: p.mapsUrl,
      website: p.website,
    }))
    if (!toProcess.length) return

    setProspecting(true)
    setProspectLog([`Iniciando búsqueda para ${toProcess.length} locales...`])
    // No limpiar el mapa — mantener los resultados ya guardados de otros locales
    setProcessingId(null)
    setProspectDone(false)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const accumulated: ProspectoResult[] = []

    try {
      const res = await fetch('/api/mapalocales/prospectar-cartas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: toProcess }),
        signal: ctrl.signal,
      })

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()!
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'status') {
              setProspectLog(l => [...l, msg.message])
            } else if (msg.type === 'progress') {
              setProcessingId(msg.id)
              setProspectLog(l => [...l, `[${msg.current}] ${msg.name}`])
            } else if (msg.type === 'result') {
              setProcessingId(null)
              setProspectMap(m => ({ ...m, [msg.result.id]: msg.result }))
              accumulated.push(msg.result)
              // Guardar cada 10 resultados para no perder datos si se corta
              if (accumulated.length % 10 === 0) {
                const batch = accumulated.slice(-10)
                fetch('/api/mapalocales/prospectos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ results: batch }),
                }).catch(() => {})
              }
            } else if (msg.type === 'done') {
              setProcessingId(null)
              setProspectLog(l => [...l, `✓ Listo — ${msg.encontrados} con carta · ${msg.sinFotos} sin fotos · ${msg.sinPlataforma} sin plataforma`])
              setProspectDone(true)
              // Guardar los que quedaron pendientes (no múltiplos de 10)
              const remaining = accumulated.slice(-(accumulated.length % 10 || 10))
              if (remaining.length > 0) {
                fetch('/api/mapalocales/prospectos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ results: remaining }),
                }).catch(() => {})
              }
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setProspectLog(l => [...l, `Error: ${e?.message}`])
      }
      // Si se cancela o hay error, guardar lo que se acumuló hasta ahora
      if (accumulated.length > 0) {
        fetch('/api/mapalocales/prospectos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: accumulated }),
        }).catch(() => {})
      }
    } finally {
      setProspecting(false)
      setProcessingId(null)
    }
  }

  function cancelProspecting() {
    abortRef.current?.abort()
    setProspecting(false)
    setProcessingId(null)
    setProspectLog(l => [...l, 'Cancelado.'])
  }

  async function runImport() {
    const toImport = places
      .filter(p => selected.has(p.id))
      .filter(p => {
        const pr = prospectMap[p.id]
        return pr?.cartaUrl && (pr.provider == null || EXTRACTABLE_PROVIDERS.has(pr.provider))
      })
      .map(p => {
        const pr = prospectMap[p.id]
        return { id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng, mapsUrl: p.mapsUrl, cartaUrl: pr.cartaUrl!, provider: pr.provider ?? null }
      })

    if (!toImport.length) return

    setImporting(true)
    setImportProgress(null)
    // Mark all as importing
    const initial: Record<string, ImportResult> = {}
    toImport.forEach(p => { initial[p.id] = { status: 'importing' } })
    setImportMap(m => ({ ...m, ...initial }))

    try {
      const res = await fetch('/api/mapalocales/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectos: toImport }),
      })
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let total = toImport.length
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()!
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'total') {
              total = msg.total
            } else if (msg.type === 'progress') {
              setImportProgress({ current: msg.current, total, name: msg.name })
            } else if (msg.type === 'result') {
              setImportMap(m => ({ ...m, [msg.id]: { status: msg.status, slug: msg.slug, dishCount: msg.dishCount, error: msg.error } }))
            } else if (msg.type === 'done') {
              setImportProgress(null)
            }
          } catch {}
        }
      }
    } catch {}
    finally { setImporting(false); setImportProgress(null) }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return places.filter(p =>
      !q ||
      p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ||
      p.address.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    )
  }, [places, search])

  const allSelected = filtered.length > 0 && selected.size === filtered.length

  if (loading) {
    return <div style={{ padding: '60px 0', textAlign: 'center', color: '#555', fontSize: 14 }}>Cargando prospectos...</div>
  }

  if (places.length === 0) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#555' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
        <p style={{ fontSize: 15, color: '#888', margin: '0 0 8px' }}>No hay locales prospectados aún</p>
        <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
          Entra a{' '}
          <a href="/mapalocales" style={{ color: '#ff7a3c', textDecoration: 'none' }}>/mapalocales</a>
          , dibuja un área y haz clic en "Buscar en esta área"
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
          {places.length} local{places.length !== 1 ? 'es' : ''} · {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/mapalocales" style={{ fontSize: 12, color: '#ff7a3c', textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(255,122,60,0.3)', borderRadius: 8 }}>
            + Buscar más áreas
          </a>
          <button onClick={clearAll} style={{ fontSize: 12, color: '#555', background: 'none', border: '1px solid #222', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            Limpiar todo
          </button>
        </div>
      </div>

      {/* Sticky controls bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#111', paddingBottom: 0 }}>
        {/* Search + select all + run button */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 10, alignItems: 'center' }}>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o dirección..."
            style={{ flex: 1, padding: '10px 16px', borderRadius: 12, fontSize: 14, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
          <button
            onClick={() => selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map(p => p.id)))}
            style={{ fontSize: 12, color: '#888', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {selected.size === filtered.length && filtered.length > 0 ? 'Desmarcar todo' : 'Marcar todo'}
          </button>
          {selected.size > 0 && !prospecting && (
            <button
              onClick={async () => {
                const ids = [...selected]
                await fetch('/api/mapalocales/prospectos', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ids }),
                }).catch(() => {})
                setPlaces(prev => prev.filter(p => !ids.includes(p.id)))
                setProspectMap(m => { const n = { ...m }; ids.forEach(id => delete n[id]); return n })
                setImportMap(m => { const n = { ...m }; ids.forEach(id => delete n[id]); return n })
                setSelected(new Set())
              }}
              style={{ fontSize: 12, color: '#ef4444', background: 'none', border: '1px solid #ef444430', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Borrar ({selected.size})
            </button>
          )}
          <button
            onClick={runProspecting}
            disabled={selected.size === 0 || prospecting}
            style={{
              fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 8, cursor: selected.size === 0 || prospecting ? 'not-allowed' : 'pointer',
              background: selected.size > 0 && !prospecting ? '#ff4c00' : '#2a2a2a',
              color: selected.size > 0 && !prospecting ? '#fff' : '#555',
              border: 'none', whiteSpace: 'nowrap', transition: 'background 0.15s',
            }}
          >
            {prospecting ? 'Buscando...' : `Buscar cartas${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
          {(() => {
            const importable = selected.size > 0 && !importing && [...selected].some(id => {
              const pr = prospectMap[id]
              return pr?.cartaUrl && (pr.provider == null || EXTRACTABLE_PROVIDERS.has(pr.provider))
            })
            return importable || importing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={runImport}
                  disabled={importing}
                  style={{
                    fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 8,
                    cursor: importing ? 'not-allowed' : 'pointer',
                    background: importing ? '#155a2e' : '#22c55e', color: importing ? '#aaa' : '#000', border: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  {importing ? `Importando...` : '⬆ Importar al feed'}
                </button>
                {importProgress && (
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {importProgress.current}/{importProgress.total} — {importProgress.name}
                    </div>
                    <div style={{ height: 4, background: '#222', borderRadius: 999 }}>
                      <div style={{ height: '100%', borderRadius: 999, background: '#22c55e', width: `${(importProgress.current / importProgress.total) * 100}%`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )}
              </div>
            ) : null
          })()}
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '32px 2fr 1.5fr 70px 120px 120px 110px 36px', padding: '8px 14px', fontSize: 11, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #222', borderTop: '1px solid #1a1a1a', background: '#111' }}>
          <span />
          <span>Local</span>
          <span>Dirección</span>
          <span style={{ textAlign: 'center' }}>Rating</span>
          <span>Web Maps</span>
          <span>Carta</span>
          <span>Feed</span>
          <span />
        </div>
      </div>

      {/* Live log panel */}
      {prospectLog.length > 0 && (
        <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 14, margin: '12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>
              {prospecting ? 'Buscando cartas en vivo...' : 'Búsqueda completada'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {prospecting && (
                <button onClick={cancelProspecting} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: '1px solid #ef444440', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              )}
              {prospectDone && (
                <button onClick={() => setProspectLog([])} style={{ fontSize: 11, color: '#555', background: 'none', border: '1px solid #333', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                  Cerrar
                </button>
              )}
            </div>
          </div>
          <div ref={logContainerRef} style={{ maxHeight: 110, overflowY: 'auto' }}>
            {prospectLog.map((line, i) => (
              <p key={i} style={{ fontSize: 11, color: '#555', margin: '1px 0', fontFamily: 'monospace' }}>{line}</p>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filtered.map(p => {
          const prospecto = prospectMap[p.id]
          const isProcessing = processingId === p.id

          return (
          <div
            key={p.id}
            style={{ display: 'grid', gridTemplateColumns: '32px 2fr 1.5fr 70px 120px 120px 110px 36px', padding: '10px 14px', alignItems: 'center', borderBottom: '1px solid #1a1a1a', transition: 'background 0.1s', background: selected.has(p.id) ? '#1a1100' : 'transparent' }}
            onMouseOver={e => { if (!selected.has(p.id)) e.currentTarget.style.background = '#1a1a1a' }}
            onMouseOut={e => { e.currentTarget.style.background = selected.has(p.id) ? '#1a1100' : 'transparent' }}
          >
            {/* Checkbox */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggleSelect(p.id)}
                style={{ accentColor: '#ff4c00', width: 20, height: 20, cursor: 'pointer' }}
              />
            </div>

            <div>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(p.name + ' ' + extractComuna(p.address))}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', display: 'block' }}
              >
                {p.name} ↗
              </a>
              <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#4ade80', textDecoration: 'none' }}>
                Ver en Maps ↗
              </a>
            </div>
            <p style={{ fontSize: 12, color: '#888', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address || '—'}</p>
            <div style={{ textAlign: 'center' }}>
              {p.rating ? (
                <>
                  <div style={{ fontSize: 13, color: '#F4A623', fontWeight: 600 }}>⭐ {p.rating}</div>
                  {p.reviews && <div style={{ fontSize: 10, color: '#444' }}>{p.reviews}</div>}
                </>
              ) : <span style={{ color: '#333' }}>—</span>}
            </div>
            <div>
              {p.website ? (
                <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#ff7a3c', textDecoration: 'none', wordBreak: 'break-all' }}>
                  {p.website.replace(/https?:\/\//, '').split('/')[0].substring(0, 24)}
                </a>
              ) : (
                <span style={{ fontSize: 11, color: '#333' }}>—</span>
              )}
            </div>

            {/* Columna carta prospectada */}
            <div style={{ position: 'relative' }}>
              {editingCartaId === p.id ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    autoFocus
                    value={editingCartaUrl}
                    onChange={e => setEditingCartaUrl(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveCartaUrl(p.id, editingCartaUrl)
                      if (e.key === 'Escape') { setEditingCartaId(null); setEditingCartaUrl('') }
                    }}
                    placeholder="https://..."
                    style={{ fontSize: 11, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: 4, padding: '2px 6px', width: 140 }}
                  />
                  <button onClick={() => saveCartaUrl(p.id, editingCartaUrl)} style={{ fontSize: 11, background: '#22c55e', color: '#000', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>✓</button>
                </div>
              ) : isProcessing ? (
                <span style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>buscando...</span>
              ) : prospecto ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {prospecto.status === 'encontrado' ? (
                    <div>
                      <a href={prospecto.cartaUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, fontWeight: 600, color: '#4ade80', textDecoration: 'none', display: 'block' }}>
                        ✓ Ver carta ↗
                      </a>
                      <span style={{ fontSize: 10, color: '#555' }}>{prospecto.provider}</span>
                    </div>
                  ) : prospecto.status === 'sin_fotos' ? (
                    <div>
                      <a href={prospecto.cartaUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#d97706', textDecoration: 'none', display: 'block' }}>
                        ⚠ Sin fotos ↗
                      </a>
                      <span style={{ fontSize: 10, color: '#555' }}>{prospecto.provider}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: '#444' }}>✗ Sin carta</span>
                  )}
                  <button onClick={() => { setEditingCartaId(p.id); setEditingCartaUrl(prospecto.cartaUrl ?? '') }}
                    style={{ fontSize: 10, background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>✏</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#2a2a2a' }}>—</span>
                  <button onClick={() => { setEditingCartaId(p.id); setEditingCartaUrl('') }}
                    style={{ fontSize: 10, background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '0 2px' }}>✏</button>
                </div>
              )}
            </div>

            {/* Columna Feed — estado de importación */}
            <div>
              {(() => {
                const imp = importMap[p.id]
                if (!imp) return <span style={{ fontSize: 11, color: '#2a2a2a' }}>—</span>
                if (imp.status === 'importing') return <span style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>importando...</span>
                if (imp.status === 'ok') return (
                  <div>
                    <a href={`/qr/${imp.slug}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', textDecoration: 'none', display: 'block' }}>
                      ✓ /qr/{imp.slug} ↗
                    </a>
                    <span style={{ fontSize: 10, color: '#555' }}>{imp.dishCount} platos</span>
                  </div>
                )
                if (imp.status === 'error') return (
                  <span style={{ fontSize: 10, color: '#ef4444' }} title={imp.error}>✗ Error</span>
                )
              })()}
            </div>

            <button onClick={() => removePlace(p.id)} style={{ background: 'none', border: 'none', color: '#333', fontSize: 16, cursor: 'pointer', padding: 0, textAlign: 'center' }}>
              ×
            </button>
          </div>
          )
        })}
      </div>

      {filtered.length === 0 && search && (
        <div style={{ padding: 40, textAlign: 'center', color: '#444' }}>No se encontraron resultados</div>
      )}
    </>
  )
}

// ---- Shared components ----

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
      background: 'none', border: 'none', borderBottom: active ? '2px solid #ff4c00' : '2px solid transparent',
      color: active ? '#fff' : '#555', transition: 'color 0.15s', marginBottom: -1,
    }}>
      {children}
    </button>
  )
}

function Chip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
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

function MiniChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
