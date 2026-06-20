'use client'

import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react'

function getSecondaryDishTypes(types: string[], primary: string): string[] {
  return types.filter(t => t !== primary && t !== 'extra' && t !== 'combo')
}

/** Links sin valor para el usuario — no se muestra botón */
const NO_BUTTON_SUFFIXES = [
  'tripadvisor.cl', 'tripadvisor.com',
  'google.com', 'share.google',
  'quierocomer.cl',
]

/** Redes sociales → "Ver Instagram" / "Ver Facebook" / etc. */
const SOCIAL_PLATFORMS: { suffix: string; name: string }[] = [
  { suffix: 'instagram.com', name: 'Instagram' },
  { suffix: 'facebook.com', name: 'Facebook' },
  { suffix: 'tiktok.com', name: 'TikTok' },
  { suffix: 'twitter.com', name: 'Twitter' },
  { suffix: 'x.com', name: 'Twitter' },
  { suffix: 'linktr.ee', name: 'Linktree' },
  { suffix: 'linktree.com', name: 'Linktree' },
  { suffix: 'atom.bio', name: 'Bio' },
]

/** Plataformas de pedido / delivery online → "Pedir online" */
const DELIVERY_SUFFIXES = [
  'rappi.com', 'rappi.cl',
  'ubereats.com',
  'getjusto.com', 'justo.pe', 'justo.cl',
  'mercat.cl',
  'pedidosya.com',
  'wa.me',
]

/**
 * Prefijos de subdominio que identifican plataformas de pedido online
 * aunque el dominio principal sea propio del local.
 * Ej: carta.juanalabrava.cl, pedir.autentikofrenchtakos.cl
 */
const DELIVERY_SUBDOMAIN_PREFIXES = ['carta.', 'pedir.', 'pedido.', 'order.', 'menu.mercat.']

/** Visores de carta digital → "Ver carta online" */
const MENU_CARD_SUFFIXES = [
  'fu.do', 'ola.click', 'olaclick.com',
  'gour.media', 'gourmedia.cl',
  'toteat.com', 'toteat.app',
  'queresto.com',
  'influye.app',
  'heyzine.com', 'canva.com', 'issuu.com', 'flipsnack.com', 'yumpu.com',
  'treinta.co', 'gourmetclick.cl', 'lacarte.cl', 'avocaty.io', 'socialreacts.com',
  'micartaqr.cl', 'qrpro.io',
  'netlify.app',
]

type OrderInfo = { url: string; type: 'delivery' | 'menu' | 'website' | 'social'; socialName?: string }

function getOrderInfo(website: string | null | undefined, isOrderUrl?: boolean): OrderInfo | null {
  if (!website) return null
  try {
    const urlObj = new URL(website)
    const host = urlObj.hostname.replace(/^www\./, '')
    const pathname = urlObj.pathname
    if (NO_BUTTON_SUFFIXES.some(s => host === s || host.endsWith('.' + s))) return null
    if (isOrderUrl) return { url: website, type: 'delivery' }
    if (
      DELIVERY_SUFFIXES.some(s => host === s || host.endsWith('.' + s)) ||
      DELIVERY_SUBDOMAIN_PREFIXES.some(p => host.startsWith(p)) ||
      pathname === '/pedir' || pathname.startsWith('/pedir/')
    ) return { url: website, type: 'delivery' }
    if (MENU_CARD_SUFFIXES.some(s => host === s || host.endsWith('.' + s))) {
      return { url: website, type: 'menu' }
    }
    const social = SOCIAL_PLATFORMS.find(p => host === p.suffix || host.endsWith('.' + p.suffix))
    if (social) return { url: website, type: 'social', socialName: social.name }
    return { url: website, type: 'website' }
  } catch { return null }
}
import type { FeedDish } from '../types'
import { getCategoryGradient, isValidQcCategory, DISH_TYPE_PRIORITY, getPrimaryDishType } from '../lib/categories'
import { extractKeywords } from '../lib/keywords'
import type { FeedProfile } from '../lib/scoring'
import { getSimilarDishIds } from '../lib/feed-actions'
import { distanceKm, formatDistance } from '../lib/geo'
import DishCard from './DishCard'
import { VeganIcon, VegetarianIcon, SpicyIcon } from './DietIcons'

