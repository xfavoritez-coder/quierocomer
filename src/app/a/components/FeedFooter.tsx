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
      {/* Lamp + Wordmark en fila */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img
          src="/genio-lamp.png"
          alt=""
          width={22}
          height={22}
          style={{ filter: 'grayscale(1)', opacity: isDark ? 0.3 : 0.25, objectFit: 'contain' }}
        />
        <span style={{
          fontFamily: 'var(--font-feed-display), serif',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '-0.3px',
          color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)',
        }}>
          Quiero<span style={{ color: '#F4A623' }}>Comer</span>
        </span>
      </div>

      {/* Tagline */}
      <p style={{
        fontSize: 14,
        fontWeight: 600,
        color: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.35)',
        margin: 0,
        textAlign: 'center',
        lineHeight: 1.4,
      }}>
        Descubre qué comer hoy
      </p>

      {/* Copyright */}
      <p style={{
        fontSize: 11,
        color: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.18)',
        margin: 0,
        textAlign: 'center',
      }}>
        © {new Date().getFullYear()} QuieroComer · Santiago de Chile
      </p>
    </footer>
  )
}
