'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: Record<string, string>
}

interface LocationModalProps {
  onClose: () => void
  onConfirm: (loc: { lat: number; lng: number; label: string }) => void
  isDark?: boolean
}

// ─── Map component (loaded dynamically, no SSR) ────────────────────────────────

const MapView = dynamic(
  () => import('./LocationMapView'),
  { ssr: false, loading: () => <div style={{ width: '100%', height: '100%', background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>Cargando mapa...</div> }
)

// ─── Main component ────────────────────────────────────────────────────────────

export default function LocationModal({ onClose, onConfirm, isDark }: LocationModalProps) {
  const [step, setStep] = useState<'search' | 'map'>('search')

  // Search step
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Map step
  const [mapLat, setMapLat] = useState(-33.4489)
  const [mapLng, setMapLng] = useState(-70.6693)
  const [addressLabel, setAddressLabel] = useState('')

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  // Debounced Nominatim search
  useEffect(() => {
    if (!searchInput.trim() || searchInput.length < 3) {
      setSearchResults([])
      return
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchInput)}&format=json&addressdetails=1&limit=6&countrycodes=cl`,
          { headers: { 'Accept-Language': 'es' } }
        )
        const data: NominatimResult[] = await res.json()
        setSearchResults(data)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 400)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchInput])

  const goToMap = useCallback((lat: number, lng: number, label: string) => {
    setMapLat(lat)
    setMapLng(lng)
    setAddressLabel(label)
    setStep('map')
  }, [])

  const handleResultClick = useCallback((result: NominatimResult) => {
    const addr = result.address
    const label = buildLabel(addr) || result.display_name.split(',').slice(0, 2).join(',').trim()
    goToMap(parseFloat(result.lat), parseFloat(result.lon), label)
  }, [goToMap])

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`,
            { headers: { 'Accept-Language': 'es' } }
          )
          const data = await res.json()
          const label = buildLabel(data.address) || 'Cerca de ti'
          goToMap(lat, lng, label)
        } catch {
          goToMap(lat, lng, 'Cerca de ti')
        } finally {
          setGpsLoading(false)
        }
      },
      () => {
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }, [goToMap])

  const handleMarkerDragEnd = useCallback(async (lat: number, lng: number) => {
    setMapLat(lat)
    setMapLng(lng)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`,
        { headers: { 'Accept-Language': 'es' } }
      )
      const data = await res.json()
      const label = buildLabel(data.address) || 'Ubicación seleccionada'
      setAddressLabel(label)
    } catch {
      // keep previous label
    }
  }, [])

  const handleConfirm = useCallback(() => {
    onConfirm({ lat: mapLat, lng: mapLng, label: addressLabel })
  }, [mapLat, mapLng, addressLabel, onConfirm])

  // Trim long Nominatim display_name for list
  const trimDisplayName = (name: string) => {
    const parts = name.split(',').map(p => p.trim())
    return parts.slice(0, 3).join(', ')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.3)' }}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 91,
        minHeight: '70vh', maxHeight: '92vh',
        background: isDark ? '#1a1a1a' : '#fff',
        borderRadius: '24px 24px 0 0',
        animation: 'slideUp 0.25s ease-out',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Drag handle */}
        <div style={{ width: 40, height: 5, background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)', borderRadius: 999, margin: '12px auto 0', flexShrink: 0 }} />

        {/* X button — fijo arriba a la derecha */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 16,
          background: 'none', border: 'none', cursor: 'pointer',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', fontSize: 28, lineHeight: 1,
          padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>

        {step === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '14px 16px 12px', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: isDark ? '#fff' : '#111' }}>¿Dónde estás?</h2>
            </div>

            {/* Search input */}
            <div style={{ padding: '0 16px', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'} strokeWidth="2.5" strokeLinecap="round"
                  style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Buscar dirección, comuna o ciudad..."
                  style={{
                    width: '100%', padding: '13px 14px 13px 42px',
                    borderRadius: 14, fontSize: 15,
                    background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                    color: isDark ? '#fff' : '#111', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {searchLoading && (
                  <div style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    width: 16, height: 16, border: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    borderTopColor: '#F4A623', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                )}
              </div>
            </div>

            {/* Results list */}
            {searchResults.length > 0 && (
              <div style={{
                margin: '8px 16px 0',
                background: isDark ? '#252525' : '#fff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 14,
                maxHeight: 240,
                overflowY: 'auto',
                flexShrink: 0,
              }}>
                {searchResults.map((result, i) => (
                  <button
                    key={result.place_id}
                    onClick={() => handleResultClick(result)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      width: '100%', padding: '12px 14px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left',
                      borderBottom: i < searchResults.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` : 'none',
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📍</span>
                    <span style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#222', lineHeight: 1.4 }}>
                      {trimDisplayName(result.display_name)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* GPS button — debajo del input */}
            <div style={{ padding: '20px 16px 0', flexShrink: 0 }}>
              <button
                onClick={handleGPS}
                disabled={gpsLoading}
                style={{
                  width: '100%', height: 50, borderRadius: 16,
                  background: 'rgba(244,166,35,0.1)',
                  border: '1px solid rgba(244,166,35,0.35)',
                  color: gpsLoading ? 'rgba(180,110,0,0.5)' : '#c97d00', fontSize: 15, fontWeight: 600, cursor: gpsLoading ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {gpsLoading ? (
                  <>
                    <div style={{
                      width: 18, height: 18, border: '2.5px solid rgba(244,166,35,0.2)',
                      borderTopColor: '#c97d00', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    Obteniendo ubicación...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                      <line x1="12" y1="2" x2="12" y2="5" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="5" y2="12" />
                      <line x1="19" y1="12" x2="22" y2="12" />
                    </svg>
                    Usar mi ubicación actual
                  </>
                )}
              </button>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />
          </div>
        )}

        {step === 'map' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px', flexShrink: 0 }}>
              <button
                onClick={() => setStep('search')}
                style={{
                  width: 36, height: 36, borderRadius: 999,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
                  color: isDark ? 'rgba(255,255,255,0.7)' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: isDark ? '#fff' : '#111' }}>Confirma tu ubicación</h2>
            </div>

            {/* Map */}
            <div style={{ height: 260, margin: '0 16px', borderRadius: 16, overflow: 'hidden', flexShrink: 0 }}>
              <MapView lat={mapLat} lng={mapLng} onDragEnd={handleMarkerDragEnd} />
            </div>

            {/* Hint debajo del mapa */}
            <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)', margin: '10px 16px 0', lineHeight: 1.4, fontWeight: 500 }}>
              Arrastra el marcador para ajustar la ubicación exacta
            </p>

            {/* Address label */}
            <div style={{ padding: '10px 16px 10px', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', borderRadius: 14,
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📍</span>
                <p style={{ margin: 0, fontSize: 14, color: isDark ? 'rgba(255,255,255,0.8)' : '#222', lineHeight: 1.5, fontWeight: 500 }}>
                  {addressLabel || 'Ubicación seleccionada'}
                </p>
              </div>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Confirm button */}
            <div style={{ padding: '10px 16px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', flexShrink: 0 }}>
              <button
                onClick={handleConfirm}
                style={{
                  width: '100%', height: 54, border: 'none', borderRadius: 16,
                  background: '#F4A623', color: '#000', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Confirmar ubicación
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}

// ─── Helper: build readable address label ────────────────────────────────────

function buildLabel(addr: Record<string, string>): string {
  const parts: string[] = []
  if (addr.road) parts.push(addr.road)
  const zone = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || addr.town || addr.village
  if (zone && zone !== addr.road) parts.push(zone)
  return parts.join(', ')
}
