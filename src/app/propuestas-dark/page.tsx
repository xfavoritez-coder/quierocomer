function BannerProposal({ title, bg, border, iconBg, iconBorder, tagBg, tagColor, tagDot, tagText, fadeBg, textColor, subColor }: any) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 14, color: "#F4A623", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>{title}</h2>
      <div style={{ padding: "14px 12px 12px", background: bg, border: `0.5px solid ${border}`, borderRadius: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: iconBg, border: `0.5px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>🧞</div>
          <div>
            <p style={{ fontSize: "0.82rem", fontWeight: 700, color: textColor, margin: 0 }}>Tu selección vegana 🌿</p>
            <p style={{ fontSize: "0.7rem", color: subColor, margin: "1px 0 0" }}>Platos 100% plant-based para ti</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, overflow: "hidden" }}>
          {["Pad Thai Vegano", "Ensalada Mediterránea"].map((name, i) => (
            <div key={i} style={{ flexShrink: 0, width: 130, background: iconBg, border: `0.5px solid ${border}`, borderRadius: 12, padding: 6, textAlign: "left" }}>
              <div style={{ width: "100%", height: 72, borderRadius: 8, background: fadeBg, marginBottom: 5, display: "flex", alignItems: "center", justifyContent: "center", color: subColor, fontSize: "1.2rem" }}>🍽</div>
              <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3, background: tagBg, color: tagColor, fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.3px", marginBottom: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: tagDot, flexShrink: 0 }} />{tagText}
              </span>
              <p style={{ fontSize: "0.78rem", fontWeight: 600, color: textColor, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
              <p style={{ fontSize: "0.72rem", color: subColor, margin: "1px 0 0" }}>$8.900</p>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 32, background: `linear-gradient(to right, transparent, ${bg.includes("gradient") ? "rgba(0,0,0,0.3)" : bg})`, pointerEvents: "none", borderRadius: "0 12px 12px 0" }} />
      </div>
    </div>
  );
}

export default function PropuestasDark() {
  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", padding: "40px 20px", color: "#f0f0f0", fontFamily: "'Inter', sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 30, textAlign: "center", fontWeight: 600 }}>Propuestas Dark Mode — Promo Cards</h1>

      <div style={{ maxWidth: 400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>

        {/* OPCIÓN 1: Fondo oscuro sutil con borde amber */}
        <div>
          <h2 style={{ fontSize: 14, color: "#F4A623", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Opción 1 — Oscuro con borde amber</h2>
          <button style={{
            width: "100%", display: "flex", alignItems: "stretch", gap: 0, padding: 0,
            background: "linear-gradient(135deg, rgba(244,166,35,0.06) 0%, rgba(244,166,35,0.02) 100%)",
            border: "1px solid rgba(244,166,35,0.2)",
            borderRadius: 16, overflow: "hidden", textAlign: "left", cursor: "pointer",
          }}>
            <div style={{ width: 95, minHeight: 80, background: "linear-gradient(135deg, #3a2a1a, #2a1f14)", flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "10px 12px" }}>
              <span style={{ display: "inline-block", fontSize: "9.5px", fontWeight: 800, color: "white", background: "#F4A623", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, marginBottom: 5 }}>OFERTA</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Pizza Margherita</p>
              <p style={{ fontSize: "12.5px", color: "#aaa", margin: "2px 0 0", lineHeight: 1.4 }}>La clásica italiana con tomate y mozzarella</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 5 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#F4A623" }}>$8.900</span>
                <span style={{ fontSize: 13, color: "#888", textDecoration: "line-through" }}>$12.500</span>
              </div>
            </div>
          </button>
        </div>

        {/* OPCIÓN 2: Fondo amber translúcido */}
        <div>
          <h2 style={{ fontSize: 14, color: "#F4A623", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Opción 2 — Amber translúcido</h2>
          <button style={{
            width: "100%", display: "flex", alignItems: "stretch", gap: 0, padding: 0,
            background: "linear-gradient(135deg, rgba(244,166,35,0.12) 0%, rgba(244,166,35,0.05) 100%)",
            border: "1px solid rgba(244,166,35,0.25)",
            borderRadius: 16, overflow: "hidden", textAlign: "left", cursor: "pointer",
            boxShadow: "0 2px 12px rgba(244,166,35,0.08)",
          }}>
            <div style={{ width: 95, minHeight: 80, background: "linear-gradient(135deg, #3a2a1a, #2a1f14)", flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "10px 12px" }}>
              <span style={{ display: "inline-block", fontSize: "9.5px", fontWeight: 800, color: "#0e0e0e", background: "#F4A623", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, marginBottom: 5 }}>OFERTA</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Pizza Margherita</p>
              <p style={{ fontSize: "12.5px", color: "#bbb", margin: "2px 0 0", lineHeight: 1.4 }}>La clásica italiana con tomate y mozzarella</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 5 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#F4A623" }}>$8.900</span>
                <span style={{ fontSize: 13, color: "#666", textDecoration: "line-through" }}>$12.500</span>
              </div>
            </div>
          </button>
        </div>

        {/* OPCIÓN 3: Card surface con acento amber solo en borde izquierdo */}
        <div>
          <h2 style={{ fontSize: 14, color: "#F4A623", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Opción 3 — Surface + borde izquierdo amber</h2>
          <button style={{
            width: "100%", display: "flex", alignItems: "stretch", gap: 0, padding: 0,
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderLeft: "3px solid #F4A623",
            borderRadius: 16, overflow: "hidden", textAlign: "left", cursor: "pointer",
          }}>
            <div style={{ width: 95, minHeight: 80, background: "linear-gradient(135deg, #3a2a1a, #2a1f14)", flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "10px 12px" }}>
              <span style={{ display: "inline-block", fontSize: "9.5px", fontWeight: 800, color: "white", background: "#F4A623", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, marginBottom: 5 }}>OFERTA</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Pizza Margherita</p>
              <p style={{ fontSize: "12.5px", color: "#aaa", margin: "2px 0 0", lineHeight: 1.4 }}>La clásica italiana con tomate y mozzarella</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 5 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#F4A623" }}>$8.900</span>
                <span style={{ fontSize: 13, color: "#888", textDecoration: "line-through" }}>$12.500</span>
              </div>
            </div>
          </button>
        </div>

        {/* OPCIÓN 4: Glassmorphism oscuro */}
        <div>
          <h2 style={{ fontSize: 14, color: "#F4A623", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Opción 4 — Glass oscuro</h2>
          <button style={{
            width: "100%", display: "flex", alignItems: "stretch", gap: 0, padding: 0,
            background: "rgba(244,166,35,0.04)",
            border: "1px solid rgba(244,166,35,0.15)",
            borderRadius: 16, overflow: "hidden", textAlign: "left", cursor: "pointer",
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(244,166,35,0.08)",
          }}>
            <div style={{ width: 95, minHeight: 80, background: "linear-gradient(135deg, #3a2a1a, #2a1f14)", flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "10px 12px" }}>
              <span style={{ display: "inline-block", fontSize: "9.5px", fontWeight: 800, color: "white", background: "rgba(244,166,35,0.9)", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, marginBottom: 5 }}>OFERTA</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Pizza Margherita</p>
              <p style={{ fontSize: "12.5px", color: "#aaa", margin: "2px 0 0", lineHeight: 1.4 }}>La clásica italiana con tomate y mozzarella</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 5 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#F4A623" }}>$8.900</span>
                <span style={{ fontSize: 13, color: "#888", textDecoration: "line-through" }}>$12.500</span>
              </div>
            </div>
          </button>
        </div>

        {/* SEPARADOR */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "20px 0" }} />
        <h1 style={{ fontSize: 22, marginBottom: 30, textAlign: "center", fontWeight: 600 }}>Propuestas Banners Genio — Dark Mode</h1>

        <BannerProposal
          title="Actual (cómo se ve hoy en dark — mal)"
          bg="#EAF3DE"
          border="rgba(99,153,34,0.2)"
          iconBg="#fff"
          iconBorder="rgba(99,153,34,0.3)"
          tagBg="rgba(255,255,255,0.95)"
          tagColor="#3A8E68"
          tagDot="#3A8E68"
          tagText="VEGAN"
          fadeBg="#f0f0f0"
          textColor="#0e0e0e"
          subColor="#777"
        />

        <BannerProposal
          title="Opción A — Oscuro con tinte verde sutil"
          bg="rgba(34,197,94,0.06)"
          border="rgba(34,197,94,0.15)"
          iconBg="rgba(34,197,94,0.1)"
          iconBorder="rgba(34,197,94,0.2)"
          tagBg="rgba(34,197,94,0.15)"
          tagColor="#4ade80"
          tagDot="#4ade80"
          tagText="VEGAN"
          fadeBg="#1a1a1a"
          textColor="#f0f0f0"
          subColor="#888"
        />

        <BannerProposal
          title="Opción B — Surface neutro, badge verde"
          bg="#1a1a1a"
          border="rgba(255,255,255,0.08)"
          iconBg="rgba(34,197,94,0.12)"
          iconBorder="rgba(34,197,94,0.25)"
          tagBg="rgba(34,197,94,0.2)"
          tagColor="#4ade80"
          tagDot="#4ade80"
          tagText="VEGAN"
          fadeBg="#252525"
          textColor="#f0f0f0"
          subColor="#999"
        />

        <BannerProposal
          title="Opción C — Glass con borde verde"
          bg="rgba(34,197,94,0.04)"
          border="rgba(34,197,94,0.2)"
          iconBg="rgba(0,0,0,0.3)"
          iconBorder="rgba(34,197,94,0.3)"
          tagBg="rgba(34,197,94,0.12)"
          tagColor="#86efac"
          tagDot="#86efac"
          tagText="VEGAN"
          fadeBg="rgba(255,255,255,0.05)"
          textColor="#e0e0e0"
          subColor="#888"
        />

      </div>
    </div>
  );
}
