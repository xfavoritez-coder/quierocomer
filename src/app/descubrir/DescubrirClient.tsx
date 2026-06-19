'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { slugify } from '@/lib/slugify'
import type { FeedDish } from '../a/types'
import FeedDishDetail from '../a/components/FeedDishDetail'
import { createEmptyProfile } from '../a/lib/scoring'
import { trackInteraction } from '../a/lib/feed-actions'
import { VeganIcon, VegetarianIcon, SpicyIcon } from '../a/components/DietIcons'

const profile = createEmptyProfile()
const PAGE_SIZE = 6

function DietTag({ dieta, sabores }: { dieta?: { tipo: string; esPicante: boolean }; sabores?: string[] }) {
  if (!dieta) return null
  const isPicante = sabores?.includes('picante') ?? dieta.esPicante
  const isVegan = dieta.tipo === 'VEGAN'
  const isVeg = dieta.tipo === 'VEGETARIAN'
  if (!isVegan && !isVeg && !isPicante) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, verticalAlign: 'middle', marginLeft: 3 }}>
      {isVegan && <VeganIcon />}
      {isVeg && !isVegan && <VegetarianIcon />}
      {isPicante && <SpicyIcon />}
    </span>
  )
}

function distanceLabel(lat1: number, lng1: number, lat2: number | null, lng2: number | null): string | null {
  if (lat2 == null || lng2 == null) return null
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const meters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  if (meters < 1000) return `A ${Math.round(meters)}m`
  return `A ${(meters / 1000).toFixed(1)}km`
}

function goHome() {
  try { localStorage.removeItem('qc_eureka_liked') } catch {}
  window.location.href = '/'
}

function goHomeKeep() {
  window.location.href = '/'
}

