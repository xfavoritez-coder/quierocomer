"use client";

export default function LandingFooter() {
  return (
    <footer style={{ background: "#111111", color: "rgba(255,255,255,.6)", padding: "36px 0 30px", fontSize: 14 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 clamp(16px,4vw,48px)" }}>
        {/* Top row: logo + links */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 26, flexWrap: "wrap", paddingBottom: 26 }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#fff", fontSize: 20, fontWeight: 850, letterSpacing: "-.04em", textDecoration: "none", fontFamily: "Instrument Sans, sans-serif" }}>
            <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }} />
            QuieroComer
          </a>
          <nav style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
            [
              { label: "Productos", href: "/#productos" },
              { label: "Precios", href: "/#precios" },
              { label: "Contacto", href: "https://wa.me/56999946208?text=Hola%20tengo%20una%20consulta%20sobre%20QuieroComer", external: true },
            ].map(({ label, href, external }) => (
              <a
                key={label}
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                style={{ color: "rgba(255,255,255,.65)", textDecoration: "none", fontFamily: "Instrument Sans, sans-serif", transition: "color .15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#FFD400")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.65)")}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.13)", paddingTop: 22, fontSize: 12, opacity: .5, display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <span>© 2026 QuieroComer</span>
          <span>Santiago de Chile</span>
        </div>
      </div>
    </footer>
  );
}
