export default function FidelidadLoading() {
  return (
    <>
      <style>{`
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .fdl-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
      <div style={{ minHeight: "100dvh", background: "#111", display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 20px 40px" }}>
        {/* Logo */}
        <div className="fdl-shimmer" style={{ width: 62, height: 62, borderRadius: "50%", marginBottom: 14 }} />
        {/* Name */}
        <div className="fdl-shimmer" style={{ width: 120, height: 13, borderRadius: 5, marginBottom: 10 }} />
        {/* Title */}
        <div className="fdl-shimmer" style={{ width: 200, height: 28, borderRadius: 8, marginBottom: 24 }} />
        {/* Card preview */}
        <div className="fdl-shimmer" style={{ width: "100%", maxWidth: 380, height: 120, borderRadius: 20, marginBottom: 20 }} />
        {/* Rewards */}
        <div className="fdl-shimmer" style={{ width: "100%", maxWidth: 380, height: 80, borderRadius: 16, marginBottom: 12 }} />
        {/* Form fields */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="fdl-shimmer" style={{ width: "100%", maxWidth: 380, height: 52, borderRadius: 14, marginBottom: 10 }} />
        ))}
      </div>
    </>
  );
}
