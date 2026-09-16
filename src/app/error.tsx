'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f5f4f1', padding: '24px', textAlign: 'center',
    }}>
      <p style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', color: '#111', letterSpacing: '-0.02em' }}>
        Volvemos en un momento
      </p>
      <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)', margin: '0 0 28px', lineHeight: 1.6, maxWidth: 280 }}>
        Estamos con alta demanda justo ahora.<br />Recarga en unos segundos.
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '12px 28px', background: '#F4A623', color: '#fff',
          border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Recargar
      </button>
      <a
        href="https://quierocomer.com"
        style={{ marginTop: 40, fontSize: 12, color: 'rgba(0,0,0,0.25)', textDecoration: 'none', letterSpacing: '0.02em' }}
      >
        QuieroComer.cl
      </a>
    </div>
  )
}
