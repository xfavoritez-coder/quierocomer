'use client'

export default function FeedFooter({ isDark }: { isDark?: boolean }) {
  return (
    <footer style={{
      marginTop: 48,
      padding: '32px 20px 40px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      {/* Plato SVG */}
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l19-9-9 19-2-8-8-2z"/>
      </svg>

      {/* Wordmark */}
      <span style={{
        fontFamily: 'var(--font-feed-display), serif',
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: '-0.3px',
        color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)',
      }}>
        Quiero<span style={{ color: '#F4A623' }}>Comer</span>
      </span>

      {/* Tagline */}
      <p style={{
        fontSize: 12,
        color: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.28)',
        margin: 0,
        textAlign: 'center',
        lineHeight: 1.5,
      }}>
        Descubre qué comer hoy
      </p>

      {/* Copyright */}
      <p style={{
        fontSize: 11,
        color: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.18)',
        margin: 0,
      }}>
        © {new Date().getFullYear()} QuieroComer
      </p>
    </footer>
  )
}
