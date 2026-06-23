'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

export type FilterBarFilters = {
  diet: 'all' | 'VEGAN' | 'VEGETARIAN'
  maxKm: number
  sort: 'default' | 'recent' | 'price-asc' | 'price-desc'
  meal: 'all' | 'desayuno' | 'almuerzo_cena'
  mealDisplay: 'all' | 'desayuno' | 'almuerzo' | 'cena'
  nearby: boolean
  popular: boolean
}

type Props = {
  isDark: boolean
  userLocation: { lat: number; lng: number } | null
  locationLabel: string | null
  filters: FilterBarFilters
  activeFilterCount?: number
  onLocationClick: () => void
  onFiltersChange: (f: FilterBarFilters) => void
  onResetFilters?: () => void
  // Optional features
  showMapButton?: boolean
  isMapActive?: boolean
  onMapToggle?: () => void
  showSortFilter?: boolean
  showMealFilter?: boolean
  showDistanceBadge?: boolean
  showLocationRow?: boolean
  applyLabel?: string
}

export default function FeedFilterBar({
  isDark,
  userLocation,
  locationLabel,
  filters,
  activeFilterCount = 0,
  onLocationClick,
  onFiltersChange,
  onResetFilters,
  showMapButton = false,
  isMapActive = false,
  onMapToggle,
  showSortFilter = true,
  showMealFilter = true,
  showDistanceBadge = true,
  showLocationRow = true,
  applyLabel = 'Aplicar',
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [showDistancePicker, setShowDistancePicker] = useState(false)
  const [draftDiet, setDraftDiet] = useState(filters.diet)
  const [draftMaxKm, setDraftMaxKm] = useState(filters.maxKm)
  const [draftSort, setDraftSort] = useState(filters.sort)
  const [draftMeal, setDraftMeal] = useState(filters.meal)
  const [draftMealDisplay, setDraftMealDisplay] = useState(filters.mealDisplay)
  const distanceBadgeRef = useRef<HTMLButtonElement>(null)

  const bg = isDark ? '#0e0e0e' : '#f5f4f1'

  function openFilters() {
    setDraftDiet(filters.diet)
    setDraftMaxKm(filters.maxKm)
    setDraftSort(filters.sort)
    setDraftMeal(filters.meal)
    setDraftMealDisplay(filters.mealDisplay)
    setFilterOpen(true)
  }

  type PillType = 'nearby' | 'popular' | 'green' | 'default'
  const pillActiveColor = (type: PillType) =>
    type === 'popular' ? '#D32F2F' : type === 'green' ? '#2E7D32' : '#c97d00'
  const pillStyle = (active: boolean, type: PillType = 'default') => {
    const ac = pillActiveColor(type)
    return {
      flex: 1, padding: '9px 4px', borderRadius: 999 as const, fontSize: 14, fontWeight: 500,
      cursor: 'pointer' as const, whiteSpace: 'nowrap' as const,
      textAlign: 'center' as const, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      background: active
        ? (type === 'popular' ? (isDark ? 'rgba(211,47,47,0.15)' : 'rgba(211,47,47,0.1)')
          : type === 'green' ? (isDark ? 'rgba(46,125,50,0.18)' : 'rgba(46,125,50,0.12)')
          : (isDark ? 'rgba(244,166,35,0.18)' : 'rgba(244,166,35,0.15)'))
        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
      border: `1px solid ${active
        ? (type === 'popular' ? 'rgba(211,47,47,0.45)' : type === 'green' ? 'rgba(46,125,50,0.4)' : 'rgba(244,166,35,0.5)')
        : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)')}`,
      color: active ? ac : (isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)'),
    }
  }

  function applyFilters() {
    onFiltersChange({
      ...filters,
      diet: draftDiet,
      maxKm: draftMaxKm,
      sort: draftSort,
      meal: draftMeal,
      mealDisplay: draftMealDisplay,
    })
    setFilterOpen(false)
  }

  function resetFilters() {
    setDraftDiet('all'); setDraftMaxKm(5); setDraftSort('default')
    setDraftMeal('all'); setDraftMealDisplay('all')
    if (onResetFilters) {
      onResetFilters()
    } else {
      onFiltersChange({ diet: 'all', maxKm: 5, sort: 'default', meal: 'all', mealDisplay: 'all', nearby: false, popular: false })
    }
    setFilterOpen(false)
  }

  return (
    <>
      {/* Row pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 8 }}>
        <button
          onClick={() => {
            if (!userLocation) { onLocationClick(); return }
            onFiltersChange({ ...filters, nearby: !filters.nearby })
          }}
          style={pillStyle(filters.nearby, 'nearby')}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          Cerca
        </button>
        <button onClick={() => onFiltersChange({ ...filters, popular: !filters.popular })} style={pillStyle(filters.popular, 'popular')}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
          </svg>
          Popular
        </button>
        <button
          onClick={() => onFiltersChange({ ...filters, diet: filters.diet !== 'all' ? 'all' : 'VEGETARIAN' })}
          style={pillStyle(filters.diet !== 'all', 'green')}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
          </svg>
          Veggie
        </button>
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <button onClick={openFilters} style={{ ...pillStyle(false, 'default'), width: '100%' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
            Filtros
          </button>
          {activeFilterCount > 0 && (
            <span style={{
              position: 'absolute', top: 1, right: -3, pointerEvents: 'none',
              background: '#F4A623', color: '#fff',
              borderRadius: 999, fontSize: 11, fontWeight: 700,
              minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px', lineHeight: 1, zIndex: 1,
            }}>{activeFilterCount}</span>
          )}
        </div>
        {showMapButton && (
          <button
            onClick={onMapToggle}
            style={{
              flexShrink: 0,
              width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isMapActive
                ? (isDark ? 'rgba(244,166,35,0.18)' : 'rgba(244,166,35,0.15)')
                : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
              color: isMapActive ? '#F4A623' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              outline: `1px solid ${isMapActive ? 'rgba(244,166,35,0.45)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')}`,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
          </button>
        )}
      </div>

      {/* Row ubicación */}
      {showLocationRow && <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <button onClick={onLocationClick} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: locationLabel ? '#e09200' : isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)',
          fontSize: 16, fontWeight: 400,
          flex: 1, minWidth: 0, overflow: 'hidden',
        }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {locationLabel || 'Selecciona una ubicación'}
          </span>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {userLocation && showDistanceBadge && (
          <div style={{ flexShrink: 0 }}>
            <button
              ref={distanceBadgeRef}
              type="button"
              onClick={() => setShowDistancePicker(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: isDark ? 'rgba(244,166,35,0.12)' : 'rgba(224,146,0,0.10)',
                border: `1px solid ${isDark ? 'rgba(244,166,35,0.25)' : 'rgba(224,146,0,0.25)'}`,
                borderRadius: 999, padding: '3px 10px',
                color: '#e09200', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {filters.maxKm >= 30 ? 'Todo' : `${filters.maxKm} km`}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>

            {showDistancePicker && typeof document !== 'undefined' && createPortal(
              (() => {
                const r = distanceBadgeRef.current?.getBoundingClientRect()
                if (!r) return null
                return (
                  <div
                    style={{
                      position: 'fixed', top: r.bottom + 6, right: window.innerWidth - r.right, zIndex: 99999,
                      background: isDark ? '#1a1a1a' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      borderRadius: 12, overflow: 'hidden',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 120,
                      fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
                    }}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Radio
                    </div>
                    {[1, 3, 5, 10, 20, 30].map(km => (
                      <button
                        key={km}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          onFiltersChange({ ...filters, maxKm: km })
                          setShowDistancePicker(false)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '9px 14px',
                          background: filters.maxKm === km || (km === 30 && filters.maxKm >= 30)
                            ? (isDark ? 'rgba(244,166,35,0.12)' : 'rgba(244,166,35,0.1)') : 'none',
                          border: 'none', cursor: 'pointer',
                          color: filters.maxKm === km || (km === 30 && filters.maxKm >= 30)
                            ? '#e09200' : isDark ? 'rgba(255,255,255,0.75)' : '#333',
                          fontSize: 14, fontWeight: filters.maxKm === km ? 600 : 400, textAlign: 'left',
                        }}
                      >
                        {km >= 30 ? 'Todo' : `${km} km`}
                        {(filters.maxKm === km || (km === 30 && filters.maxKm >= 30)) && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e09200" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                        )}
                      </button>
                    ))}
                  </div>
                )
              })(),
              document.body
            )}
          </div>
        )}
      </div>}

      {/* Filter panel modal — rendered via portal to avoid transform/overflow clipping */}
      {filterOpen && createPortal(
        <>
          <style>{`@keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }`}</style>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setFilterOpen(false)}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 81,
            maxHeight: 'min(88vh, calc(100dvh - 72px))',
            display: 'flex', flexDirection: 'column',
            background: isDark ? '#1a1a1a' : '#fff',
            borderRadius: '24px 24px 0 0',
            animation: 'slideUp 0.25s ease-out',
            overflow: 'hidden',
          }}>
            <button onClick={() => setFilterOpen(false)} style={{
              position: 'absolute', top: 14, right: 16, zIndex: 2,
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              border: 'none', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
              fontSize: 22, lineHeight: 1, cursor: 'pointer', borderRadius: '50%',
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>

            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 16px calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
              <div style={{ width: 40, height: 5, background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)', borderRadius: 999, margin: '0 auto 16px' }} />
              <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-feed-display), serif', color: isDark ? '#fff' : '#111' }}>Filtros</h2>

              {/* Dieta */}
              <div style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Dieta
                </h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'all' as const, label: 'Como de todo', activeColor: '#c97d00', activeBg: 'rgba(244,166,35,0.07)', activeBorder: '#F4A623',
                      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg> },
                    { id: 'VEGETARIAN' as const, label: 'Veggie', activeColor: '#2E7D32', activeBg: 'rgba(46,125,50,0.08)', activeBorder: 'rgba(46,125,50,0.5)',
                      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg> },
                    { id: 'VEGAN' as const, label: 'Vegano', activeColor: '#2E7D32', activeBg: 'rgba(46,125,50,0.08)', activeBorder: 'rgba(46,125,50,0.5)',
                      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V11"/><path d="M12 11a6 6 0 0 0-6-6c0 3.31 2.69 6 6 6z"/><path d="M12 11a6 6 0 0 1 6-6c0 3.31-2.69 6-6 6z"/><path d="M12 17a5 5 0 0 0-5-5c0 2.76 2.24 5 5 5z"/><path d="M12 17a5 5 0 0 1 5-5c0 2.76-2.24 5-5 5z"/></svg> },
                  ].map(d => (
                    <button key={d.id} onClick={() => setDraftDiet(d.id)} style={{
                      border: draftDiet === d.id ? `1.5px solid ${d.activeBorder}` : `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: 14, padding: '10px 16px',
                      display: 'flex', alignItems: 'center', gap: 7,
                      background: draftDiet === d.id ? d.activeBg : isDark ? '#2a2a2a' : '#fff',
                      color: draftDiet === d.id ? d.activeColor : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                      fontSize: 13, whiteSpace: 'nowrap', cursor: 'pointer',
                    }}>
                      {d.icon} {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Distancia */}
              <div style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Distancia
                </h3>
                <div style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 14, padding: '16px 14px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                  <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: isDark ? '#fff' : '#111' }}>
                    Hasta <strong style={{ color: '#F4A623', marginLeft: 4 }}>{draftMaxKm} km</strong>
                  </p>
                  <div style={{ position: 'relative', height: 5, background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)', borderRadius: 999 }}>
                    <div style={{ width: `${(draftMaxKm / 30) * 100}%`, height: '100%', background: '#F4A623', borderRadius: 999 }} />
                    <div style={{ position: 'absolute', left: `${(draftMaxKm / 30) * 100}%`, top: '50%', width: 22, height: 22, background: '#F4A623', borderRadius: 999, transform: 'translate(-50%, -50%)', boxShadow: '0 1px 4px rgba(244,166,35,0.4)' }} />
                  </div>
                  <input type="range" min={1} max={30} value={draftMaxKm}
                    onChange={e => setDraftMaxKm(Number(e.target.value))}
                    style={{ width: '100%', height: 22, appearance: 'none', background: 'transparent', cursor: 'pointer', position: 'relative', marginTop: -12, opacity: 0 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)', fontSize: 11, marginTop: 4 }}>
                    <span>1 km</span><span>10 km</span><span>20 km</span><span>30 km</span>
                  </div>
                </div>
              </div>

              {showSortFilter && (
                <div style={{ marginBottom: 22 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Ordenar por
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { id: 'recent' as const, label: 'Últimos agregados' },
                      { id: 'price-asc' as const, label: 'Precio ↑' },
                      { id: 'price-desc' as const, label: 'Precio ↓' },
                    ].map(s => (
                      <button key={s.id} onClick={() => setDraftSort(draftSort === s.id ? 'default' : s.id)} style={{
                        border: draftSort === s.id ? '1.5px solid #F4A623' : `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
                        borderRadius: 14, padding: '10px 16px',
                        background: draftSort === s.id ? 'rgba(244,166,35,0.07)' : isDark ? '#2a2a2a' : '#fff',
                        color: draftSort === s.id ? '#c97d00' : isDark ? 'rgba(255,255,255,0.7)' : '#111',
                        fontSize: 13, cursor: 'pointer',
                      }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showMealFilter && (
                <div style={{ marginBottom: 22 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Momento
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {[
                      { display: 'all' as const, meal: 'all' as const, label: 'Todo el día', activeColor: '#F4A623',
                        icon: (c: string) => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                      { display: 'desayuno' as const, meal: 'desayuno' as const, label: 'Desayuno', activeColor: '#f59e0b',
                        icon: (c: string) => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/></svg> },
                      { display: 'almuerzo' as const, meal: 'almuerzo_cena' as const, label: 'Almuerzo', activeColor: '#f97316',
                        icon: (c: string) => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg> },
                      { display: 'cena' as const, meal: 'almuerzo_cena' as const, label: 'Cena', activeColor: '#6366f1',
                        icon: (c: string) => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
                    ].map((m, i) => {
                      const isActive = draftMealDisplay === m.display
                      const iconColor = isActive ? m.activeColor : isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)'
                      return (
                        <button key={i} onClick={() => { setDraftMeal(m.meal); setDraftMealDisplay(m.display) }} style={{
                          minHeight: 68, borderRadius: 12,
                          border: isActive ? '1.5px solid #F4A623' : `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
                          background: isActive ? 'rgba(244,166,35,0.07)' : isDark ? '#2a2a2a' : '#fff',
                          color: isActive ? '#c97d00' : isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
                          fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6,
                          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}>
                          {m.icon(iconColor)}
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ height: 80 }} />
            </div>

            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
              padding: '12px 18px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              background: isDark ? 'linear-gradient(to top, #1a1a1a 60%, transparent)' : 'linear-gradient(to top, #fff 60%, transparent)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <button onClick={applyFilters} style={{
                width: '100%', height: 52, border: 'none', borderRadius: 16,
                background: '#F4A623', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}>
                {applyLabel}
              </button>
              <button onClick={resetFilters} style={{
                width: '100%', height: 40, border: 'none', borderRadius: 12,
                background: 'none', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>
                Limpiar filtros
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