export default function FeedDishDetail({
  dish,
  allDishes,
  dishPool,
  profile,
  onClose,
  onSave,
  onDishTap,
  onCategoryClick,
  hideRelated,
  userLocation,
  isDark,
  savedDishIds,
}: {
  dish: FeedDish
  allDishes: FeedDish[]
  dishPool?: FeedDish[]
  profile: FeedProfile
  onClose: () => void
  onSave: (dish: FeedDish) => void
  onDishTap: (dish: FeedDish) => void
  onCategoryClick?: (category: string) => void
  hideRelated?: boolean
  userLocation?: { lat: number; lng: number } | null
  isDark?: boolean
  savedDishIds?: Set<string>
}) {
  const [isDesktop, setIsDesktop] = useState(false)
  const [visible, setVisible] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const currentIndex = allDishes.findIndex(d => d.id === dish.id)
  const [activeIdx, setActiveIdx] = useState(currentIndex >= 0 ? currentIndex : 0)
  const programmaticScrollRef = useRef(false)

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Lock body scroll
  useEffect(() => {
    const savedY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, savedY)
    }
  }, [])

  // Scroll to current dish on mount (mobile only)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || isDesktop) return
    if (currentIndex >= 0) {
      programmaticScrollRef.current = true
      el.scrollTo({ left: currentIndex * el.clientWidth, behavior: 'instant' as any })
      setTimeout(() => { programmaticScrollRef.current = false }, 300)
    }
  }, [currentIndex, isDesktop])

  // Observe which slide is active (mobile only)
  useEffect(() => {
    if (isDesktop) return
    const el = scrollRef.current
    if (!el) return
    let mounted = false
    const timer = setTimeout(() => { mounted = true }, 400)
    const slides = el.querySelectorAll('[data-slide]')
    const obs = new IntersectionObserver((entries) => {
      if (!mounted || programmaticScrollRef.current) return
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          const idx = parseInt((e.target as HTMLElement).dataset.slide || '0')
          setActiveIdx(idx)
        }
      })
    }, { root: el, threshold: [0.6] })
    slides.forEach(s => obs.observe(s))
    return () => { clearTimeout(timer); obs.disconnect() }
  }, [allDishes.length, isDesktop])

  // Keyboard navigation on desktop
  useEffect(() => {
    if (!isDesktop) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft' && activeIdx > 0) setActiveIdx(i => i - 1)
      if (e.key === 'ArrowRight' && activeIdx < allDishes.length - 1) setActiveIdx(i => i + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDesktop, activeIdx, allDishes.length])

  // Reset card scroll when navigating to another dish
  useEffect(() => {
    cardRef.current?.scrollTo({ top: 0 })
  }, [activeIdx])

  const close = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const activeDish = allDishes[activeIdx] ?? dish

  // ─── Desktop dialog layout ─────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div
        onClick={e => { if (e.target === e.currentTarget) close() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 120,
          background: 'rgba(0,0,0,0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease-out',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        }}
      >
        {/* Prev arrow */}
        {activeIdx > 0 && (
          <button onClick={() => setActiveIdx(i => i - 1)} style={{
            position: 'absolute', left: 20,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', border: 'none',
            cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            transition: 'background 0.15s',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}

        {/* Card */}
        <div ref={cardRef} style={{
          background: isDark ? '#1a1a1a' : '#fff',
          borderRadius: 20,
          width: '92%', maxWidth: 560, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          position: 'relative',
          scrollbarWidth: 'none',
        }}>
          {/* Close button */}
          <button onClick={close} style={{
            position: 'absolute', top: 14, right: 14, zIndex: 10,
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(0,0,0,0.25)', border: 'none',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff',
          }}>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>

          {/* Left: Photo */}
          <DesktopDishContent
            key={activeDish.id}
            dish={activeDish}
            allDishes={allDishes}
            dishPool={dishPool}
            profile={profile}
            onClose={close}
            onSave={onSave}
            onDishTap={(d) => {
              const idx = allDishes.findIndex(x => x.id === d.id)
              if (idx >= 0) setActiveIdx(idx)
              else onDishTap(d)
            }}
            onCategoryClick={onCategoryClick}
            hideRelated={hideRelated}
            userLocation={userLocation}
            isDark={isDark}
            initialSaved={savedDishIds?.has(activeDish.id) ?? false}
          />
        </div>

        {/* Next arrow */}
        {activeIdx < allDishes.length - 1 && (
          <button onClick={() => setActiveIdx(i => i + 1)} style={{
            position: 'absolute', right: 20,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', border: 'none',
            cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            transition: 'background 0.15s',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        )}

        {/* Dot counter */}
        {allDishes.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 20,
            display: 'flex', gap: 6, alignItems: 'center',
          }}>
            {allDishes.slice(Math.max(0, activeIdx - 3), Math.min(allDishes.length, activeIdx + 4)).map((_, relIdx) => {
              const absIdx = Math.max(0, activeIdx - 3) + relIdx
              return (
                <div key={absIdx} style={{
                  width: absIdx === activeIdx ? 20 : 6,
                  height: 6, borderRadius: 3,
                  background: absIdx === activeIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                  transition: 'all 0.2s',
                }} />
              )
            })}
          </div>
        )}

        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
      </div>
    )
  }

  // ─── Mobile: horizontal scroll carousel ───────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120,
      background: '#0e0e0e',
      opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease-out',
    }}>
      {/* Horizontal scroll — native snap */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex', width: '100%', height: '100%',
          overflowX: 'scroll', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as any,
        }}
      >
        {allDishes.map((d, idx) => {
          const distance = Math.abs(idx - activeIdx)
          // Only render nearby slides
          if (distance > 3) return <div key={d.id} data-slide={idx} style={{ flex: '0 0 100%', width: '100vw', scrollSnapAlign: 'start' }} />
          return (
            <DishSlide
              key={d.id}
              dish={d}
              index={idx}
              isActive={idx === activeIdx}
              onClose={close}
              onSave={onSave}
              onDishTap={onDishTap}
              onCategoryClick={onCategoryClick}
              allDishes={allDishes}
              dishPool={dishPool}
              profile={profile}
              hideRelated={hideRelated}
              userLocation={userLocation}
              isDark={isDark}
              initialSaved={savedDishIds?.has(d.id) ?? false}
            />
          )
        })}
      </div>

      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}

