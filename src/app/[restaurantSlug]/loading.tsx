export default function RestaurantLandingLoading() {
  return (
    <>
      <style>{`
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .rll-s {
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
      <div style={{
        minHeight: '100svh',
        background: 'linear-gradient(160deg, #111 0%, #1c1c1c 60%, #0e0e0e 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 20px 60px',
      }}>
        {/* Logo circle */}
        <div className="rll-s" style={{ width: 88, height: 88, borderRadius: '50%', marginBottom: 20 }} />
        {/* Name */}
        <div className="rll-s" style={{ width: 180, height: 24, borderRadius: 8, marginBottom: 8 }} />
        {/* Buttons */}
        <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="rll-s" style={{ height: 72, borderRadius: 18 }} />
          ))}
        </div>
      </div>
    </>
  )
}
