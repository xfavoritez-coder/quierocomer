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
  unmappedCategories?: string[]
}

const EXTRACTABLE_PROVIDERS = new Set([
  'Justo', 'OlaClick', 'UberEats', 'Fudo', 'Mercat', 'Gourmedia',
  'Rappi', 'Queresto', 'Web propia',
])
// PedidosYa bloquea scraping con 403 + CAPTCHA — no extractable
const BLOCKED_PROVIDERS = new Set(['PedidosYa'])

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
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

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

  // Manual provider override
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)

  async function saveProvider(placeId: string, provider: string) {
    const prev = prospectMap[placeId]
    if (!prev) return
    const updated = { ...prev, provider }
    await fetch('/api/mapalocales/prospectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: updated }),
    }).catch(() => {})
    setProspectMap(m => ({ ...m, [placeId]: updated }))
    setEditingProviderId(null)
  }

  // Modal de categorías sin mapear
  const [normModal, setNormModal] = useState<{ slug: string; placeId: string; categories: string[] } | null>(null)

  // Modal de revisión de carta completa
  const [cartaModal, setCartaModal] = useState<{ slug: string; name: string } | null>(null)

  // Modal agregar manual
  const [addModal, setAddModal] = useState(false)

  async function saveCartaUrl(placeId: string, url: string) {
    if (!url.trim()) return
    // Detect provider from URL
    const u = url.toLowerCase()
    const provider = u.includes('ubereats.com') ? 'UberEats'
      : u.includes('pedidosya.cl') ? 'PedidosYa'
      : u.includes('rappi.cl') || u.includes('rappi.com') ? 'Rappi'
      : u.includes('getjusto.com') || u.includes('/pedir') ? 'Justo'
      : u.includes('fu.do') ? 'Fudo'
      : u.includes('ola.click') ? 'OlaClick'
      : u.includes('gour.media') ? 'Gourmedia'
      : u.includes('toteat.app') ? 'Toteat'
      : u.includes('mer-cat.com') || u.includes('mercat') ? 'Mercat'
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
            impMap[r.id] = {
              status: 'ok',
              slug: r.importedSlug,
              unmappedCategories: r.unmappedCategories?.length > 0 ? r.unmappedCategories : undefined,
            }
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
    const toProcess = places.filter(p => selected.has(p.id) && p.rating != null && p.rating > 4 && p.reviews != null && p.reviews >= 10).map(p => ({
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
              setImportMap(m => ({ ...m, [msg.id]: { status: msg.status, slug: msg.slug, dishCount: msg.dishCount, error: msg.error, unmappedCategories: msg.unmappedCategories } }))
              if (msg.status === 'error') {
                setImportProgress(p => p ? { ...p, name: `✗ ${msg.name ?? ''}: ${msg.error ?? 'error'}` } : p)
              }
            } else if (msg.type === 'done') {
              setImportProgress(null)
            }
          } catch {}
        }
      }
    } catch {}
    finally { setImporting(false); setImportProgress(null) }
  }

  function handleNormSaved(placeId: string, savedCategories: string[]) {
    setImportMap(m => {
      const imp = m[placeId]
      if (!imp) return m
      const remaining = (imp.unmappedCategories ?? []).filter(c => !savedCategories.includes(c))
      return { ...m, [placeId]: { ...imp, unmappedCategories: remaining.length > 0 ? remaining : undefined } }
    })
  }

  const [hideImported, setHideImported] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return places.filter(p => {
      if (hideImported && importMap[p.id]?.status === 'ok') return false
      return !q ||
        p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ||
        p.address.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    })
  }, [places, search, hideImported, importMap])

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id))
  const isFiltering = search.trim().length > 0 || hideImported

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
          {filtered.length} local{filtered.length !== 1 ? 'es' : ''}{isFiltering ? ` de ${places.length}` : ''} · {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setAddModal(true)} style={{ fontSize: 12, color: '#a78bfa', background: 'none', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            + Agregar manual
          </button>
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
            onClick={() => setHideImported(h => !h)}
            style={{
              fontSize: 12, background: hideImported ? 'rgba(74,222,128,0.1)' : '#1a1a1a',
              border: `1px solid ${hideImported ? 'rgba(74,222,128,0.35)' : '#2a2a2a'}`,
              color: hideImported ? '#4ade80' : '#666',
              borderRadius: 8, padding: '10px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
            title="Ocultar los que ya tienen carta importada al feed"
          >
            {hideImported ? '✓ Ocultando importados' : 'Ocultar importados'}
          </button>
          <button
            onClick={() => {
              if (allFilteredSelected) {
                // Quitar solo los filtrados de la selección
                setSelected(prev => { const s = new Set(prev); filtered.forEach(p => s.delete(p.id)); return s })
              } else {
                // Añadir los filtrados a la selección (sin tocar el resto)
                setSelected(prev => { const s = new Set(prev); filtered.forEach(p => s.add(p.id)); return s })
              }
            }}
            style={{ fontSize: 12, color: '#888', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {allFilteredSelected
              ? (isFiltering ? 'Desmarcar filtrados' : 'Desmarcar todo')
              : (isFiltering ? 'Marcar filtrados' : 'Marcar todo')}
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
            const hasBlocked = selected.size > 0 && [...selected].every(id => {
              const pr = prospectMap[id]
              return pr?.provider && BLOCKED_PROVIDERS.has(pr.provider)
            })
            const importable = selected.size > 0 && !importing && [...selected].some(id => {
              const pr = prospectMap[id]
              return pr?.cartaUrl && (pr.provider == null || EXTRACTABLE_PROVIDERS.has(pr.provider))
            })
            if (hasBlocked && !importable) return (
              <div style={{ fontSize: 11, color: '#f87171', maxWidth: 200, lineHeight: 1.4 }}>
                PedidosYa bloquea extracción automática. Usa otra URL del local (UberEats, Rappi, Justo) o sube la carta manualmente.
              </div>
            )
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
            style={{ display: 'grid', gridTemplateColumns: '32px 2fr 1.5fr 70px 120px 120px 110px 36px', padding: '10px 14px', alignItems: 'center', borderBottom: '1px solid #1a1a1a', border: lastAddedId === p.id ? '2px solid #a78bfa' : undefined, transition: 'background 0.1s', background: lastAddedId === p.id ? 'rgba(167,139,250,0.07)' : selected.has(p.id) ? '#1a1100' : 'transparent' }}
            onMouseOver={e => { if (!selected.has(p.id) && lastAddedId !== p.id) e.currentTarget.style.background = '#1a1a1a' }}
            onMouseOut={e => { e.currentTarget.style.background = lastAddedId === p.id ? 'rgba(167,139,250,0.07)' : selected.has(p.id) ? '#1a1100' : 'transparent' }}
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
                      {editingProviderId === p.id ? (
                        <select
                          autoFocus
                          value={prospecto.provider ?? ''}
                          onChange={e => saveProvider(p.id, e.target.value)}
                          onBlur={() => setEditingProviderId(null)}
                          style={{ fontSize: 10, background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4, padding: '1px 4px' }}
                        >
                          {['UberEats','Justo','Rappi','PedidosYa','Mercat','Gourmedia','OlaClick','Fudo','Toteat','Web propia'].map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          title="Click para cambiar proveedor"
                          onClick={() => setEditingProviderId(p.id)}
                          style={{ fontSize: 10, color: prospecto.provider === 'Web propia' ? '#f59e0b' : '#555', cursor: 'pointer', textDecoration: 'underline dotted' }}
                        >{prospecto.provider ?? '?'}</span>
                      )}
                    </div>
                  ) : prospecto.status === 'sin_fotos' ? (
                    <div>
                      <a href={prospecto.cartaUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#d97706', textDecoration: 'none', display: 'block' }}>
                        ⚠ Sin fotos ↗
                      </a>
                      {editingProviderId === p.id ? (
                        <select
                          autoFocus
                          value={prospecto.provider ?? ''}
                          onChange={e => saveProvider(p.id, e.target.value)}
                          onBlur={() => setEditingProviderId(null)}
                          style={{ fontSize: 10, background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4, padding: '1px 4px' }}
                        >
                          {['UberEats','Justo','Rappi','PedidosYa','Mercat','Gourmedia','OlaClick','Fudo','Toteat','Web propia'].map(pv => (
                            <option key={pv} value={pv}>{pv}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          title="Click para cambiar proveedor"
                          onClick={() => setEditingProviderId(p.id)}
                          style={{ fontSize: 10, color: prospecto.provider === 'Web propia' ? '#f59e0b' : '#555', cursor: 'pointer', textDecoration: 'underline dotted' }}
                        >{prospecto.provider ?? '?'}</span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingCartaId(p.id); setEditingCartaUrl('') }}
                      style={{ fontSize: 11, color: '#f59e0b', background: 'none', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
                      + Pegar URL
                    </button>
                  )}
                  <button onClick={() => { setEditingCartaId(p.id); setEditingCartaUrl(prospecto.cartaUrl ?? '') }}
                    style={{ fontSize: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid #333', color: '#aaa', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>✏</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#444' }}>—</span>
                  <button onClick={() => { setEditingCartaId(p.id); setEditingCartaUrl('') }}
                    style={{ fontSize: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid #333', color: '#aaa', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>✏</button>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                      <span style={{ fontSize: 10, color: '#555' }}>{imp.dishCount} platos</span>
                      <button
                        onClick={() => setCartaModal({ slug: imp.slug!, name: p.name })}
                        style={{ fontSize: 10, color: '#a78bfa', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline dotted' }}>
                        Ver carta
                      </button>
                    </div>
                    {imp.unmappedCategories && imp.unmappedCategories.length > 0 && (
                      <button
                        onClick={() => setNormModal({ slug: imp.slug!, placeId: p.id, categories: imp.unmappedCategories! })}
                        title={`Click para mapear: ${imp.unmappedCategories.join(', ')}`}
                        style={{ fontSize: 9, color: '#f59e0b', marginTop: 2, cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left', display: 'block' }}>
                        ⚠ {imp.unmappedCategories.length} cat. sin mapear
                      </button>
                    )}
                  </div>
                )
                if (imp.status === 'error') return (
                  <span style={{ fontSize: 10, color: '#ef4444' }} title={imp.error}>
                    ✗ {imp.error ?? 'Error'}
                  </span>
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

      {addModal && (
        <AddManualModal
          onClose={() => setAddModal(false)}
          onAdded={(place, prospecto) => {
            setPlaces(prev => [place, ...prev.filter(p => p.id !== place.id)])
            if (prospecto) setProspectMap(m => ({ ...m, [place.id]: prospecto }))
            setLastAddedId(place.id)
            setTimeout(() => setLastAddedId(null), 3000)
            setAddModal(false)
          }}
        />
      )}

      {normModal && (
        <NormModal
          slug={normModal.slug}
          placeId={normModal.placeId}
          categories={normModal.categories}
          onClose={() => setNormModal(null)}
          onSaved={handleNormSaved}
        />
      )}

      {cartaModal && (
        <CartaModal
          slug={cartaModal.slug}
          name={cartaModal.name}
          onClose={() => setCartaModal(null)}
        />
      )}
    </>
  )
}

// ---- Modal agregar prospecto manual ----

function detectProvider(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('ubereats.com')) return 'UberEats'
  if (u.includes('pedidosya.cl')) return 'PedidosYa'
  if (u.includes('rappi.cl') || u.includes('rappi.com')) return 'Rappi'
  if (u.includes('getjusto.com') || u.includes('/pedir')) return 'Justo'
  if (u.includes('fu.do')) return 'Fudo'
  if (u.includes('ola.click')) return 'OlaClick'
  if (u.includes('gour.media')) return 'Gourmedia'
  if (u.includes('toteat.app')) return 'Toteat'
  return 'Web propia'
}

function AddManualModal({ onClose, onAdded }: {
  onClose: () => void
  onAdded: (place: PlaceResult, prospecto?: ProspectoResult) => void
}) {
  const [urlInput, setUrlInput] = useState('')       // Maps URL or any carta URL (for resolve)
  const [cartaUrl, setCartaUrl] = useState('')        // Carta URL (optional, if different from urlInput)
  const [resolving, setResolving] = useState(false)
  const [resolved, setResolved] = useState<{ name: string; address: string; lat: number | null; lng: number | null; placeId: string | null; mapsUrl: string; googleMapsUrl?: string | null; rating?: number | null; reviews?: number | null; website?: string | null; phone?: string | null; openingHours?: string[] | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // The effective carta URL: cartaUrl if provided, else urlInput if it's a delivery URL
  const effectiveCartaUrl = cartaUrl.trim() || (['ubereats', 'rappi', 'pedidosya', 'getjusto', 'justo', 'fu.do', 'ola.click', 'gour.media', 'toteat'].some(p => urlInput.toLowerCase().includes(p)) ? urlInput.trim() : '')

  async function resolve() {
    const toResolve = urlInput.trim()
    if (!toResolve) return
    setResolving(true)
    setError(null)
    setResolved(null)
    try {
      const res = await fetch('/api/mapalocales/resolve-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapsUrl: toResolve }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResolved(data)
      // Auto-fill carta URL if the input was a delivery URL and carta field is empty
      if (!cartaUrl.trim() && effectiveCartaUrl) {
        setCartaUrl(effectiveCartaUrl)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error resolviendo URL')
    } finally {
      setResolving(false)
    }
  }

  async function save() {
    const name = resolved?.name || ''
    if (!name) { setError('Necesito al menos el nombre del local'); return }
    setSaving(true)
    try {
      const id = resolved?.placeId ?? `manual-${Date.now().toString(36)}`
      const finalCartaUrl = effectiveCartaUrl
      const provider = finalCartaUrl ? detectProvider(finalCartaUrl) : undefined
      const finalMapsUrl = resolved?.googleMapsUrl ?? resolved?.mapsUrl ?? urlInput.trim()
      const res = await fetch('/api/mapalocales/prospectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manual: {
            id,
            name,
            address: resolved?.address ?? '',
            lat: resolved?.lat ?? null,
            lng: resolved?.lng ?? null,
            mapsUrl: finalMapsUrl,
            rating: resolved?.rating ?? null,
            reviews: resolved?.reviews ?? null,
            website: resolved?.website ?? null,
            cartaUrl: finalCartaUrl || undefined,
            provider,
          },
        }),
      })
      if (!res.ok) { setError('Error guardando'); return }

      const place: PlaceResult = {
        id,
        name,
        address: resolved?.address ?? '',
        lat: resolved?.lat ?? 0,
        lng: resolved?.lng ?? 0,
        mapsUrl: finalMapsUrl,
        website: resolved?.website ?? null,
        rating: resolved?.rating ?? null,
        reviews: resolved?.reviews ?? null,
      }
      const prospecto: ProspectoResult | undefined = finalCartaUrl ? {
        id,
        name,
        address: resolved?.address ?? '',
        mapsUrl: resolved?.mapsUrl ?? urlInput.trim(),
        status: 'encontrado',
        provider,
        cartaUrl: finalCartaUrl,
        fuenteMatch: 'manual',
      } : undefined

      onAdded(place, prospecto)
    } catch (e: any) {
      setError(e?.message ?? 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  const canResolve = !!urlInput.trim()
  const canSave = !!resolved?.name

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 16, padding: 28, width: 460, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>Agregar prospecto manual</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer', padding: 0 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* URL input — Maps, UberEats, Rappi, or any delivery URL */}
          <div>
            <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Link de Google Maps o URL de UberEats / Rappi *
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setResolved(null) }}
                onKeyDown={e => e.key === 'Enter' && resolve()}
                placeholder="maps.app.goo.gl/... o ubereats.com/cl/store/..."
                style={{ flex: 1, fontSize: 13, background: '#0d0d0d', border: '1px solid #333', color: '#fff', borderRadius: 8, padding: '8px 12px', outline: 'none' }}
              />
              <button
                onClick={resolve}
                disabled={resolving || !canResolve}
                style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, background: resolving || !canResolve ? '#222' : '#a78bfa', color: resolving || !canResolve ? '#444' : '#000', border: 'none', cursor: resolving || !canResolve ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
              >
                {resolving ? '...' : 'Resolver'}
              </button>
            </div>
          </div>

          {/* Resolved info */}
          {resolved && (
            <div style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{resolved.name || '—'}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{resolved.address || 'Sin dirección'}</div>
              {resolved.lat
                ? <div style={{ fontSize: 11, color: '#555' }}>{resolved.lat.toFixed(5)}, {resolved.lng?.toFixed(5)}</div>
                : <div style={{ fontSize: 11, color: '#666' }}>⚠ Sin ubicación exacta</div>
              }
              {(resolved.rating || resolved.reviews) && (
                <div style={{ fontSize: 11, color: '#a78bfa' }}>
                  {resolved.rating ? `★ ${resolved.rating}` : ''}{resolved.reviews ? ` (${resolved.reviews.toLocaleString()} reseñas)` : ''}
                </div>
              )}
              {resolved.website && (
                <div style={{ fontSize: 11, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resolved.website}</div>
              )}
              {resolved.googleMapsUrl && resolved.googleMapsUrl !== resolved.mapsUrl && (
                <div style={{ fontSize: 11, color: '#34d399' }}>Maps: {resolved.googleMapsUrl}</div>
              )}
              {resolved.openingHours && resolved.openingHours.length > 0 && (
                <details style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                  <summary style={{ cursor: 'pointer', color: '#888' }}>Horarios</summary>
                  <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {resolved.openingHours.map((h, i) => <span key={i}>{h}</span>)}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Carta URL — optional if urlInput is already a delivery URL */}
          <div>
            <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              URL de carta {effectiveCartaUrl && urlInput === effectiveCartaUrl ? '(auto-detectada del campo anterior)' : '(opcional si ya pegaste UberEats arriba)'}
            </label>
            <input
              value={cartaUrl}
              onChange={e => setCartaUrl(e.target.value)}
              placeholder="Solo si es diferente al link de arriba"
              style={{ width: '100%', fontSize: 13, background: '#0d0d0d', border: '1px solid #333', color: '#fff', borderRadius: 8, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
            />
            {effectiveCartaUrl && (
              <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 4 }}>
                Proveedor detectado: {detectProvider(effectiveCartaUrl)}
              </div>
            )}
          </div>

          {error && <div style={{ fontSize: 12, color: '#ef4444' }}>✗ {error}</div>}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ fontSize: 13, padding: '8px 18px', borderRadius: 8, background: 'none', border: '1px solid #333', color: '#666', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !canSave}
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: !canSave || saving ? '#222' : '#a78bfa', color: !canSave || saving ? '#444' : '#000', border: 'none', cursor: !canSave || saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Guardando...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Modal revisión carta completa ----

type CartaDish = {
  id: string
  name: string
  price: number
  photo: string | null
  isActive: boolean
  hiddenFromFeed: boolean
  diet: string
  leafOverride: string | null
  flavorTags: string[]
  dishLeafResolved: string
}

type CartaCategory = {
  categoryId: string
  categoryName: string
  normOverride: string | null
  leafResolved: string
  isMapped: boolean
  dishes: CartaDish[]
}

type CartaData = {
  restaurant: { id: string; name: string; slug: string }
  categories: CartaCategory[]
  totalDishes: number
  unmappedCount: number
}

const ALL_LEAF_OPTS = [
  'Entradas', 'Platos de fondo', 'Mariscos', 'Ceviches',
  'Sushi', 'Pizzas', 'Hamburguesas', 'Sándwiches', 'Completos', 'Papas fritas',
  'Parrilla', 'Pollo y alitas', 'Pastas', 'Peruana',
  'Mexicana', 'Asiática', 'China', 'Thai', 'India', 'Ramen', 'Gyoza', 'Japonesa',
  'Empanadas', 'Venezolana',
  'Ensaladas', 'Bowls', 'Saludable',
  'Postres', 'Helados',
  'Desayunos', 'Cafetería', 'Amasandería',
  'Smoothies', 'Milkshakes', 'Bebidas',
]

function CartaModal({ slug, name, onClose }: {
  slug: string
  name: string
  onClose: () => void
}) {
  const [data, setData] = useState<CartaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mappings, setMappings] = useState<Record<string, string>>({})   // catName → leaf
  const [diets, setDiets] = useState<Record<string, string>>({})          // catName → diet
  const [dishLeafs, setDishLeafs] = useState<Record<string, string>>({})  // dishId → leaf override
  const [dishDiets, setDishDiets] = useState<Record<string, string>>({})  // dishId → diet override
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch(`/api/mapalocales/carta?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then((d: CartaData) => {
        setData(d)
        const m: Record<string, string> = {}
        const di: Record<string, string> = {}
        const dl: Record<string, string> = {}
        const dd: Record<string, string> = {}
        for (const cat of d.categories) {
          m[cat.categoryName] = ALL_LEAF_OPTS.includes(cat.leafResolved) ? cat.leafResolved : ''
          di[cat.categoryName] = ''
          for (const dish of cat.dishes) {
            dl[dish.id] = dish.leafOverride ?? ''
            dd[dish.id] = dish.diet
          }
        }
        setMappings(m)
        setDiets(di)
        setDishLeafs(dl)
        setDishDiets(dd)
      })
      .catch(e => setError(e?.message ?? 'Error'))
      .finally(() => setLoading(false))
  }, [slug])

  async function save() {
    if (!data) return
    const catToSave = Object.entries(mappings).filter(([catName, v]) => {
      const original = data.categories.find(c => c.categoryName === catName)
      return v !== (original?.leafResolved ?? '')
    })
    const dietToSave = Object.entries(diets).filter(([, v]) => v)
    const allDishes = data.categories.flatMap(c => c.dishes)
    const dishesToSave = Object.entries(dishLeafs).filter(([dishId, leaf]) => {
      const original = allDishes.find(d => d.id === dishId)
      return leaf !== (original?.leafOverride ?? '')
    })
    const dishDietChanges = Object.entries(dishDiets).filter(([dishId, diet]) => {
      const original = allDishes.find(d => d.id === dishId)
      return diet !== (original?.diet ?? 'OMNIVORE')
    })
    if (!catToSave.length && !dietToSave.length && !dishesToSave.length && !dishDietChanges.length) { onClose(); return }
    setSaving(true)
    try {
      if (catToSave.length) {
        await fetch('/api/mapalocales/category-norm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mappings: catToSave.map(([categoryName, norm]) => ({ restaurantSlug: slug, categoryName, norm })),
          }),
        })
      }
      if (dietToSave.length) {
        await fetch('/api/mapalocales/category-diet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mappings: dietToSave.map(([categoryName, diet]) => ({ restaurantSlug: slug, categoryName, diet })),
          }),
        })
      }
      if (dishesToSave.length || dishDietChanges.length) {
        await fetch('/api/mapalocales/carta/remap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            overrides: dishesToSave.map(([dishId, leafOverride]) => ({ dishId, leafOverride: leafOverride || null })),
            dishDiets: dishDietChanges.map(([dishId, diet]) => ({ dishId, diet })),
          }),
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const allDishesFlat = data?.categories.flatMap(c => c.dishes) ?? []
  const hasChanges = Object.entries(mappings).some(([catName, v]) => {
    const original = data?.categories.find(c => c.categoryName === catName)
    return v !== (original?.leafResolved ?? '')
  }) || Object.values(diets).some(v => v)
    || Object.entries(dishLeafs).some(([dishId, leaf]) => {
      const original = allDishesFlat.find(d => d.id === dishId)
      return leaf !== (original?.leafOverride ?? '')
    })
    || Object.entries(dishDiets).some(([dishId, diet]) => {
      const original = allDishesFlat.find(d => d.id === dishId)
      return diet !== (original?.diet ?? 'OMNIVORE')
    })

  const displayCategories = showAll
    ? (data?.categories ?? [])
    : (data?.categories ?? []).filter(c => !c.isMapped)

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}
    >
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, width: '100%', maxWidth: 800 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #1a1a1a' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>{name}</h3>
            {data && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#555' }}>
                {data.totalDishes} platos · {data.categories.length} secciones
                {data.unmappedCount > 0 && (
                  <span style={{ color: '#f59e0b', marginLeft: 8 }}>⚠ {data.unmappedCount} sin mapear</span>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer', padding: 0 }}>×</button>
        </div>

        {loading && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#555', fontSize: 14 }}>Cargando carta...</div>
        )}

        {error && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#ef4444', fontSize: 13 }}>{error}</div>
        )}

        {data && !loading && (
          <>
            {/* Toggle */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid #1a1a1a', alignItems: 'center' }}>
              <button
                onClick={() => setShowAll(false)}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: !showAll ? '#ff4c00' : '#222', color: !showAll ? '#fff' : '#666' }}>
                Sin mapear ({data.unmappedCount})
              </button>
              <button
                onClick={() => setShowAll(true)}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: showAll ? '#a78bfa' : '#222', color: showAll ? '#000' : '#666' }}>
                Todas las secciones ({data.categories.length})
              </button>
            </div>

            {/* Category list */}
            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {displayCategories.length === 0 && (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#555', fontSize: 13 }}>
                  {showAll ? 'Sin secciones' : '✓ Todas las secciones están mapeadas'}
                </div>
              )}
              {displayCategories.map(cat => (
                <div key={cat.categoryName} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  {/* Category header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 130px', gap: 10, padding: '10px 24px', alignItems: 'center', background: cat.isMapped ? 'transparent' : 'rgba(245,158,11,0.04)' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: cat.isMapped ? '#aaa' : '#fff' }}>{cat.categoryName}</span>
                      {!cat.isMapped && (
                        <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 6 }}>sin mapear</span>
                      )}
                      <span style={{ fontSize: 10, color: '#333', marginLeft: 6 }}>{cat.dishes.length} platos</span>
                    </div>
                    <select
                      value={mappings[cat.categoryName] ?? ''}
                      onChange={e => setMappings(m => ({ ...m, [cat.categoryName]: e.target.value }))}
                      style={{
                        fontSize: 12, background: '#1a1a1a', borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                        border: `1px solid ${mappings[cat.categoryName] !== cat.leafResolved ? '#a78bfa' : cat.isMapped ? '#2a2a2a' : '#f59e0b55'}`,
                        color: mappings[cat.categoryName] !== cat.leafResolved ? '#c4b5fd' : cat.isMapped ? '#bbb' : '#f59e0b',
                      }}
                    >
                      <option value="">— sin asignar —</option>
                      {ALL_LEAF_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select
                      value={diets[cat.categoryName] ?? ''}
                      onChange={e => setDiets(d => ({ ...d, [cat.categoryName]: e.target.value }))}
                      style={{ fontSize: 12, background: '#1a1a1a', border: `1px solid ${diets[cat.categoryName] ? '#22c55e' : '#2a2a2a'}`, color: diets[cat.categoryName] === 'VEGAN' ? '#22c55e' : diets[cat.categoryName] === 'VEGETARIAN' ? '#86efac' : '#aaa', borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}
                    >
                      <option value="">— dieta —</option>
                      <option value="VEGETARIAN">🥬 Vegetariano</option>
                      <option value="VEGAN">🌱 Vegano</option>
                    </select>
                  </div>

                  {/* Dishes — todos visibles con leaf override y diet per-dish */}
                  <div style={{ padding: '0 24px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {cat.dishes.map(dish => {
                      const dishLeaf = dishLeafs[dish.id] ?? ''
                      const currentDiet = dishDiets[dish.id] ?? dish.diet
                      return (
                        <div key={dish.id} style={{ opacity: dish.isActive ? 1 : 0.4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {dish.photo ? (
                              <img src={dish.photo} alt="" style={{ width: 26, height: 26, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 26, height: 26, borderRadius: 3, background: '#1a1a1a', flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: 12, color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {dish.name}
                            </span>
                            {/* Per-dish diet */}
                            <select
                              value={currentDiet}
                              onChange={e => setDishDiets(m => ({ ...m, [dish.id]: e.target.value }))}
                              style={{
                                fontSize: 10, background: '#0d0d0d',
                                border: `1px solid ${currentDiet !== dish.diet ? '#22c55e55' : '#1a1a1a'}`,
                                color: currentDiet === 'VEGAN' ? '#22c55e' : currentDiet === 'VEGETARIAN' ? '#86efac' : '#888',
                                borderRadius: 4, padding: '2px 5px', cursor: 'pointer', maxWidth: 100,
                              }}
                            >
                              <option value="OMNIVORE">omnívoro</option>
                              <option value="VEGETARIAN">vegetariano</option>
                              <option value="VEGAN">vegano</option>
                            </select>
                            {/* Per-dish leaf override */}
                            <select
                              value={dishLeaf}
                              onChange={e => setDishLeafs(m => ({ ...m, [dish.id]: e.target.value }))}
                              style={{
                                fontSize: 11, background: '#0d0d0d',
                                border: `1px solid ${dishLeaf ? '#a78bfa55' : '#1a1a1a'}`,
                                color: dishLeaf ? '#c4b5fd' : '#999',
                                borderRadius: 4, padding: '2px 6px', cursor: 'pointer', maxWidth: 130,
                              }}
                            >
                              <option value="">{ALL_LEAF_OPTS.includes(dish.dishLeafResolved) ? dish.dishLeafResolved : (ALL_LEAF_OPTS.includes(cat.leafResolved) ? cat.leafResolved : 'sin mapear')}</option>
                              {ALL_LEAF_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          {/* FlavorTags badges */}
                          {dish.flavorTags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3, marginLeft: 34 }}>
                              {dish.flavorTags.map(tag => (
                                <span key={tag} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#1e1a2e', color: '#9d84f5', border: '1px solid #2d2450' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid #1a1a1a', justifyContent: 'flex-end', alignItems: 'center' }}>
              {saved && <span style={{ fontSize: 12, color: '#22c55e' }}>✓ Guardado</span>}
              <button onClick={onClose} style={{ fontSize: 13, padding: '8px 18px', borderRadius: 8, background: 'none', border: '1px solid #333', color: '#666', cursor: 'pointer' }}>
                Cerrar
              </button>
              <button
                onClick={save}
                disabled={saving || !hasChanges}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: hasChanges && !saving ? '#a78bfa' : '#222', color: hasChanges && !saving ? '#000' : '#444', border: 'none', cursor: saving || !hasChanges ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---- Modal mapeo de categorías ----

const QC_OPTS = [
  'Entradas', 'Platos de fondo', 'Combos',
  'Sushi', 'Pizzas', 'Hamburguesas', 'Sándwiches', 'Completos',
  'Parrilla', 'Pollo y alitas', 'Pastas', 'Peruana', 'Ceviches', 'Mariscos',
  'Mexicana', 'Asiática', 'China', 'Thai', 'India', 'Empanadas', 'Venezolana',
  'Saludable', 'Postres', 'Helados', 'Desayunos', 'Cafetería', 'Amasandería',
]

const DIET_OPTS = ['VEGETARIAN', 'VEGAN'] as const
type DietOpt = typeof DIET_OPTS[number]

function NormModal({ slug, placeId, categories, onClose, onSaved }: {
  slug: string
  placeId: string
  categories: string[]
  onClose: () => void
  onSaved: (placeId: string, savedCategories: string[]) => void
}) {
  const [mappings, setMappings] = useState<Record<string, string>>(
    Object.fromEntries(categories.map(c => [c, '']))
  )
  const [diets, setDiets] = useState<Record<string, string>>(
    Object.fromEntries(categories.map(c => [c, '']))
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    const catToSave = Object.entries(mappings).filter(([, v]) => v)
    const dietToSave = Object.entries(diets).filter(([, v]) => v)
    if (!catToSave.length && !dietToSave.length) { onClose(); return }
    setSaving(true)
    try {
      if (catToSave.length) {
        await fetch('/api/mapalocales/category-norm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mappings: catToSave.map(([categoryName, norm]) => ({ restaurantSlug: slug, categoryName, norm })),
          }),
        })
      }
      if (dietToSave.length) {
        await fetch('/api/mapalocales/category-diet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mappings: dietToSave.map(([categoryName, diet]) => ({ restaurantSlug: slug, categoryName, diet })),
          }),
        })
      }
      const saved = new Set([...catToSave.map(([c]) => c), ...dietToSave.map(([c]) => c)])
      onSaved(placeId, [...saved])
    } finally {
      setSaving(false)
      onClose()
    }
  }

  const hasChanges = Object.values(mappings).some(v => v) || Object.values(diets).some(v => v)

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 16, padding: 28, width: 560, maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>Mapear categorías sin asignar</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer', padding: 0 }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: '#555', margin: '0 0 20px' }}>
          Local: <span style={{ color: '#aaa' }}>/qr/{slug}</span>
        </p>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categoría original</span>
          <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mapear a</span>
          <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dieta</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categories.map(cat => (
            <div key={cat} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cat}>{cat}</span>
              <select
                value={mappings[cat] ?? ''}
                onChange={e => setMappings(m => ({ ...m, [cat]: e.target.value }))}
                style={{ fontSize: 13, background: '#0d0d0d', border: '1px solid #333', color: mappings[cat] ? '#fff' : '#aaa', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
              >
                <option value="">— sin cambio —</option>
                {QC_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select
                value={diets[cat] ?? ''}
                onChange={e => setDiets(d => ({ ...d, [cat]: e.target.value }))}
                style={{ fontSize: 13, background: '#0d0d0d', border: '1px solid #333', color: diets[cat] ? (diets[cat] === 'VEGAN' ? '#22c55e' : '#86efac') : '#aaa', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
              >
                <option value="">—</option>
                <option value="VEGETARIAN">🥬 Vegetariano</option>
                <option value="VEGAN">🌱 Vegano</option>
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ fontSize: 13, padding: '8px 18px', borderRadius: 8, background: 'none', border: '1px solid #333', color: '#666', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !hasChanges}
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: '#22c55e', color: '#000', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving || !hasChanges ? 0.5 : 1 }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
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
