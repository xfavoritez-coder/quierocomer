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
        minHeight: "100vh", background: "#fff", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: "center", color: "#bbb" }}>
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
        body { margin: 0; padding: 0; background: #FAFAF8; }

        .bv-cred-row {
          background: #fff;
          border: 1.5px solid #ECECEA;
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
        .bv-cred-row:hover { border-color: #F59E1B; }
        .bv-copy-btn {
          flex-shrink: 0;
          background: transparent;
          border: 1.5px solid #DDDDD8;
          color: #999;
          border-radius: 8px;
          padding: 5px 12px;
          font-size: 0.7rem;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .bv-copy-btn:hover { border-color: #F59E1B; color: #8F5A05; }
        .bv-copy-btn.copied { border-color: #22c55e; color: #16a34a; }

        .bv-step {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 0;
          border-bottom: 1px solid #F0F0EE;
        }
        .bv-step:last-child { border-bottom: none; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bv-card { animation: fadeUp 0.45s ease both; }
        .bv-card:nth-child(2) { animation-delay: 0.08s; }
        .bv-card:nth-child(3) { animation-delay: 0.16s; }
        .bv-card:nth-child(4) { animation-delay: 0.24s; }
        .bv-cta { animation: fadeUp 0.45s ease 0.32s both; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#FAFAF8",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        color: "#111",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 20px 80px",
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7 }}>
            <img src="/logo.png" alt="" style={{ width: 22, height: 22, display: "block" }} />
            <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111", letterSpacing: "-0.02em", fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
              QuieroComer
            </span>
          </a>
        </div>

        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* Hero */}
          <div className="bv-card" style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{
              fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              margin: "0 0 12px",
              color: "#111",
            }}>
              {firstName}, ya comenzaron tus{" "}
              <span style={{ color: "#F59E1B" }}>7 días gratis</span>
            </h1>
            <p style={{ fontSize: "1rem", color: "#71716C", lineHeight: 1.65, margin: 0 }}>
              <strong style={{ color: "#111" }}>{data.localName}</strong> ya tiene carta digital activa.
            </p>
          </div>

          {/* Credentials */}
          <div className="bv-card" style={{
            background: "#fff",
            border: "1.5px solid #ECECEA",
            borderRadius: 20,
            padding: "22px 20px 16px",
            marginBottom: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#F59E1B", marginBottom: 14,
            }}>
              Tus datos de acceso
            </div>

            <div
              className="bv-cred-row"
              onClick={() => copy(data.email, "email")}
              title="Copiar email"
            >
              <div>
                <div style={{ fontSize: "0.62rem", color: "#A8A8A2", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                  Email
                </div>
                <div style={{ fontSize: "0.9rem", color: "#111", fontWeight: 600, wordBreak: "break-all" }}>
                  {data.email}
                </div>
              </div>
              <button className={`bv-copy-btn${copied === "email" ? " copied" : ""}`}>
                {copied === "email" ? "✓ Copiado" : "Copiar"}
              </button>
            </div>

            <div
              className="bv-cred-row"
              onClick={() => copy(data.password, "password")}
              title="Copiar contraseña"
            >
              <div>
                <div style={{ fontSize: "0.62rem", color: "#A8A8A2", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                  Contraseña
                </div>
                <div style={{ fontSize: "0.9rem", color: "#111", fontWeight: 600, fontFamily: "monospace", letterSpacing: 1 }}>
                  {data.password}
                </div>
              </div>
              <button className={`bv-copy-btn${copied === "password" ? " copied" : ""}`}>
                {copied === "password" ? "✓ Copiado" : "Copiar"}
              </button>
            </div>

            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginTop: 6, flexWrap: "wrap", gap: 4,
            }}>
              <p style={{ fontSize: "0.7rem", color: "#A8A8A2", margin: 0, lineHeight: 1.5 }}>
                También te enviamos estos datos al email
              </p>
              <a
                href="/panel"
                style={{ fontSize: "0.7rem", color: "#F59E1B", fontWeight: 600, textDecoration: "none" }}
              >
                quierocomer.com/panel →
              </a>
            </div>
          </div>

          {/* Steps */}
          <div className="bv-card" style={{
            background: "#fff",
            border: "1.5px solid #ECECEA",
            borderRadius: 20,
            padding: "22px 20px 8px",
            marginBottom: 24,
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#F59E1B", marginBottom: 10,
            }}>
              Primeros pasos
            </div>

            {[
              { icon: "🔑", title: "Ingresa al panel", desc: "Entra con tu email y contraseña para empezar a configurar tu local." },
              { icon: "🍽️", title: "Agrega tus platos", desc: "Sube fotos, precios y descripciones desde el panel." },
              { icon: "📱", title: "Genera tu QR", desc: "Descárgalo e imprímelo para tus mesas y redes sociales." },
            ].map((step, i) => (
              <div key={i} className="bv-step">
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: "#FFF7EA",
                  border: "1.5px solid rgba(245,158,27,0.2)", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "1.1rem", flexShrink: 0,
                }}>
                  {step.icon}
                </div>
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#111", marginBottom: 2 }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#71716C", lineHeight: 1.55 }}>
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
                background: "#F59E1B",
                color: "#fff",
                textAlign: "center",
                padding: "16px 24px",
                borderRadius: 14,
                fontWeight: 700,
                fontSize: "1rem",
                textDecoration: "none",
                letterSpacing: 0.2,
                boxShadow: "0 4px 20px rgba(245,158,27,0.25)",
              }}
            >
              Entrar a mi panel →
            </a>
          </div>

        </div>
      </div>
    </>
  );
}
