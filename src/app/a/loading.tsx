export default function FeedLoading() {
  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', minHeight: '100dvh',
      background: '#f5f4f1', padding: '10px 16px',
    }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ width: 140, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.07)' }} />
        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.07)' }} />
      </div>
      {/* Search skeleton */}
      <div style={{ height: 40, borderRadius: 14, background: 'rgba(0,0,0,0.06)', marginBottom: 16 }} />
      {/* Cards skeleton */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1].map(col => (
          <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton-shimmer" style={{
                aspectRatio: ['3/4', '1/1', '4/5'][i],
                borderRadius: 14,
                background: 'rgba(0,0,0,0.06)',
              }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
