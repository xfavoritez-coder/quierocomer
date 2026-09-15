export default function RestaurantLandingLoading() {
  return (
    <>
      <style>{`
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .rll-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
      <div style={{ minHeight: "100dvh", background: "#111", padding: "0 0 40px" }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <div className="rll-shimmer" style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="rll-shimmer" style={{ width: "55%", height: 18, borderRadius: 6, marginBottom: 8 }} />
            <div className="rll-shimmer" style={{ width: "35%", height: 13, borderRadius: 5 }} />
          </div>
        </div>
        {/* Feature buttons */}
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rll-shimmer" style={{ height: 80, borderRadius: 18 }} />
          ))}
        </div>
      </div>
    </>
  );
}
