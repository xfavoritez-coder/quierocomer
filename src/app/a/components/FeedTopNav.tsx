'use client'

import { useRef, forwardRef } from 'react'

type Props = {
  isDark: boolean
  searchValue: string
  onSearchChange: (v: string) => void
  onSearchSubmit?: () => void
  onSearchClear: () => void
  onLogoClick: () => void
  onMenuOpen: () => void
  onSearchFocus?: () => void
  onSearchBlur?: () => void
  placeholder?: string
  suggestionsOpen?: boolean // ajusta border-radius del input
  children?: React.ReactNode // dropdown de sugerencias (portal u otro)
}

const FeedTopNav = forwardRef<HTMLInputElement, Props>(function FeedTopNav(
  {
    isDark,
    searchValue,
    onSearchChange,
    onSearchSubmit,
    onSearchClear,
    onLogoClick,
    onMenuOpen,
    onSearchFocus,
    onSearchBlur,
    placeholder = 'Buscar en QuieroComer',
    suggestionsOpen = false,
    children,
  },
  ref,
) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, marginTop: 12 }}>
      {/* Logo */}
      <a
        href="/"
        onClick={e => { e.preventDefault(); onLogoClick() }}
        style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}
      >
        <img src="/logo.png" alt="QuieroComer" style={{ height: 55, width: 'auto' }} />
      </a>

      {/* Search */}
      <form
        style={{ position: 'relative', flex: 1 }}
        onSubmit={e => { e.preventDefault(); onSearchSubmit?.() }}
      >
        <input
          ref={ref}
          className="feed-search-input"
          type="text"
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '12px 20px 12px 24px',
            fontSize: 17,
            borderRadius: suggestionsOpen ? '20px 20px 0 0' : 999,
            background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
            border: isDark ? '1px solid rgba(255,255,255,0.10)' : '2px solid rgba(0,0,0,0.07)',
            color: isDark ? '#fff' : '#111',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {searchValue && (
          <button
            type="button"
            onClick={onSearchClear}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', zIndex: 38,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        {children}
      </form>

      {/* Hamburger */}
      <button
        onClick={onMenuOpen}
        style={{
          flexShrink: 0, border: 'none', cursor: 'pointer', padding: 0,
          width: 49, height: 49, borderRadius: '50%',
          background: isDark ? 'rgba(255,255,255,0.10)' : '#fff',
          boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
          color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </div>
  )
})

export default FeedTopNav
