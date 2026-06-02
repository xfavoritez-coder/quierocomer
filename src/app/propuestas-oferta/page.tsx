export default function PropuestasOferta() {
  return (
    <div style={{ background: "#0A0908", color: "#E8DDC8", minHeight: "100vh", padding: "40px 20px", fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, textAlign: "center", marginBottom: 40, color: "#E8A33D" }}>Propuestas badge oferta</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 40, maxWidth: 400, margin: "0 auto" }}>

        {/* PROPUESTA 1: Rojo intenso + crema */}
        <div>
          <h3 style={{ color: "#888", fontSize: 13, marginBottom: 12, textAlign: "center" }}>Propuesta 1 — Rojo intenso</h3>
          <div style={{ position: "relative", padding: 22, borderRadius: 22, background: "linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025)), #101010", border: "1px solid rgba(255,178,45,.45)", boxShadow: "0 0 36px rgba(255,178,45,.10)" }}>
            <span style={{ position: "absolute", top: 16, right: 16, borderRadius: 999, padding: "8px 12px", background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 950, letterSpacing: ".5px" }}>-90% dcto</span>
            <div style={{ color: "#C9BBA0", fontSize: 14, fontWeight: 950, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 }}>Oferta plan Premium</div>
            <span style={{ color: "rgba(232,221,200,.5)", fontSize: 20, fontWeight: 900, textDecoration: "line-through", textDecorationThickness: "2px" }}>$45.900</span>
            <div style={{ margin: "-2px 0 6px", color: "#E8A33D", fontSize: 38, fontWeight: 950, letterSpacing: "-1.5px" }}>$4.900 <small style={{ fontSize: 13, color: "#C9BBA0", letterSpacing: 0 }}>CLP primer mes</small></div>
          </div>
        </div>

        {/* PROPUESTA 2: Rojo oscuro + ámbar */}
        <div>
          <h3 style={{ color: "#888", fontSize: 13, marginBottom: 12, textAlign: "center" }}>Propuesta 2 — Rojo oscuro con borde</h3>
          <div style={{ position: "relative", padding: 22, borderRadius: 22, background: "linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025)), #101010", border: "1px solid rgba(255,178,45,.45)", boxShadow: "0 0 36px rgba(255,178,45,.10)" }}>
            <span style={{ position: "absolute", top: 16, right: 16, borderRadius: 999, padding: "8px 12px", background: "rgba(220,38,38,.15)", border: "1px solid rgba(220,38,38,.5)", color: "#ef4444", fontSize: 11, fontWeight: 950, letterSpacing: ".5px" }}>-90% dcto</span>
            <div style={{ color: "#E8A33D", fontSize: 14, fontWeight: 950, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 }}>Oferta plan Premium</div>
            <span style={{ color: "rgba(232,221,200,.5)", fontSize: 20, fontWeight: 900, textDecoration: "line-through", textDecorationThickness: "2px" }}>$45.900</span>
            <div style={{ margin: "-2px 0 6px", color: "#E8A33D", fontSize: 38, fontWeight: 950, letterSpacing: "-1.5px" }}>$4.900 <small style={{ fontSize: 13, color: "#C9BBA0", letterSpacing: 0 }}>CLP primer mes</small></div>
          </div>
        </div>

        {/* PROPUESTA 3: Rojo + label crema sutil */}
        <div>
          <h3 style={{ color: "#888", fontSize: 13, marginBottom: 12, textAlign: "center" }}>Propuesta 3 — Badge rojo, label sutil</h3>
          <div style={{ position: "relative", padding: 22, borderRadius: 22, background: "linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025)), #101010", border: "1px solid rgba(220,38,38,.35)", boxShadow: "0 0 36px rgba(220,38,38,.08)" }}>
            <span style={{ position: "absolute", top: -10, right: 20, borderRadius: 999, padding: "6px 14px", background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 950, letterSpacing: ".5px", boxShadow: "0 4px 12px rgba(220,38,38,.4)" }}>-90%</span>
            <div style={{ color: "#887B68", fontSize: 13, fontWeight: 600, letterSpacing: ".5px", textTransform: "uppercase" as const, marginBottom: 6 }}>Oferta plan Premium</div>
            <span style={{ color: "rgba(232,221,200,.5)", fontSize: 20, fontWeight: 900, textDecoration: "line-through", textDecorationThickness: "2px" }}>$45.900</span>
            <div style={{ margin: "-2px 0 6px", color: "#E8DDC8", fontSize: 38, fontWeight: 950, letterSpacing: "-1.5px" }}>$4.900 <small style={{ fontSize: 13, color: "#C9BBA0", letterSpacing: 0 }}>CLP primer mes</small></div>
          </div>
        </div>

      </div>
    </div>
  );
}