export default function DescubrirClient() {
  const [liked, setLiked] = useState<FeedDish[]>([])
  const [allRecommended, setAllRecommended] = useState<FeedDish[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedDish, setSelectedDish] = useState<FeedDish | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const recommendedRef = useRef<HTMLDivElement>(null)

  // Keep references for re-fetching
  const likedIdsRef = useRef<string[]>([])
  const locRef = useRef<{ lat?: number; lng?: number }>({})

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    try {
      const saved = localStorage.getItem('qc_location')
      if (saved) {
        const { lat, lng } = JSON.parse(saved)
        setUserLocation({ lat, lng })
      }
    } catch {}
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const raw = localStorage.getItem('qc_eureka_liked')
        if (!raw) { setLoading(false); return }
        const likedDishes: FeedDish[] = JSON.parse(raw)
        if (!likedDishes.length) { setLoading(false); return }
        setLiked(likedDishes)
        likedIdsRef.current = likedDishes.map(d => d.id)

        const locRaw = localStorage.getItem('qc_location')
        const loc = locRaw ? JSON.parse(locRaw) : {}
        locRef.current = loc

        const res = await fetch('/api/eureka', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dishIds: likedDishes.map(d => d.id),
            lat: loc?.lat,
            lng: loc?.lng,
            maxKm: 15,
          }),
        })
        const data = await res.json()
        setAllRecommended(data.dishes ?? [])
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const q = search.toLowerCase()

  const pageRecommended = allRecommended.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const filteredLiked = liked.filter(d =>
    !q || d.nombre.toLowerCase().includes(q) || d.restaurante.toLowerCase().includes(q)
  )
  const filteredRecommended = pageRecommended.filter(d =>
    !q || d.nombre.toLowerCase().includes(q) || d.restaurante.toLowerCase().includes(q)
  )

  const totalPages = Math.ceil(allRecommended.length / PAGE_SIZE)

  const MAX_PAGES = 4
  const visiblePages = Math.min(totalPages, MAX_PAGES)

  const allDishes = [...liked, ...allRecommended]

  const handleTap = useCallback((dish: FeedDish) => {
    setSelectedDish(dish)
    window.history.pushState(null, '', `/${dish.restauranteSlug}/${slugify(dish.nombre)}`)
    trackInteraction(dish.id, 'TAP', dish.categoriaNorm, dish.precioDescuento ?? dish.precio).catch(() => {})
  }, [])

  const bg = isDark ? '#0e0e0e' : '#f5f4f1'
  const headerBg = isDark ? 'rgba(14,14,14,0.97)' : 'rgba(245,244,241,0.97)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#fff'
  const inputBorder = isDark ? '1px solid rgba(255,255,255,0.10)' : '2px solid rgba(0,0,0,0.07)'
  const mutedColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'

  return (
    <div style={{ minHeight: '100dvh', background: bg, color: isDark ? '#fff' : '#111',
      fontFamily: 'var(--font-feed-body), DM Sans, system-ui, -apple-system, sans-serif' }}>

      {/* ─── Sticky header ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: headerBg,
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
        padding: '8px 16px 10px',
        display: 'flex', flexDirection: 'column', gap: 7,
      }}>
        {/* Row 1: logo + search + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <a href="/" onClick={(e) => { e.preventDefault(); goHome() }} style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="QuieroComer" style={{ height: 55, width: 'auto' }} />
          </a>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en QuieroComer"
              style={{
                width: '100%', padding: '11px 36px 11px 20px',
                borderRadius: 999, fontSize: 15, boxSizing: 'border-box',
                background: inputBg, border: inputBorder,
                color: isDark ? '#fff' : '#111', outline: 'none',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: mutedColor, display: 'flex', alignItems: 'center',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
          <a href="/" onClick={(e) => { e.preventDefault(); goHome() }} style={{
            flexShrink: 0, width: 49, height: 49, borderRadius: '50%',
            background: isDark ? 'rgba(255,255,255,0.10)' : '#fff',
            boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
            textDecoration: 'none', border: 'none',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </a>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `3px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            borderTopColor: '#F4A623',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : liked.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <p style={{ fontSize: 40, margin: '0 0 16px' }}>🍽️</p>
          <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Sin selecciones aún</p>
          <p style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)', margin: '0 0 24px' }}>
            Vuelve al feed, desliza 6 platos que te gusten y presiona Descubrir ✨
          </p>
          <a href="/" onClick={(e) => { e.preventDefault(); goHome() }} style={{
            display: 'inline-block', padding: '12px 24px', borderRadius: 14,
            background: '#F4A623', color: '#fff', textDecoration: 'none',
            fontSize: 15, fontWeight: 700,
          }}>
            Ir al feed
          </a>
        </div>
      ) : (
        <div style={{ padding: '20px 14px 80px' }}>

          {/* Back + título */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <a href="/" onClick={(e) => { e.preventDefault(); goHomeKeep() }} style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
              textDecoration: 'none',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </a>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: mutedColor }}>
              Tus elegidos
            </p>
          </div>
          {liked.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 32 }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const d = liked[i]
                if (d) return (
                  <div key={d.id} style={{ position: 'relative', aspectRatio: '1' }}>
                    <div onClick={() => handleTap(d)} style={{
                      position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden',
                      cursor: 'pointer', outline: '2px solid #F4A623', outlineOffset: -2,
                    }}>
                      {d.fotoUrl
                        ? <img src={d.fotoUrl} alt={d.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', background: isDark ? '#1e1e1e' : '#e8e8e8' }} />
                      }
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82), transparent)', padding: '24px 8px 8px' }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}<DietTag dieta={d.dieta} sabores={d.sabores} /></p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.restaurante}</p>
                      </div>
                    </div>
                    {/* X para quitar */}
                    <button
                      onClick={() => {
                        const next = liked.filter(x => x.id !== d.id)
                        setLiked(next)
                        try { localStorage.setItem('qc_eureka_liked', JSON.stringify(next)) } catch {}
                      }}
                      style={{
                        position: 'absolute', top: 6, right: 6, zIndex: 2,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.55)', border: 'none',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', lineHeight: 1,
                      }}
                    >✕</button>
                  </div>
                )
                return (
                  <a key={i} href="/" onClick={(e) => { e.preventDefault(); try { localStorage.setItem('qc_eureka_afinar', '1') } catch {}; goHomeKeep() }} style={{
                    aspectRatio: '1', borderRadius: 14,
                    border: `2px dashed ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                    textDecoration: 'none', cursor: 'pointer', padding: '0 6px',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)'} strokeWidth="2" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', textAlign: 'center', lineHeight: 1.3 }}>Afinar</p>
                    <p style={{ margin: 0, fontSize: 10, color: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.32)', textAlign: 'center', lineHeight: 1.3 }}>Agregar 1 más</p>
                  </a>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: mutedColor, marginBottom: 32 }}>Sin resultados.</p>
          )}

          {/* Platos nuevos que te podrían gustar */}
          {allRecommended.length > 0 && (
            <>
              <div ref={recommendedRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: mutedColor }}>
                    Platos que te podrían gustar
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 400, color: mutedColor, opacity: 0.7, letterSpacing: 0, textTransform: 'none' }}>
                    basado en tus elegidos
                  </p>
                </div>
                {totalPages > 1 && (
                  <span style={{ fontSize: 11, color: mutedColor }}>
                    {page + 1} / {totalPages}
                  </span>
                )}
              </div>
              {filteredRecommended.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {filteredRecommended.map(d => (
                    <div key={d.id} onClick={() => handleTap(d)} style={{
                      position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                    }}>
                      {d.fotoUrl
                        ? <img src={d.fotoUrl} alt={d.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', background: isDark ? '#1e1e1e' : '#e8e8e8' }} />
                      }
                      <span style={{
                        position: 'absolute', top: 6, left: 6,
                        background: '#F4A623', borderRadius: 20,
                        padding: '4px 8px', lineHeight: 1,
                        fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.04em',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" stroke="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        para ti
                      </span>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82), transparent)', padding: '24px 8px 8px' }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{d.nombre}</span>
                          <DietTag dieta={d.dieta} sabores={d.sabores} />
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {userLocation ? (distanceLabel(userLocation.lat, userLocation.lng, d.restauranteLat, d.restauranteLng) ?? d.restaurante) : d.restaurante}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: mutedColor }}>Sin resultados.</p>
              )}
            </>
          )}

          {/* Acciones footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24 }}>
            <a href="/" onClick={(e) => { e.preventDefault(); goHomeKeep() }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 12,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
              color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)',
              textDecoration: 'none', fontSize: 14, whiteSpace: 'nowrap',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Volver a explorar
            </a>

            {visiblePages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Prev */}
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{
                    width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: page === 0 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: page === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
                    color: page === 0 ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'),
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>

                {/* Page numbers */}
                {Array.from({ length: visiblePages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    style={{
                      width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 600,
                      background: page === i ? '#F4A623' : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
                      color: page === i ? '#fff' : (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'),
                      transition: 'all 0.15s',
                    }}
                  >{i + 1}</button>
                ))}

                {/* Next */}
                <button
                  onClick={() => setPage(p => Math.min(visiblePages - 1, p + 1))}
                  disabled={page >= visiblePages - 1}
                  style={{
                    width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: page >= visiblePages - 1 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: page >= visiblePages - 1 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
                    color: page >= visiblePages - 1 ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'),
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
            )}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {selectedDish && (
        <FeedDishDetail
          key={selectedDish.id}
          dish={selectedDish}
          allDishes={allDishes}
          profile={profile}
          onClose={() => { setSelectedDish(null); window.history.pushState(null, '', '/descubrir') }}
          onSave={() => {}}
          onDishTap={handleTap}
          isDark={isDark}
          userLocation={userLocation}
        />
      )}
    </div>
  )
}
