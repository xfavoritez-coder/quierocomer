'use client'

import dynamic from 'next/dynamic'
import { useState, Suspense, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import type { RestauranteMapaData, ProspectoMapaData } from './page'
import type { PlaceResult } from '@/app/api/mapalocales/buscar-area/route'

const MapaLeaflet = dynamic(() => import('./MapaLeaflet'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Cargando mapa...</span>
    </div>
  ),
})

interface Props {
  restaurantes: RestauranteMapaData[]
  prospectos: ProspectoMapaData[]
}

type Stage = 'idle' | 'drawing' | 'ready' | 'searching' | 'done'

const LOCALSTORAGE_KEY = 'qc_mapa_places'

export default function MapaLocalesClient({ restaurantes, prospectos }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [points, setPoints] = useState<[number, number][]>([])
  const [results, setResults] = useState<PlaceResult[]>([])
  const [statusLog, setStatusLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const handlePointAdded = useCallback((_pt: [number, number], total: number) => {
    setPoints(prev => {
      const next = [...prev, _pt]
      return next
    })
    if (total >= 3 && stage === 'drawing') {
      // Allow closing — keep stage as drawing, show "Cerrar" button
    }
  }, [stage])

  const handleDblClick = useCallback(() => {
    if (points.length >= 3) doSearch(points)
  }, [points])

  function startDraw() {
    setStage('drawing')
    setPoints([])
    setResults([])
    setStatusLog([])
    setError(null)
  }

  function cancelDraw() {
    setStage('idle')
    setPoints([])
  }

  function closePolygon() {
    if (points.length < 3) return
    doSearch(points)
  }

  async function doSearch(pts: [number, number][]) {
    setStage('searching')
    setStatusLog([])
    setResults([])
    setError(null)

    try {
      const res = await fetch('/api/mapalocales/buscar-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polygon: pts }),
      })

      if (!res.body) throw new Error('Sin respuesta del servidor')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const found: PlaceResult[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.type === 'status') {
              setStatusLog(prev => [...prev, event.message])
            } else if (event.type === 'place') {
              found.push(event.place)
              setResults([...found])
            } else if (event.type === 'done') {
              setStage('done')
              // Guardar en DB solo los que cumplen criterios de calidad
              const qualify = found.filter(p =>
                p.rating != null && p.rating > 4 &&
                p.reviews != null && p.reviews >= 10
              )
              if (qualify.length > 0) {
                fetch('/api/mapalocales/prospectos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ places: qualify }),
                }).catch(() => {})
              }
            } else if (event.type === 'error') {
              setError(event.message)
              setStage('ready')
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setError(e.message)
      setStage('ready')
    }
  }

  const drawMode = stage === 'drawing'

  return (
    <div style={{ position: 'relative', height: 'calc(100dvh - 90px)' }}>
      <Suspense fallback={
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Cargando mapa...</span>
        </div>
      }>
        <MapaLeaflet
          restaurantes={restaurantes}
          prospectos={prospectos}
          drawMode={drawMode}
          onPointAdded={handlePointAdded}
          onPolygonDblClick={handleDblClick}
        />
      </Suspense>

      {/* Link a prospección — esquina superior izquierda, siempre visible */}
      <a
        href="/localesfeed/mapa"
        style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          background: 'rgba(20,20,20,0.92)', color: '#ff7a3c',
          border: '1px solid rgba(255,122,60,0.3)', borderRadius: 10,
          padding: '8px 14px', fontSize: 12, fontWeight: 600,
          textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(6px)',
        }}
      >
        📋 Ver prospección →
      </a>

      {/* Botón principal — esquina superior derecha */}
      {stage === 'idle' && (
        <button
          onClick={startDraw}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 1000,
            background: '#ff4c00', color: '#fff', border: 'none',
            borderRadius: 12, padding: '10px 16px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          ✏️ Marcar área
        </button>
      )}

      {/* Panel de dibujo — parte superior */}
      {(stage === 'drawing') && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#1a1a1a', border: '1px solid rgba(255,76,0,0.4)',
          borderRadius: 14, padding: '12px 16px', minWidth: 280,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.5 }}>
            {points.length === 0 && 'Haz clic en el mapa para empezar a marcar el área'}
            {points.length === 1 && 'Sigue haciendo clic para trazar el área'}
            {points.length === 2 && '1 punto más para poder cerrar el área'}
            {points.length >= 3 && `${points.length} puntos — puedes cerrar el área`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cancelDraw} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button
              onClick={closePolygon}
              disabled={points.length < 3}
              style={{
                flex: 2, padding: '8px 0', borderRadius: 10, border: 'none',
                background: points.length >= 3 ? '#ff4c00' : 'rgba(255,255,255,0.06)',
                color: points.length >= 3 ? '#fff' : 'rgba(255,255,255,0.2)',
                fontSize: 13, fontWeight: 600, cursor: points.length >= 3 ? 'pointer' : 'default',
              }}
            >
              Buscar en esta área →
            </button>
          </div>
        </div>
      )}

      {/* Buscando — panel con log en vivo */}
      {stage === 'searching' && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#141414', border: '1px solid rgba(255,76,0,0.25)',
          borderRadius: 14, padding: '14px 16px', minWidth: 300, maxWidth: 340,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {/* Título con spinner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              Buscando locales...
            </span>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: 14 }}>⟳</span>
          </div>

          {/* Log de estados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: results.length > 0 ? 10 : 0 }}>
            {statusLog.map((msg, i) => (
              <div key={i} style={{ fontSize: 11, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ color: '#4ade80', flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ color: i === statusLog.length - 1 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}>
                  {msg}
                </span>
              </div>
            ))}
          </div>

          {/* Locales apareciendo en vivo */}
          {results.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: '#ff7a3c', fontWeight: 600, marginBottom: 6 }}>
                {results.length} local{results.length !== 1 ? 'es' : ''} encontrado{results.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 120, overflowY: 'auto' }}>
                {results.map(p => (
                  <div key={p.id} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ color: '#4ade80', flexShrink: 0 }}>+</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    {p.rating && <span style={{ color: '#f4a623', flexShrink: 0 }}>⭐{p.rating}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Error */}
      {error && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#2a1a1a', border: '1px solid rgba(255,80,80,0.3)',
          borderRadius: 14, padding: '12px 16px', minWidth: 260,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          fontSize: 12, color: '#ff8080', textAlign: 'center',
        }}>
          {error}
          <button onClick={startDraw} style={{ display: 'block', margin: '8px auto 0', color: '#ff4c00', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
            Intentar de nuevo
          </button>
        </div>
      )}

      {/* Panel de resultados */}
      {stage === 'done' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
          background: '#141414', borderTop: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '45vh', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {results.length} local{results.length !== 1 ? 'es' : ''} encontrado{results.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <a
                href="/localesfeed/mapa"
                style={{ fontSize: 12, color: '#ff7a3c', textDecoration: 'none', fontWeight: 500 }}
              >
                Ver prospección →
              </a>
              <button onClick={startDraw} style={{
                background: '#ff4c00', color: '#fff', border: 'none', borderRadius: 8,
                padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                Nueva área
              </button>
              <button onClick={() => setStage('idle')} style={{
                background: 'transparent', color: 'rgba(255,255,255,0.3)', border: 'none',
                fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
              }}>
                ✕
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '0 12px 12px' }}>
            {results.map(p => (
              <div key={p.id} style={{
                padding: '10px 12px', borderRadius: 10, background: '#1a1a1a',
                marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.address}
                  </div>
                  {p.website && (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#ff7a3c', textDecoration: 'none' }}>
                      {p.website.replace(/https?:\/\//, '').split('/')[0]}
                    </a>
                  )}
                </div>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {p.rating && (
                    <span style={{ fontSize: 12, color: '#f4a623' }}>⭐ {p.rating}</span>
                  )}
                  <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: 10, color: 'rgba(255,255,255,0.3)', textDecoration: 'none',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 7px',
                  }}>
                    Maps
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
