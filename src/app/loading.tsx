export default function RootLoading() {
  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', minHeight: '100dvh',
      background: '#f5f4f1', padding: '10px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ width: 140, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.07)' }} />
        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.07)' }} />
      </div>
      <div style={{ height: 40, borderRadius: 14, background: 'rgba(0,0,0,0.06)', marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1].map(col => (
          <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                aspectRatio: ['3/4', '1/1', '4/5'][i],
                borderRadius: 14,
                background: 'linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.10) 50%, rgba(0,0,0,0.06) 75%)',
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
