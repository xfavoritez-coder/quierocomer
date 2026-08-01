"use client";

import { useEffect, useState } from "react";

interface WelcomeData {
  localName: string;
  ownerName: string;
  email: string;
  password: string;
  autoLoginUrl: string;
  slug: string;
}

export default function BienvenidaPage() {
  const [data, setData] = useState<WelcomeData | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("qc_welcome");
      if (raw) {
        setData(JSON.parse(raw));
        sessionStorage.removeItem("qc_welcome");
      }
    } catch {}
  }, []);

  const copy = (text: string, field: "email" | "password") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (!data) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0d0d0d", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: "center", color: "#555" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🍽️</div>
          <p style={{ fontSize: "0.9rem" }}>Cargando...</p>
        </div>
      </div>
    );
  }

  const firstName = data.ownerName.split(" ")[0];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #0d0d0d; }

        .bv-credential {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .bv-credential:hover { border-color: #F4A623; }
        .bv-copy-btn {
          flex-shrink: 0;
          background: transparent;
          border: 1px solid #333;
          color: #666;
          border-radius: 8px;
          padding: 5px 12px;
          font-size: 0.7rem;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .bv-copy-btn:hover { border-color: #F4A623; color: #F4A623; }
        .bv-copy-btn.copied { border-color: #22c55e; color: #22c55e; }

        .bv-step {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 0;
          border-bottom: 1px solid #1e1e1e;
        }
        .bv-step:last-child { border-bottom: none; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bv-card { animation: fadeIn 0.5s ease both; }
        .bv-card:nth-child(2) { animation-delay: 0.1s; }
        .bv-card:nth-child(3) { animation-delay: 0.2s; }
        .bv-card:nth-child(4) { animation-delay: 0.3s; }
        .bv-cta { animation: fadeIn 0.5s ease 0.4s both; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#0d0d0d",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 20px 80px",
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 48, opacity: 0.7 }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: "1rem", color: "#F4A623", letterSpacing: 0.5 }}>
            QuieroComer
          </span>
        </div>

        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* Hero */}
          <div className="bv-card" style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎉</div>
            <h1 style={{
              fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
              fontFamily: "Georgia, serif",
              fontWeight: 400,
              lineHeight: 1.2,
              margin: "0 0 12px",
              color: "#fff",
            }}>
              {firstName}, ya comenzaron tus<br />
              <span style={{ color: "#F4A623" }}>7 días Premium gratis</span>
            </h1>
            <p style={{ fontSize: "0.95rem", color: "#888", lineHeight: 1.65, margin: 0 }}>
              <strong style={{ color: "#ccc" }}>{data.localName}</strong> ya tiene carta digital activa.<br />
              Entra y configúrala como quieras.
            </p>
          </div>

          {/* Credentials */}
          <div className="bv-card" style={{
            background: "#111",
            border: "1px solid #222",
            borderRadius: 16,
            padding: "20px 20px 14px",
            marginBottom: 16,
          }}>
            <div style={{
              fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#F4A623", marginBottom: 14,
            }}>
              Tus datos de acceso
            </div>

            <div
              className="bv-credential"
              onClick={() => copy(data.email, "email")}
              title="Copiar email"
            >
              <div>
                <div style={{ fontSize: "0.62rem", color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                  Email
                </div>
                <div style={{ fontSize: "0.9rem", color: "#ddd", fontWeight: 600, wordBreak: "break-all" }}>
                  {data.email}
                </div>
              </div>
              <button className={`bv-copy-btn${copied === "email" ? " copied" : ""}`}>
                {copied === "email" ? "✓ Copiado" : "Copiar"}
              </button>
            </div>

            <div
              className="bv-credential"
              onClick={() => copy(data.password, "password")}
              title="Copiar contraseña"
            >
              <div>
                <div style={{ fontSize: "0.62rem", color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                  Contraseña
                </div>
                <div style={{ fontSize: "0.9rem", color: "#ddd", fontWeight: 600, fontFamily: "monospace", letterSpacing: 1 }}>
                  {data.password}
                </div>
              </div>
              <button className={`bv-copy-btn${copied === "password" ? " copied" : ""}`}>
                {copied === "password" ? "✓ Copiado" : "Copiar"}
              </button>
            </div>

            <p style={{ fontSize: "0.7rem", color: "#444", margin: "6px 0 0", lineHeight: 1.5 }}>
              También te enviamos estos datos por email a <strong style={{ color: "#555" }}>{data.email}</strong>
            </p>
          </div>

          {/* Steps */}
          <div className="bv-card" style={{
            background: "#111",
            border: "1px solid #222",
            borderRadius: 16,
            padding: "20px 20px 6px",
            marginBottom: 24,
          }}>
            <div style={{
              fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#F4A623", marginBottom: 10,
            }}>
              Primeros pasos
            </div>

            {[
              { icon: "🍽️", title: "Agrega tus platos", desc: "Sube fotos, precios y descripciones desde el panel." },
              { icon: "📱", title: "Genera tu QR", desc: "Descárgalo e imprímelo para tus mesas y redes sociales." },
              { icon: "📊", title: "Mira las estadísticas", desc: "Ve qué platos ven más tus clientes y cuándo llegan." },
            ].map((step, i) => (
              <div key={i} className="bv-step">
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: "#1a1a1a",
                  border: "1px solid #2a2a2a", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "1.1rem", flexShrink: 0,
                }}>
                  {step.icon}
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#ddd", marginBottom: 2 }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#555", lineHeight: 1.5 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="bv-cta">
            <a
              href={data.autoLoginUrl}
              style={{
                display: "block",
                background: "#F4A623",
                color: "#fff",
                textAlign: "center",
                padding: "16px 24px",
                borderRadius: 14,
                fontWeight: 700,
                fontSize: "1rem",
                textDecoration: "none",
                letterSpacing: 0.3,
                boxShadow: "0 4px 20px rgba(244,166,35,0.25)",
              }}
            >
              Entrar a mi panel →
            </a>

            <p style={{
              textAlign: "center", fontSize: "0.72rem", color: "#333",
              marginTop: 12, lineHeight: 1.5,
            }}>
              También puedes entrar en{" "}
              <a href="https://quierocomer.com/panel" style={{ color: "#555", textDecoration: "underline" }}>
                quierocomer.com/panel
              </a>
              {" "}con tu email y contraseña
            </p>

            {data.slug && (
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <a
                  href={`/qr/${data.slug}`}
                  style={{ fontSize: "0.75rem", color: "#444", textDecoration: "underline" }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver mi carta pública →
                </a>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
