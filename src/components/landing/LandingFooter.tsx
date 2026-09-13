"use client";

export default function LandingFooter() {
  return (
    <footer style={{ background: "#111111", color: "rgba(255,255,255,.5)", fontSize: 13, fontFamily: "Inter, ui-sans-serif, sans-serif" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "52px clamp(16px,4vw,48px) 40px" }}>

        {/* Brand mark */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 9, opacity: .18, marginBottom: 16 }}>
          <img src="/logo.png" alt="" style={{ width: 22, height: 22, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <span style={{ fontSize: 20, fontWeight: 850, letterSpacing: "-.04em", color: "#fff", fontFamily: "Inter, sans-serif" }}>QuieroComer</span>
        </div>

        {/* Tagline */}
        <p style={{ fontSize: 13, color: "rgba(255,255,255,.38)", lineHeight: 1.6, maxWidth: 340, marginBottom: 32, letterSpacing: "-.01em" }}>
          Carta QR inteligente y herramientas de fidelización para que tu local venda más y tus clientes vuelvan.
        </p>

        {/* Links + copyright row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <nav style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {[
              { label: "Productos", href: "/#productos" },
              { label: "Precios", href: "/#precios" },
              { label: "Contacto", href: "https://wa.me/56999946208?text=Hola%20tengo%20una%20consulta%20sobre%20QuieroComer", external: true },
            ].map(({ label, href, external }) => (
              <a
                key={label}
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                style={{ color: "rgba(255,255,255,.45)", textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#F59E1B")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.45)")}
              >
                {label}
              </a>
            ))}
          </nav>
          <span style={{ fontSize: 12 }}>© 2026 · Santiago de Chile</span>
        </div>
      </div>
    </footer>
  );
}
