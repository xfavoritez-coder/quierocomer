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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <img
          src="/genio-lamp.png"
          alt=""
          width={30}
          height={30}
          style={{ filter: 'grayscale(1)', opacity: isDark ? 0.55 : 0.45, objectFit: 'contain' }}
        />
        <span style={{
          fontFamily: 'var(--font-feed-display), serif',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '-0.3px',
          color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)',
        }}>
          Quiero<span style={{ color: '#F4B962' }}>Comer</span>
        </span>
      </div>

      {/* Tagline */}
      <p style={{
        fontSize: 14,
        fontWeight: 600,
        color: isDark ? 'rgba(255,255,255,0.48)' : 'rgba(0,0,0,0.50)',
        margin: 0,
        textAlign: 'center',
        lineHeight: 1.4,
      }}>
        descubre que comer cerca de ti
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
