"use client";

const ANNOUNCEMENT = "Este viernes abrimos hasta las 2 AM — Reservas por WhatsApp";

/* Option 1: Amarillo suave pastel */
function Banner1() {
  return (
    <div style={{ background: "#FEF9C3", padding: "10px 16px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#713F12", lineHeight: 1.35 }}>
        {ANNOUNCEMENT}
      </p>
    </div>
  );
}

/* Option 2: Amarillo vibrante limpio */
function Banner2() {
  return (
    <div style={{ background: "#FACC15", padding: "10px 16px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#1a1a1a", lineHeight: 1.35 }}>
        {ANNOUNCEMENT}
      </p>
    </div>
  );
}

/* Option 3: Blanco con borde amarillo y acento */
function Banner3() {
  return (
    <div style={{ background: "#FFFBEB", borderTop: "2px solid #FACC15", borderBottom: "1px solid #FDE68A", padding: "10px 16px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#92400E", lineHeight: 1.35 }}>
        📢 {ANNOUNCEMENT}
      </p>
    </div>
  );
}

/* Option 4: Oscuro elegante */
function Banner4() {
  return (
    <div style={{ background: "#1a1a1a", borderBottom: "1px solid #333", padding: "10px 16px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#FACC15", lineHeight: 1.35 }}>
        {ANNOUNCEMENT}
      </p>
    </div>
  );
}

/* Fake nav */
function FakeNav() {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", height: 44, display: "flex", alignItems: "center", padding: "0 16px", gap: 20 }}>
      {["Entradas", "Principales", "Postres", "Bebidas"].map((c, i) => (
        <span key={c} style={{ fontSize: "0.92rem", fontWeight: i === 0 ? 700 : 500, color: i === 0 ? "#0e0e0e" : "#999", borderBottom: i === 0 ? "2px solid #F4A623" : "none", paddingBottom: 2 }}>{c}</span>
      ))}
    </div>
  );
}

/* Fake list items */
function FakeList() {
  return (
    <div style={{ background: "#f7f7f5" }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: "1px solid #f0f0f0", background: "#fff" }}>
          <div style={{ width: 80, height: 80, borderRadius: 10, background: "#eee", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0e0e0e" }}>Plato ejemplo {i}</span>
            <span style={{ fontSize: "0.78rem", color: "#888", marginTop: 2 }}>Descripción del plato</span>
            <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0e0e0e", marginTop: 4 }}>$8.900</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PreviewBanner() {
  const options = [
    { id: 1, title: "Amarillo suave pastel", component: <Banner1 /> },
    { id: 2, title: "Amarillo vibrante", component: <Banner2 /> },
    { id: 3, title: "Blanco con acento amarillo", component: <Banner3 /> },
    { id: 4, title: "Oscuro elegante", component: <Banner4 /> },
  ];

  return (
    <div style={{ background: "#111", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <h1 style={{ color: "white", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Cinta de anuncios — Propuestas</h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.88rem", marginTop: 6 }}>
          El banner va debajo del nav de categorías. Cada opción muestra cómo se ve en contexto.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 40, padding: "24px 0 60px" }}>
        {options.map(opt => (
          <div key={opt.id}>
            <div style={{ padding: "0 20px 12px" }}>
              <span style={{ color: "#FACC15", fontSize: "1.1rem", fontWeight: 700 }}>Opción {opt.id}</span>
              <span style={{ color: "white", fontSize: "1rem", fontWeight: 600, marginLeft: 10 }}>{opt.title}</span>
            </div>
            <div style={{ margin: "0 auto", width: 375, maxWidth: "92vw", borderRadius: 24, overflow: "hidden", border: "3px solid rgba(255,255,255,0.15)", background: "#f7f7f5", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
              {/* Hero placeholder */}
              <div style={{ height: 120, background: "linear-gradient(135deg, #1a1a1a, #333)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem" }}>Hero del restaurante</span>
              </div>
              {/* Nav */}
              <FakeNav />
              {/* Banner — debajo del nav */}
              {opt.component}
              {/* List */}
              <FakeList />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
