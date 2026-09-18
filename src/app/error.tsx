'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'grid',
      placeItems: 'center',
      background: '#fbfaf7',
      fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ width: 'min(100%, 520px)', minHeight: '100dvh', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', textAlign: 'center', transform: 'translateY(-5vh)' }}>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 44 }}>
            {([0, 150, 300] as number[]).map((delay, i) => (
              <span
                key={i}
                style={{
                  width: 13, height: 13, borderRadius: '50%',
                  background: i === 1 ? '#f7a719' : '#f8d79d',
                  display: 'inline-block',
                  animation: `qc-pulse 1.15s ease-in-out ${delay}ms infinite`,
                }}
              />
            ))}
          </div>

          <style>{`
            @keyframes qc-pulse {
              0%, 100% { transform: scale(.86); opacity: .62; }
              50% { transform: scale(1.08); opacity: 1; }
            }
          `}</style>

          <h1 style={{
            margin: 0,
            fontSize: 'clamp(32px, 7.2vw, 46px)',
            lineHeight: 1.08,
            letterSpacing: -1.4,
            fontWeight: 760,
            color: '#101827',
          }}>
            Volvemos enseguida
          </h1>

          <p style={{
            margin: '22px auto 0',
            maxWidth: 430,
            color: '#8a8f98',
            fontSize: 'clamp(17px, 4.2vw, 21px)',
            lineHeight: 1.55,
            fontWeight: 450,
          }}>
            Estamos con alta demanda justo ahora.<br />
            Intenta nuevamente en unos segundos.
          </p>

          <button
            onClick={() => reset()}
            style={{
              appearance: 'none',
              border: 0,
              marginTop: 38,
              minWidth: 240,
              minHeight: 62,
              padding: '0 34px',
              borderRadius: 22,
              background: '#f7a719',
              color: '#fff',
              font: 'inherit',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 7px 18px rgba(247,167,25,.16)',
              transition: 'transform .15s ease, background .15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#ea990b'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f7a719'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Intentar de nuevo
          </button>

          <a
            href="https://quierocomer.com"
            style={{ display: 'block', marginTop: 34, color: '#8a8f98', fontSize: 16, letterSpacing: '-0.1px', textDecoration: 'none', fontWeight: 500 }}
          >
            QuieroComer.com
          </a>

        </div>
      </div>
    </div>
  );
}
