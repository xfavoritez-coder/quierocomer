'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f5f4f1', padding: '24px', textAlign: 'center',
    }}>
      <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: '#111' }}>
        Algo salió mal
      </p>
      <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)', margin: '0 0 24px' }}>
        No pudimos cargar el feed. Intenta de nuevo.
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '12px 28px', background: '#F4A623', color: '#fff',
          border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Volver a intentar
      </button>
    </div>
  )
}
