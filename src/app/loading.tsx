export default function RootLoading() {
  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', minHeight: '100dvh',
      background: '#0e0e0e', padding: '10px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ width: 140, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
      </div>
      <div style={{ height: 40, borderRadius: 14, background: 'rgba(255,255,255,0.04)', marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1].map(col => (
          <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                aspectRatio: ['3/4', '1/1', '4/5'][i],
                borderRadius: 14,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }} />
            ))}
          </div>
        ))}
      </div>
      <style>{`@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }`}</style>
    </div>
  )
}
