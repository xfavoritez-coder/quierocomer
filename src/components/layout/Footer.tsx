"use client";

export default function Footer() {
  return (
    <footer className="dc-footer">
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div className="dc-footer-grid">
          {/* Logo y descripción */}
          <div>
            <p style={{
              fontFamily: "var(--font-cinzel-decorative)",
              fontSize: "1.2rem",
              color: "var(--accent)",
              textShadow: "0 0 20px color-mix(in srgb, var(--accent) 50%, transparent)",
              marginBottom: "16px",
            }}>
              🏮 QuieroComer
            </p>
            <p style={{
              fontFamily: "var(--font-lato)",
              fontSize: "0.9rem",
              color: "var(--text-muted)",
              lineHeight: 1.8,
              fontWeight: 300,
              maxWidth: "280px",
            }}>
              El genio que cumple tu deseo de comer. La plataforma gastronómica donde los mejores locales, concursos y promociones de comida te esperan.
            </p>
          </div>

          {[
            {
              titulo: "Plataforma",
              links: [
                { label: "Inicio",               href: "/" },
                { label: "¿Qué es QuieroComer?",  href: "/que-es-quierocomer" },
                { label: "Concursos",             href: "/concursos" },
                { label: "Ganadores",             href: "/concursos/ganadores" },
                { label: "Promociones",           href: "/promociones" },
                { label: "Locales",               href: "/locales" },
              ],
            },
            {
              titulo: "Para Locales",
              links: [
                { label: "Registra tu local",  href: "/solo-locales" },
                { label: "Iniciar sesión",     href: "/login-local" },
                { label: "Panel de control",   href: "/panel" },
              ],
            },
            {
              titulo: "Captadores",
              links: [
                { label: "Ser captador",       href: "/capta-locales" },
                { label: "Acceder al panel",   href: "/captador" },
              ],
            },
            {
              titulo: "Legal",
              links: [
                { label: "Términos y condiciones", href: "/terminos" },
                { label: "Privacidad",             href: "/privacidad" },
                { label: "Contacto",               href: "/contacto" },
              ],
            },
          ].map(col => (
            <div key={col.titulo}>
              <p style={{
                fontFamily: "var(--font-cinzel)",
                fontSize: "0.75rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--oasis-bright)",
                marginBottom: "20px",
              }}>
                {col.titulo}
              </p>
              {col.links.map(link => (
                <a key={link.label}
                  href={link.href}
                  style={{
                    display: "block",
                    fontFamily: "var(--font-lato)",
                    fontSize: "0.95rem",
                    color: "var(--text-muted)",
                    textDecoration: "none",
                    marginBottom: "10px",
                    minHeight: "28px",
                    lineHeight: "28px",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.setProperty("color", "var(--text-primary)");
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.setProperty("color", "var(--text-muted)");
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div style={{
          borderTop: "1px solid var(--border-color)",
          paddingTop: "32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}>
          <p style={{
            fontFamily: "var(--font-lato)",
            fontSize: "0.85rem",
            color: "var(--text-muted)",
          }}>
            © {new Date().getFullYear()} QuieroComer.com
          </p>
          <p style={{
            fontFamily: "var(--font-cinzel)",
            fontSize: "0.75rem",
            letterSpacing: "0.15em",
            color: "var(--text-muted)",
          }}>
            Hecho con 💛 y mucha hambre
          </p>
        </div>
      </div>

      <style>{`
        .dc-footer {
          padding: 60px 60px 40px;
          background-color: var(--bg-primary);
          border-top: 1px solid var(--border-color);
        }
        .dc-footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
          gap: 60px;
          margin-bottom: 60px;
        }

        @media (max-width: 767px) {
          .dc-footer      { padding: 48px 24px 32px; }
          .dc-footer-grid {
            grid-template-columns: 1fr 1fr;
            gap: 36px;
            margin-bottom: 40px;
          }
          .dc-footer-grid > div:first-child {
            grid-column: 1 / -1;
          }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .dc-footer      { padding: 52px 40px 36px; }
          .dc-footer-grid { gap: 40px; }
        }
      `}</style>
    </footer>
  );
}
