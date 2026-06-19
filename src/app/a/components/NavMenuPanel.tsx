'use client'

/**
 * Shared slide-from-right hamburger menu panel.
 * Used in home (NewHome.tsx) and /descubrir (DescubrirClient.tsx).
 * Cualquier cambio aquí se refleja en ambos.
 */
export default function NavMenuPanel({
  isOpen,
  onClose,
  isDark,
  onToggleTheme,
  onInicio,
  onPerfil,
  onContacto,
  activeView,
}: {
  isOpen: boolean
  onClose: () => void
  isDark: boolean
  onToggleTheme: () => void
  onInicio: () => void
  onPerfil: () => void
  onContacto: () => void
  activeView?: 'feed' | 'perfil' | 'contacto' | string
}) {
  if (!isOpen) return null

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 10px', borderRadius: 9,
    color: active ? '#F4A623' : (isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.72)'),
    fontSize: 15, fontWeight: active ? 600 : 400,
    background: active ? (isDark ? 'rgba(244,166,35,0.1)' : 'rgba(244,166,35,0.07)') : 'transparent',
    border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
    textDecoration: 'none',
  })

  const iconOpacity = (active: boolean) => ({ flexShrink: 0, opacity: active ? 1 : 0.5 } as React.CSSProperties)

  const divider = (
    <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', margin: '3px 4px' }} />
  )

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 55,
        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 56,
        width: 270, maxWidth: '88vw',
        background: isDark ? '#111' : '#fafafa',
        borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
        animation: 'slideRight 0.25s ease-out',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 16px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <span style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 19, fontWeight: 700, color: isDark ? '#fff' : '#111', letterSpacing: '-0.3px' }}>
            Quiero<span style={{ color: '#F4A623' }}>Comer</span>
          </span>
          <button onClick={onClose} style={{
            width: 28, height: 28, background: 'none', border: 'none',
            cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>

          {/* Inicio */}
          <button onClick={() => { onClose(); onInicio() }} style={itemStyle(activeView === 'feed')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconOpacity(activeView === 'feed')}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Inicio
          </button>

          {/* Mi perfil */}
          <button onClick={() => { onClose(); onPerfil() }} style={itemStyle(activeView === 'perfil')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconOpacity(activeView === 'perfil')}>
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            Mi perfil
          </button>

          {/* Publicar local */}
          <a href="/qr" target="_blank" rel="noopener noreferrer" onClick={onClose} style={itemStyle(false)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconOpacity(false)}>
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            Publicar local
          </a>

          {divider}

          {/* Contacto */}
          <button onClick={() => { onClose(); onContacto() }} style={itemStyle(activeView === 'contacto')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconOpacity(activeView === 'contacto')}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            Contacto
          </button>

        </nav>

        {/* Footer — theme switcher */}
        <div style={{ padding: '10px 16px 18px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Apariencia</p>
            <div style={{ display: 'flex', borderRadius: 9, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', padding: 3, gap: 2 }}>
              <button onClick={() => { if (isDark) onToggleTheme() }} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '6px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: !isDark ? '#fff' : 'transparent',
                boxShadow: !isDark ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: !isDark ? '#b45309' : (isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.3)'),
                fontSize: 13, fontWeight: !isDark ? 600 : 400, transition: 'all 0.15s',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                Claro
              </button>
              <button onClick={() => { if (!isDark) onToggleTheme() }} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '6px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: isDark ? 'rgba(255,255,255,0.1)' : 'transparent',
                boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                color: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.3)',
                fontSize: 13, fontWeight: isDark ? 600 : 400, transition: 'all 0.15s',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                Oscuro
              </button>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.18)', textAlign: 'center' }}>
            © 2025 QuieroComer · Santiago, Chile
          </p>
        </div>

      </div>
    </>
  )
}