/* ── Desktop: dish content in a two-column card layout ── */
function DesktopDishContent({
  dish, allDishes, dishPool, profile, onClose, onSave, onDishTap, onCategoryClick, hideRelated, userLocation, isDark, initialSaved,
}: {
  dish: FeedDish; allDishes: FeedDish[]; dishPool?: FeedDish[]; profile: FeedProfile;
  onClose: () => void; onSave: (d: FeedDish) => void; onDishTap: (d: FeedDish) => void;
  onCategoryClick?: (category: string) => void; hideRelated?: boolean;
  userLocation?: { lat: number; lng: number } | null; isDark?: boolean; initialSaved?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved ?? false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [showDietTooltip, setShowDietTooltip] = useState(false)
  const [showSpicyTooltip, setShowSpicyTooltip] = useState(false)
  const [showPriceTooltip, setShowPriceTooltip] = useState(false)
  const [resolvedPhone, setResolvedPhone] = useState<string | null>(dish.restaurantePhone ?? null)

  useEffect(() => {
    setResolvedPhone(dish.restaurantePhone ?? null)
    if (dish.restaurantePhone || !dish.restaurantePlaceId) return
    fetch(`/api/place-phone?placeId=${encodeURIComponent(dish.restaurantePlaceId)}`)
      .then(r => r.json()).then(d => { if (d.phone) setResolvedPhone(d.phone) }).catch(() => {})
  }, [dish.id, dish.restaurantePhone, dish.restaurantePlaceId])

  const gradient = getCategoryGradient(dish.categoriaNorm)

  const dist = userLocation && dish.restauranteLat && dish.restauranteLng
    ? distanceKm(userLocation.lat, userLocation.lng, dish.restauranteLat, dish.restauranteLng) : null

  // Related dishes
  const [embeddingSimilarIds, setEmbeddingSimilarIds] = useState<string[] | null>(null)
  useEffect(() => {
    if (hideRelated) return
    getSimilarDishIds(dish.id).then(ids => {
      if (ids.length > 0) setEmbeddingSimilarIds(ids)
    }).catch(() => {})
  }, [dish.id, hideRelated])

  const relatedDishes = useMemo(() => {
    if (hideRelated) return []
    const rawPool = dishPool && dishPool.length > 0 ? dishPool : allDishes
    const seenPoolIds = new Set<string>()
    const pool = rawPool.filter(d => { if (seenPoolIds.has(d.id)) return false; seenPoolIds.add(d.id); return true })
    const candidates = pool.filter(d => d.fotoUrl && d.id !== dish.id && d.restauranteId !== dish.restauranteId)
    const embRank = new Map<string, number>()
    if (embeddingSimilarIds) {
      embeddingSimilarIds.forEach((id, i) => embRank.set(id, 1 - i / embeddingSimilarIds.length))
    }
    const thisKws = new Set(extractKeywords(dish.nombre, dish.descripcion))
    const thisTxTypes = new Set(dish.txDishType ?? [])
    const scored = candidates.map(d => {
      let relevance = embRank.get(d.id) ? (embRank.get(d.id)! * 10) : 0
      // Taxonomy: same dish type es la señal más fuerte (Pinterest-style: "más de esto")
      const sharedTypes = (d.txDishType ?? []).filter(t => thisTxTypes.has(t))
      relevance += sharedTypes.length * 8
      // Misma cocina
      if (dish.cuisineTag && d.cuisineTag === dish.cuisineTag) relevance += 5
      // Misma leaf category
      if (d.categoriaNorm === dish.categoriaNorm) relevance += 4
      // Mismo parent
      if (dish.categoriaParent && d.categoriaParent === dish.categoriaParent) relevance += 2
      // Keywords
      const dKws = extractKeywords(d.nombre, d.descripcion)
      for (const kw of dKws) { if (thisKws.has(kw)) relevance += 2 }
      const dist = userLocation && d.restauranteLat && d.restauranteLng
        ? distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat, d.restauranteLng) : null
      return { dish: d, relevance, dist }
    })
    const relevant = scored.filter(x => x.relevance > 0)
    const pool2 = relevant.length >= 4 ? relevant : scored
    const sorted = pool2.sort((a, b) => {
      const distA = a.dist ?? 999; const distB = b.dist ?? 999
      return (b.relevance * 5 - distB * 0.3) - (a.relevance * 5 - distA * 0.3)
    })
    const perLocal = new Map<string, number>()
    const seenIds = new Set<string>()
    const result: FeedDish[] = []
    for (const x of sorted) {
      if (seenIds.has(x.dish.id)) continue
      const count = perLocal.get(x.dish.restauranteId) ?? 0
      if (count >= 2) continue
      seenIds.add(x.dish.id)
      perLocal.set(x.dish.restauranteId, count + 1)
      result.push(x.dish)
      if (result.length >= 12) break
    }
    return result
  }, [dish, allDishes, dishPool, embeddingSimilarIds, hideRelated, userLocation])

  return (
    <>
      {/* Top: Photo */}
      <div style={{ flexShrink: 0, height: 280, position: 'relative', background: isDark ? '#111' : '#f0efec' }}>
        {dish.fotoUrl ? (
          <>
            <img
              src={dish.fotoUrl} alt={dish.nombre}
              onLoad={() => setImgLoaded(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s', display: 'block' }}
            />
            {!imgLoaded && <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 64, opacity: 0.5 }}>🍽</span>
          </div>
        )}
      </div>

      {/* Bottom: Content */}
      <div style={{ padding: '22px 24px 28px' }}>
        {/* Local + corazón — misma fila */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <a href={`/?q=${encodeURIComponent(dish.restaurante)}`} style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', minWidth: 0, overflow: 'hidden', flex: 1 }}>
              {dish.restauranteLogo && !logoError
                ? <img src={dish.restauranteLogo} alt="" onError={() => setLogoError(true)} style={{ width: 17, height: 17, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 17, height: 17, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', flexShrink: 0 }}>{dish.restaurante.charAt(0)}</div>
              }
              <span style={{ fontSize: 17, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-feed-display), serif' }}>{dish.restaurante}</span>
            </a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
            <button onClick={() => { setSaved(!saved); onSave(dish) }} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px 5px 9px', borderRadius: 20, cursor: 'pointer',
              background: saved ? (isDark ? 'rgba(244,166,35,0.15)' : 'rgba(244,166,35,0.1)') : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
              border: saved ? '1px solid rgba(244,166,35,0.4)' : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
              transition: 'all 0.15s',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? '#F4A623' : 'none'} stroke={saved ? '#F4A623' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'} strokeWidth="2.5" strokeLinecap="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: saved ? '#F4A623' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}>
                {saved ? 'Guardado' : 'Guardar'}
              </span>
            </button>
          </div>
        </div>

        {/* Name */}
        <h2 style={{
          fontFamily: 'var(--font-feed-display), serif',
          fontSize: 26, fontWeight: 700, color: isDark ? '#fff' : '#111', margin: '-2px 0 6px', lineHeight: 1.25,
          paddingRight: 135,
        }}>
          <DishNameWithTag dish={dish} showDietTooltip={showDietTooltip} setShowDietTooltip={setShowDietTooltip} showSpicyTooltip={showSpicyTooltip} setShowSpicyTooltip={setShowSpicyTooltip} />
        </h2>

        {/* Price */}
        {dish.precio > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {dish.enOferta && dish.precioDescuento != null ? (
              <>
                <span style={{ fontSize: 21, fontWeight: 700, color: '#4ade80' }}>${dish.precioDescuento.toLocaleString('es-CL')}</span>
                <span style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', textDecoration: 'line-through' }}>${dish.precio.toLocaleString('es-CL')}</span>
              </>
            ) : (
              <span style={{ fontSize: 20, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)' }}>${dish.precio.toLocaleString('es-CL')}</span>
            )}
            <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
              <span onClick={() => setShowPriceTooltip(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`, fontSize: 9, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', cursor: 'pointer', lineHeight: 1 }}>i</span>
              {showPriceTooltip && (
                <span onClick={() => setShowPriceTooltip(false)} style={{ position: 'absolute', bottom: 22, left: 0, background: isDark ? '#2a2a2a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.18)', zIndex: 10 }}>
                  Los precios pueden variar, consulta directamente al local
                </span>
              )}
            </span>
          </div>
        )}

        {/* Description */}
        {dish.descripcion && (
          <p style={{ fontSize: 16, color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)', lineHeight: 1.6, margin: '0 0 28px' }}>
            {dish.descripcion}
          </p>
        )}

        {/* Restaurant */}
        {(() => {
          const mapsUrl = dish.googleMapsUrl
            ? dish.googleMapsUrl
            : dish.restauranteLat && dish.restauranteLng
              ? `https://maps.google.com/?q=${dish.restauranteLat},${dish.restauranteLng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((dish.restauranteDireccion ?? '') + ' ' + dish.restaurante)}`
          return (
            <div style={{ marginBottom: 32 }}>
              {/* Info ficha */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px 12px',
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.09)'}`,
                borderRadius: '12px 12px 0 0', boxSizing: 'border-box',
              }}>
                {dish.restauranteLogo && !logoError ? (
                  <img src={dish.restauranteLogo} alt="" onError={() => setLogoError(true)}
                    style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, marginTop: 2, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)', fontSize: 13, fontWeight: 700 }}>
                    {dish.restaurante.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#fff' : '#111', margin: 0 }}>{dish.restaurante}</p>
                  {dish.restauranteDireccion && (
                    <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const parts = dish.restauranteDireccion.split(',').map(p => p.trim().replace(/^\d{4,7}\s*/, '')).filter(p => p && !/^\d+$/.test(p) && p !== 'Chile' && p !== 'Región Metropolitana' && p !== 'Region Metropolitana').slice(0, 3)
                        if (parts.length === 3) [parts[1], parts[2]] = [parts[2], parts[1]]
                        return parts.join(', ')
                      })()}
                    </p>
                  )}
                  {dish.restaurantePhone && (
                    <a href={`tel:${dish.restaurantePhone}`} onClick={e => e.stopPropagation()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 13, color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', textDecoration: 'none' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      {dish.restaurantePhone}
                    </a>
                  )}
                </div>
              </div>

              {/* Botón Ir a Maps */}
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 16px', boxSizing: 'border-box', marginBottom: 12,
                  background: isDark ? 'rgba(244,166,35,0.13)' : 'rgba(244,166,35,0.08)',
                  border: `1.5px solid ${isDark ? 'rgba(244,166,35,0.5)' : 'rgba(244,166,35,0.4)'}`,
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px',
                  textDecoration: 'none',
                }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#EA4335" stroke="none"/>
                  <circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/>
                </svg>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: isDark ? '#F4A623' : '#c97d00' }}>
                    Cómo llegar
                  </span>
                  {dish.restauranteDireccion && (() => {
                    const parts = dish.restauranteDireccion.split(',').map((p: string) => p.trim().replace(/^\d{4,7}\s*/, '')).filter((p: string) => p && !/^\d+$/.test(p) && p !== 'Chile' && p !== 'Región Metropolitana' && p !== 'Region Metropolitana').slice(0, 3)
                    if (parts.length === 3) [parts[1], parts[2]] = [parts[2], parts[1]]
                    return <span style={{ display: 'block', fontSize: 14, fontWeight: 400, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parts.join(', ')}</span>
                  })()}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  {dist != null && <span style={{ fontSize: 14, fontWeight: 400, color: isDark ? 'rgba(244,166,35,0.7)' : '#c97d00', opacity: 0.85 }}>A {formatDistance(dist)}</span>}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(244,166,35,0.8)' : '#c97d00'} strokeWidth="2.2" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </a>
              {/* Botón Pedir online / Ver carta online / Ver página web / Ver Instagram… */}
              {(() => {
                const info = getOrderInfo(dish.restauranteWebsite, dish.restauranteWebsiteIsOrderUrl)
                  ?? (dish.restauranteInstagram ? { url: dish.restauranteInstagram, type: 'social' as const, socialName: 'Instagram' }
                  : dish.isShowcase ? null
                  : { url: `https://quierocomer.cl/qr/${dish.restauranteSlug}`, type: 'menu' as const })
                if (!info) return null
                const label = info.type === 'delivery' ? 'Pedir online' : info.type === 'menu' ? 'Ver carta online' : info.type === 'social' ? `Ver ${info.socialName}` : 'Ver página web'
                const accent = info.type === 'delivery'
                  ? (isDark ? 'rgba(34,197,94,0.9)' : '#16a34a')
                  : info.type === 'menu'
                    ? (isDark ? 'rgba(251,146,60,0.9)' : '#ea6c0a')
                    : info.type === 'social'
                      ? (isDark ? 'rgba(192,132,252,0.9)' : '#9333ea')
                      : (isDark ? 'rgba(96,165,250,0.9)' : '#2563eb')
                const accentBg = info.type === 'delivery'
                  ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)')
                  : info.type === 'menu'
                    ? (isDark ? 'rgba(251,146,60,0.12)' : 'rgba(251,146,60,0.08)')
                    : info.type === 'social'
                      ? (isDark ? 'rgba(192,132,252,0.12)' : 'rgba(147,51,234,0.08)')
                      : (isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)')
                const accentBorder = info.type === 'delivery'
                  ? (isDark ? 'rgba(34,197,94,0.45)' : 'rgba(34,197,94,0.4)')
                  : info.type === 'menu'
                    ? (isDark ? 'rgba(251,146,60,0.45)' : 'rgba(251,146,60,0.4)')
                    : info.type === 'social'
                      ? (isDark ? 'rgba(192,132,252,0.45)' : 'rgba(147,51,234,0.35)')
                      : (isDark ? 'rgba(59,130,246,0.45)' : 'rgba(59,130,246,0.35)')
                return (
                  <a href={info.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '12px 16px', boxSizing: 'border-box', marginTop: 8,
                      background: accentBg, border: `1.5px solid ${accentBorder}`,
                      borderRadius: 12, textDecoration: 'none',
                    }}>
                    {info.type === 'delivery' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                      </svg>
                    ) : info.type === 'menu' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M4 6h16M4 10h16M4 14h10"/>
                        <rect x="2" y="3" width="20" height="18" rx="2"/>
                      </svg>
                    ) : info.type === 'social' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M2 12h20"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: accent }}>{label}</span>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 400, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{new URL(info.url).hostname.replace(/^www\./, '')}</span>
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </a>
                )
              })()}
            </div>
          )
        })()}


        {/* Related dishes */}
        {!hideRelated && relatedDishes.length > 0 && (
          <div style={{ paddingTop: 28, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', margin: '0 0 10px' }}>También te podría gustar</p>
            <div style={{ margin: '0 -24px', padding: '0 10px' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1].map(col => (
                  <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {relatedDishes.filter((_, i) => i % 2 === col).map(d => (
                      <DishCard key={d.id} dish={d} onTap={onDishTap} userLocation={userLocation} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ── Mobile: individual dish slide ── */
function DishSlide({
  dish, index, isActive, onClose, onSave, onDishTap, onCategoryClick,
  allDishes, dishPool, profile, hideRelated, userLocation, isDark, initialSaved,
}: {
  dish: FeedDish; index: number; isActive: boolean;
  onClose: () => void; onSave: (d: FeedDish) => void; onDishTap: (d: FeedDish) => void;
  onCategoryClick?: (category: string) => void;
  allDishes: FeedDish[]; dishPool?: FeedDish[]; profile: FeedProfile; hideRelated?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  isDark?: boolean; initialSaved?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved ?? false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [showDietTooltip, setShowDietTooltip] = useState(false)
  const [showSpicyTooltip, setShowSpicyTooltip] = useState(false)
  const [showPriceTooltip, setShowPriceTooltip] = useState(false)
  const [resolvedPhone, setResolvedPhone] = useState<string | null>(dish.restaurantePhone ?? null)

  useEffect(() => {
    setResolvedPhone(dish.restaurantePhone ?? null)
    if (dish.restaurantePhone || !dish.restaurantePlaceId) return
    fetch(`/api/place-phone?placeId=${encodeURIComponent(dish.restaurantePlaceId)}`)
      .then(r => r.json()).then(d => { if (d.phone) setResolvedPhone(d.phone) }).catch(() => {})
  }, [dish.id, dish.restaurantePhone, dish.restaurantePlaceId])

  const [visibleRelated, setVisibleRelated] = useState(10)
  const slideRef = useRef<HTMLDivElement>(null)
  const pullY = useRef<number | null>(null)
  const gradient = getCategoryGradient(dish.categoriaNorm)

  const dist = userLocation && dish.restauranteLat && dish.restauranteLng
    ? distanceKm(userLocation.lat, userLocation.lng, dish.restauranteLat, dish.restauranteLng) : null

  // Related dishes
  const [embeddingSimilarIds, setEmbeddingSimilarIds] = useState<string[] | null>(null)
  useEffect(() => {
    if (!isActive || hideRelated) return
    getSimilarDishIds(dish.id).then(ids => {
      if (ids.length > 0) setEmbeddingSimilarIds(ids)
    }).catch(() => {})
  }, [dish.id, isActive, hideRelated])

  const relatedDishes = useMemo(() => {
    if (hideRelated) return []
    const rawPool = dishPool && dishPool.length > 0 ? dishPool : allDishes
    const seenPoolIds = new Set<string>()
    const pool = rawPool.filter(d => { if (seenPoolIds.has(d.id)) return false; seenPoolIds.add(d.id); return true })
    const candidates = pool.filter(d => d.fotoUrl && d.id !== dish.id && d.restauranteId !== dish.restauranteId)
    const embRank = new Map<string, number>()
    if (embeddingSimilarIds) {
      embeddingSimilarIds.forEach((id, i) => embRank.set(id, 1 - i / embeddingSimilarIds.length))
    }
    const thisKws = new Set(extractKeywords(dish.nombre, dish.descripcion))
    const thisTxTypes = new Set(dish.txDishType ?? [])
    const scored = candidates.map(d => {
      let relevance = embRank.get(d.id) ? (embRank.get(d.id)! * 10) : 0
      const sharedTypes = (d.txDishType ?? []).filter(t => thisTxTypes.has(t))
      relevance += sharedTypes.length * 8
      if (dish.cuisineTag && d.cuisineTag === dish.cuisineTag) relevance += 5
      if (d.categoriaNorm === dish.categoriaNorm) relevance += 4
      if (dish.categoriaParent && d.categoriaParent === dish.categoriaParent) relevance += 2
      const dKws = extractKeywords(d.nombre, d.descripcion)
      for (const kw of dKws) { if (thisKws.has(kw)) relevance += 2 }
      const dist = userLocation && d.restauranteLat && d.restauranteLng
        ? distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat, d.restauranteLng)
        : null
      return { dish: d, relevance, dist }
    })

    const relevant = scored.filter(x => x.relevance > 0)
    const pool2 = relevant.length >= 4 ? relevant : scored

    const sorted = pool2.sort((a, b) => {
      const distA = a.dist ?? 999
      const distB = b.dist ?? 999
      const scoreA = a.relevance * 5 - distA * 0.3
      const scoreB = b.relevance * 5 - distB * 0.3
      return scoreB - scoreA
    })

    const perLocal = new Map<string, number>()
    const seenIds = new Set<string>()
    const result: FeedDish[] = []
    for (const x of sorted) {
      if (seenIds.has(x.dish.id)) continue
      const count = perLocal.get(x.dish.restauranteId) ?? 0
      if (count >= 2) continue
      seenIds.add(x.dish.id)
      perLocal.set(x.dish.restauranteId, count + 1)
      result.push(x.dish)
      if (result.length >= 20) break
    }
    return result
  }, [dish, allDishes, dishPool, embeddingSimilarIds, hideRelated, userLocation])

  // Infinite scroll for related dishes inside slide
  useEffect(() => {
    const el = slideRef.current
    if (!el) return
    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 600 && visibleRelated < relatedDishes.length) {
        setVisibleRelated(prev => Math.min(prev + 10, relatedDishes.length))
      }
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [visibleRelated, relatedDishes.length])

  return (
    <div
      ref={slideRef}
      data-slide={index}
      onTouchStart={e => { pullY.current = e.touches[0].clientY }}
      onTouchEnd={e => {
        if (pullY.current === null) return
        const dy = e.changedTouches[0].clientY - pullY.current
        pullY.current = null
        if (slideRef.current && slideRef.current.scrollTop <= 0 && dy > 100) onClose()
      }}
      style={{
        flex: '0 0 100%', width: '100vw', minHeight: '100%',
        scrollSnapAlign: 'start', scrollSnapStop: 'always',
        overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none',
        background: isDark ? '#0e0e0e' : '#fff',
      }}
    >
      {/* Photo — big hero */}
      <div style={{ position: 'relative', width: '100%', height: 'min(55vh, 420px)', overflow: 'hidden' }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'fixed', top: 14, right: 14, zIndex: 130,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(0,0,0,0.18)', border: 'none',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff',
        }}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13" />
            <line x1="13" y1="1" x2="1" y2="13" />
          </svg>
        </button>
        {dish.fotoUrl ? (
          <>
            <img src={dish.fotoUrl} alt={dish.nombre}
              onLoad={() => setImgLoaded(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }} />
            {!imgLoaded && <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 48, opacity: 0.5 }}>🍽</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px 20px' }}>
        {/* Local + corazón — misma fila */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <a href={`/?q=${encodeURIComponent(dish.restaurante)}`} style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', minWidth: 0, overflow: 'hidden', flex: 1 }}>
              {dish.restauranteLogo && !logoError
                ? <img src={dish.restauranteLogo} alt="" onError={() => setLogoError(true)} style={{ width: 17, height: 17, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 17, height: 17, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', flexShrink: 0 }}>{dish.restaurante.charAt(0)}</div>
              }
              <span style={{ fontSize: 17, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-feed-display), serif' }}>{dish.restaurante}</span>
            </a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
            <button onClick={() => { setSaved(!saved); onSave(dish) }} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px 5px 9px', borderRadius: 20, cursor: 'pointer',
              background: saved ? (isDark ? 'rgba(244,166,35,0.15)' : 'rgba(244,166,35,0.1)') : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
              border: saved ? '1px solid rgba(244,166,35,0.4)' : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
              transition: 'all 0.15s',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? '#F4A623' : 'none'} stroke={saved ? '#F4A623' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'} strokeWidth="2.5" strokeLinecap="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: saved ? '#F4A623' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}>
                {saved ? 'Guardado' : 'Guardar'}
              </span>
            </button>
          </div>
        </div>

        {/* Name */}
        <h2 style={{
          fontFamily: 'var(--font-feed-display), serif',
          fontSize: 24, fontWeight: 700, color: isDark ? '#fff' : '#111', margin: '-2px 0 6px', lineHeight: 1.25,
          paddingRight: 120,
        }}>
          <DishNameWithTag dish={dish} showDietTooltip={showDietTooltip} setShowDietTooltip={setShowDietTooltip} showSpicyTooltip={showSpicyTooltip} setShowSpicyTooltip={setShowSpicyTooltip} />
        </h2>

        {/* Price */}
        {dish.precio > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {dish.enOferta && dish.precioDescuento != null ? (
              <>
                <span style={{ fontSize: 19, fontWeight: 700, color: '#4ade80' }}>${dish.precioDescuento.toLocaleString('es-CL')}</span>
                <span style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', textDecoration: 'line-through' }}>${dish.precio.toLocaleString('es-CL')}</span>
              </>
            ) : (
              <span style={{ fontSize: 18, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)' }}>${dish.precio.toLocaleString('es-CL')}</span>
            )}
            <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
              <span onClick={() => setShowPriceTooltip(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`, fontSize: 9, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', cursor: 'pointer', lineHeight: 1 }}>i</span>
              {showPriceTooltip && (
                <span onClick={() => setShowPriceTooltip(false)} style={{ position: 'absolute', bottom: 22, left: 0, background: isDark ? '#2a2a2a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.18)', zIndex: 10 }}>
                  Los precios pueden variar, consulta directamente al local
                </span>
              )}
            </span>
          </div>
        )}

        {/* Description */}
        {dish.descripcion && (
          <p style={{ fontSize: 17, color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)', lineHeight: 1.6, margin: '0 0 26px' }}>
            {dish.descripcion}
          </p>
        )}

        {/* Botones locales */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32, marginTop: 10 }}>
          <a
            href={dish.googleMapsUrl ?? (dish.restauranteLat && dish.restauranteLng ? `https://maps.google.com/?q=${dish.restauranteLat},${dish.restauranteLng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((dish.restauranteDireccion ? dish.restauranteDireccion + ' ' : '') + dish.restaurante)}`)}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              flex: 1, padding: '12px 18px', borderRadius: 12,
              background: isDark ? 'rgba(244,166,35,0.13)' : 'rgba(244,166,35,0.08)',
              border: `1.5px solid ${isDark ? 'rgba(244,166,35,0.5)' : 'rgba(244,166,35,0.4)'}`,
              textDecoration: 'none',
            }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#EA4335" stroke="none"/>
              <circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/>
            </svg>
            <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#F4A623' : '#c97d00', whiteSpace: 'nowrap' }}>Cómo llegar</span>
              {dish.restauranteDireccion && (() => {
                const parts = dish.restauranteDireccion.split(',').map((p: string) => p.trim().replace(/^\d{4,7}\s*/, '')).filter((p: string) => p && !/^\d+$/.test(p) && p !== 'Chile' && p !== 'Región Metropolitana' && p !== 'Region Metropolitana').slice(0, 3)
                if (parts.length === 3) [parts[1], parts[2]] = [parts[2], parts[1]]
                return <span style={{ fontSize: 14, fontWeight: 400, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{parts.join(', ')}</span>
              })()}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              {dist != null && <span style={{ fontSize: 14, fontWeight: 400, color: isDark ? 'rgba(244,166,35,0.7)' : '#c97d00', opacity: 0.85 }}>A {formatDistance(dist)}</span>}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(244,166,35,0.8)' : '#c97d00'} strokeWidth="2.2" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </span>
          </a>
          {resolvedPhone && (
            <a href={`tel:${resolvedPhone}`} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              flex: 1, padding: '12px 18px', borderRadius: 12,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
              textDecoration: 'none',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', whiteSpace: 'nowrap' }}>Llamar</span>
                <span style={{ fontSize: 14, fontWeight: 400, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resolvedPhone}</span>
              </span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'} strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </a>
          )}
          {(() => {
            const info = getOrderInfo(dish.restauranteWebsite, dish.restauranteWebsiteIsOrderUrl)
              ?? (dish.restauranteInstagram ? { url: dish.restauranteInstagram, type: 'social' as const, socialName: 'Instagram' }
                  : dish.isShowcase ? null
                  : { url: `https://quierocomer.cl/qr/${dish.restauranteSlug}`, type: 'menu' as const })
            if (!info) return null
            const label = info.type === 'delivery' ? 'Pedir online' : info.type === 'menu' ? 'Ver carta online' : info.type === 'social' ? `Ver ${info.socialName}` : 'Ver página web'
            const accent = info.type === 'delivery'
              ? (isDark ? 'rgba(34,197,94,0.9)' : '#16a34a')
              : info.type === 'menu'
                ? (isDark ? 'rgba(251,146,60,0.9)' : '#ea6c0a')
                : info.type === 'social'
                  ? (isDark ? 'rgba(192,132,252,0.9)' : '#9333ea')
                  : (isDark ? 'rgba(96,165,250,0.9)' : '#2563eb')
            const accentBg = info.type === 'delivery'
              ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)')
              : info.type === 'menu'
                ? (isDark ? 'rgba(251,146,60,0.12)' : 'rgba(251,146,60,0.08)')
                : info.type === 'social'
                  ? (isDark ? 'rgba(192,132,252,0.12)' : 'rgba(147,51,234,0.08)')
                  : (isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)')
            const accentBorder = info.type === 'delivery'
              ? (isDark ? 'rgba(34,197,94,0.45)' : 'rgba(34,197,94,0.4)')
              : info.type === 'menu'
                ? (isDark ? 'rgba(251,146,60,0.45)' : 'rgba(251,146,60,0.4)')
                : info.type === 'social'
                  ? (isDark ? 'rgba(192,132,252,0.45)' : 'rgba(147,51,234,0.35)')
                  : (isDark ? 'rgba(59,130,246,0.45)' : 'rgba(59,130,246,0.35)')
            return (
              <a href={info.url} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 18px', borderRadius: 12, marginTop: 2,
                  background: accentBg, border: `1.5px solid ${accentBorder}`,
                  textDecoration: 'none', boxSizing: 'border-box',
                }}>
                {info.type === 'delivery' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                ) : info.type === 'menu' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M4 6h16M4 10h16M4 14h10"/>
                    <rect x="2" y="3" width="20" height="18" rx="2"/>
                  </svg>
                ) : info.type === 'social' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M2 12h20"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                )}
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: accent }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 400, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{new URL(info.url).hostname.replace(/^www\./, '')}</span>
                </span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </a>
            )
          })()}
        </div>

        {/* Related dishes */}
        {!hideRelated && relatedDishes.length > 0 && (
          <div style={{ paddingTop: 28, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', margin: '0 0 12px' }}>También te podría gustar</p>
            <div style={{ margin: '0 -20px', padding: '0 10px' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1].map(col => (
                  <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {relatedDishes.slice(0, visibleRelated).filter((_, i) => i % 2 === col).map(d => (
                      <DishCard key={d.id} dish={d} onTap={onDishTap} userLocation={userLocation} />
                    ))}
                  </div>
                ))}
              </div>
              {visibleRelated < relatedDishes.length && (
                <div style={{ display: 'flex', gap: 10, paddingTop: 10 }}>
                  {[0, 1].map(col => (
                    <div key={col} style={{ flex: 1 }}>
                      <div className="skeleton-shimmer" style={{ aspectRatio: '3/4', borderRadius: 14 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Diet tag pegado a la última palabra del nombre ── */
function DishNameWithTag({ dish, showDietTooltip, setShowDietTooltip, showSpicyTooltip, setShowSpicyTooltip }: {
  dish: FeedDish
  showDietTooltip: boolean
  setShowDietTooltip: React.Dispatch<React.SetStateAction<boolean>>
  showSpicyTooltip: boolean
  setShowSpicyTooltip: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const hasDiet = dish.dieta.tipo === 'VEGAN' || dish.dieta.tipo === 'VEGETARIAN'
  const hasSpicy = dish.dieta.esPicante
  if (!hasDiet && !hasSpicy) return <>{dish.nombre}</>

  const words = dish.nombre.trim().split(' ')
  const head = words.slice(0, -1).join(' ')
  const tail = words[words.length - 1]

  const dietIcon = hasDiet ? (dish.dieta.tipo === 'VEGAN'
    ? <VeganIcon size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />
    : <VegetarianIcon size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />
  ) : null

  const dietLabel = dish.dieta.tipo === 'VEGAN' ? 'Vegano' : 'Vegetariano'

  return (
    <>
      {head && <>{head} </>}
      <span style={{ whiteSpace: 'nowrap' }}>
        {tail}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, verticalAlign: 'middle' }}>
          {hasDiet && (
            <span
              onClick={e => { e.stopPropagation(); setShowDietTooltip(v => !v); setTimeout(() => setShowDietTooltip(false), 2000) }}
              style={{ position: 'relative', cursor: 'pointer', display: 'inline-flex' }}
            >
              {dietIcon}
              {showDietTooltip && (
                <span style={{
                  position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
                  background: '#1b5e20', color: '#fff', fontSize: 12, fontWeight: 600,
                  padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                }}>
                  {dietLabel}
                </span>
              )}
            </span>
          )}
          {hasSpicy && (
            <span
              onClick={e => { e.stopPropagation(); setShowSpicyTooltip(v => !v); setTimeout(() => setShowSpicyTooltip(false), 2000) }}
              style={{ position: 'relative', cursor: 'pointer', display: 'inline-flex' }}
            >
              <SpicyIcon size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />
              {showSpicyTooltip && (
                <span style={{
                  position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
                  background: '#c62828', color: '#fff', fontSize: 12, fontWeight: 600,
                  padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                }}>
                  Picante
                </span>
              )}
            </span>
          )}
        </span>
      </span>
    </>
  )
}
