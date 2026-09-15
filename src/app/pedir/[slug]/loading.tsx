export default function PedirLoading() {
  return (
    <>
      <style>{`
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .pdl-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
      <div style={{ minHeight: "100dvh", background: "#0e0e0e", padding: "0 0 40px" }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="pdl-shimmer" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
          <div className="pdl-shimmer" style={{ width: "40%", height: 18, borderRadius: 6 }} />
        </div>
        {/* Category pills */}
        <div style={{ display: "flex", gap: 8, padding: "14px 16px", overflowX: "hidden" }}>
          {[80, 100, 70, 90].map((w, i) => (
            <div key={i} className="pdl-shimmer" style={{ width: w, height: 34, borderRadius: 20, flexShrink: 0 }} />
          ))}
        </div>
        {/* Items */}
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="pdl-shimmer" style={{ height: 80, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    </>
  );
}
