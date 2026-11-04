export default function RestaurantLandingLoading() {
  return (
    <>
      <style>{`
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .rll-s {
          background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.06) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s infinite;
          border-radius: 10px;
        }
      `}</style>
      <div style={{
        minHeight: '100svh',
        background: 'linear-gradient(160deg, #111 0%, #1c1c1c 60%, #0e0e0e 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '36px 20px 60px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow overlay — igual que la página real */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 82% 5%, rgba(244,166,35,0.09) 0%, transparent 46%), radial-gradient(ellipse at 6% 90%, rgba(244,166,35,0.06) 0%, transparent 40%)' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

          {/* Logo */}
          <div className="rll-s" style={{ width: 88, height: 88, borderRadius: '50%', marginBottom: 20 }} />

          {/* Nombre */}
          <div className="rll-s" style={{ width: 160, height: 22, borderRadius: 8, marginBottom: 6 }} />

          {/* Botones */}
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
            {[180, 160, 170, 155].map((w, i) => (
              <div key={i} style={{
                height: 80, borderRadius: 18,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center',
                padding: '0 20px', gap: 14,
              }}>
                {/* Ícono */}
                <div className="rll-s" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
                {/* Texto */}
                <div className="rll-s" style={{ width: w, height: 16, flex: 'none' }} />
                {/* Flecha */}
                <div style={{ marginLeft: 'auto', width: 10, height: 18, borderRadius: 4, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
              </div>
            ))}
          </div>

          {/* Powered by */}
          <div className="rll-s" style={{ width: 130, height: 11, borderRadius: 6, marginTop: 48, opacity: 0.5 }} />
        </div>
      </div>
    </>
  )
}
