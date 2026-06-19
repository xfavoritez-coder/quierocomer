'use client'

export default function FeedFooter({ isDark }: { isDark?: boolean }) {
  return (
    <footer style={{
      marginTop: 48,
      padding: '28px 20px 36px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
    }}>
      <img
        src="/logo.png"
        alt=""
        style={{
          height: 26,
          opacity: isDark ? 0.22 : 0.18,
          filter: isDark ? 'brightness(2) grayscale(1)' : 'grayscale(1)',
          objectFit: 'contain',
          marginBottom: 4,
        }}
      />
      <span style={{
        fontFamily: 'var(--font-feed-display), serif',
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: '-0.2px',
        color: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)',
      }}>
        QuieroComer
      </span>
      <p style={{
        fontSize: 11,
        color: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.16)',
        margin: 0,
        textAlign: 'center',
      }}>
        2026 · Santiago de Chile
      </p>
    </footer>
  )
}
