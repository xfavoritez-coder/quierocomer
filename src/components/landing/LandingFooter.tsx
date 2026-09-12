"use client";

export default function LandingFooter() {
  return (
    <footer style={{ background: "#111111", color: "rgba(255,255,255,.5)", fontSize: 13, fontFamily: "Inter, ui-sans-serif, sans-serif" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "52px clamp(16px,4vw,48px) 40px" }}>

        {/* Tagline */}
        <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,.75)", letterSpacing: "-.02em", marginBottom: 32 }}>
          Carta digital para restaurantes chilenos.
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
