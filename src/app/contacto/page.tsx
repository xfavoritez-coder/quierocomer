"use client";

import { useState, useEffect, useRef } from "react";
import Footer from "@/components/Footer";
import NavHamburger from "@/components/NavHamburger";

const TURNSTILE_SITE_KEY = "0x4AAAAAADSgtS72cIgDXl7r";

export default function ContactoPage() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cfToken, setCfToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.getElementById("cf-turnstile-script")) return;
    const s = document.createElement("script");
    s.id = "cf-turnstile-script";
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => {
      if (turnstileRef.current && (window as any).turnstile) {
        (window as any).turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token: string) => setCfToken(token),
        });
      }
    };
    document.head.appendChild(s);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || !mensaje.trim()) {
      setError("Completa tu correo y mensaje.");
      return;
    }
    if (!cfToken) {
      setError("Completa la verificación de seguridad.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/landing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nombre, telefono, mensaje, cfToken }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError("No se pudo enviar. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="grain" />

      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        padding: "20px clamp(22px,4vw,64px)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(10,9,8,.85)", backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <a href="/" style={{
          fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600,
          color: "#E8DDC8", display: "flex", alignItems: "center", gap: 10,
          letterSpacing: ".02em", textDecoration: "none",
        }}>
          <img src="/landing/logo.png" alt="" style={{ height: 20, marginRight: -8 }} />
          QuieroComer
        </a>
        <NavHamburger />
      </nav>

      <div className="contacto-hero">
        <img src="/landing/og-hero.png" alt="" className="contacto-hero-img" />
        <div className="contacto-hero-overlay" />
      </div>

      <main className="contacto-main">
        <div className="contacto-glow" />

        <div className="contacto-card">
          {sent ? (
            <div className="contacto-success">
              <div className="success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h2>Mensaje enviado</h2>
              <p>Gracias por escribirnos, te contactaremos pronto.</p>
              <a href="/" className="contacto-home">Volver al inicio</a>
            </div>
          ) : (
            <>
              <div className="contacto-header">
                <div className="contacto-eyebrow">Contáctanos</div>
                <h1>Hablemos</h1>
                <p style={{ fontSize: 14, color: "rgba(200,185,160,.4)" }}>Cuéntanos en qué podemos ayudarte.</p>
              </div>

              <form onSubmit={handleSubmit} className="contacto-form">
                <div className="contacto-field">
                  <label>Nombre</label>
                  <input
                    type="text"
                    placeholder="Tu nombre o el de tu local"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>
                <div className="contacto-field">
                  <label>Correo electrónico</label>
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    required
                  />
                </div>
                <div className="contacto-field">
                  <label>Teléfono <span style={{ opacity: 0.4, textTransform: "none", fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                </div>
                <div className="contacto-field">
                  <label>Mensaje</label>
                  <textarea
                    placeholder="Cuéntanos en qué te podemos ayudar"
                    value={mensaje}
                    onChange={(e) => { setMensaje(e.target.value); setError(""); }}
                    rows={4}
                    required
                  />
                </div>

                <div ref={turnstileRef} style={{ display: "flex", justifyContent: "center", margin: "4px 0" }} />

                {error && <div className="contacto-error">{error}</div>}

                <button type="submit" className="contacto-submit" disabled={sending || !cfToken}>
                  {sending ? "Enviando..." : "Enviar mensaje"} <span>→</span>
                </button>
              </form>

              <div className="contacto-alt">
                <p>También puedes escribirnos a</p>
                <a href="mailto:hola@quierocomer.cl">hola@quierocomer.cl</a>
                <p style={{ marginTop: 10 }}>Santiago, Chile</p>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}

const STYLES = `
:root {
  --black:#0A0908;--amber:#E8A33D;--amber-bright:#F4B962;
  --cream:#E8DDC8;--cream-soft:#C9BBA0;--gray-warm:#7D7366;
  --font-display:'Cormorant Garamond',serif;--font-body:'Inter',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--black)!important;color:var(--cream)!important;font-family:var(--font-body)!important;-webkit-font-smoothing:antialiased}
.grain{position:fixed;inset:0;pointer-events:none;z-index:30;opacity:.13;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E")}
.contacto-nav{position:fixed;top:0;left:0;right:0;z-index:1000;padding:20px clamp(22px,4vw,64px);display:flex;justify-content:space-between;align-items:center;background:rgba(10,9,8,.85);backdrop-filter:blur(12px)}
.contacto-logo{font-family:var(--font-display);font-size:20px;font-weight:600;color:var(--cream);display:flex;align-items:center;gap:10px;letter-spacing:.02em;text-decoration:none}
.contacto-back{color:var(--cream-soft);font-size:13px;text-decoration:none;letter-spacing:.04em;transition:.2s}
.contacto-back:hover{color:var(--amber)}
.contacto-hero{position:relative;width:100%;height:220px;overflow:hidden;margin-top:0}
.contacto-hero-img{width:100%;height:100%;object-fit:cover;object-position:center 35%;filter:brightness(.55)}
.contacto-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,9,8,.3) 0%,rgba(10,9,8,.95) 85%,var(--black) 100%)}
.contacto-main{display:flex;align-items:flex-start;justify-content:center;padding:0 20px 60px;position:relative;overflow:hidden;margin-top:-70px;z-index:2}
.contacto-glow{position:absolute;top:30%;left:50%;transform:translateX(-50%);width:500px;height:500px;background:radial-gradient(circle,rgba(232,163,61,.08),transparent 60%);pointer-events:none}
.contacto-card{width:min(100%,480px);background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:24px;padding:36px 28px;position:relative;box-shadow:0 30px 80px rgba(0,0,0,.3)}
.contacto-header{text-align:center;margin-bottom:28px}
.contacto-eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--amber);font-weight:600;margin-bottom:14px}
.contacto-header h1{font-family:var(--font-display);font-size:clamp(32px,6vw,46px);line-height:1.05;font-weight:400;margin-bottom:10px}
.contacto-form{display:flex;flex-direction:column;gap:14px}
.contacto-field{display:flex;flex-direction:column;gap:5px}
.contacto-field label{font-size:12px;font-weight:600;color:var(--cream-soft);letter-spacing:.04em;text-transform:uppercase}
.contacto-field input,.contacto-field textarea{width:100%;padding:13px 16px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.08);border-radius:14px;color:var(--cream);font-family:var(--font-body);font-size:15px;outline:none;transition:.2s;resize:none}
.contacto-field input::placeholder,.contacto-field textarea::placeholder{color:rgba(100,90,75,.55)!important}
.contacto-field input:focus,.contacto-field textarea:focus{border-color:var(--amber);box-shadow:0 0 0 3px rgba(232,163,61,.08)}
.contacto-error{color:#e85d5d;font-size:13px;text-align:center}
.contacto-submit{margin-top:4px;width:100%;padding:15px;background:var(--amber);color:var(--black);font-size:15px;font-weight:700;border:none;border-radius:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:.2s}
.contacto-submit:hover:not(:disabled){background:var(--amber-bright);transform:translateY(-1px)}
.contacto-submit:disabled{opacity:.6;cursor:default}
.contacto-alt{text-align:center;margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.06)}
.contacto-alt p{font-size:12px;color:var(--cream-soft);opacity:.5;margin-bottom:4px}
.contacto-alt a{font-size:14px;color:var(--amber);text-decoration:none;font-weight:600}
.contacto-alt a:hover{text-decoration:underline}
.contacto-success{text-align:center;padding:20px 0}
.success-icon{width:56px;height:56px;border-radius:50%;background:rgba(232,163,61,.1);border:1px solid rgba(232,163,61,.2);display:grid;place-items:center;margin:0 auto 16px}
.contacto-success h2{font-family:var(--font-display);font-size:28px;font-weight:400;margin-bottom:10px}
.contacto-success p{font-size:14px;color:var(--cream-soft);line-height:1.5;margin-bottom:20px}
.contacto-home{display:inline-block;padding:12px 28px;background:rgba(232,163,61,.1);border:1px solid rgba(232,163,61,.2);color:var(--amber);font-size:14px;font-weight:600;text-decoration:none;border-radius:12px;transition:.2s}
.contacto-home:hover{background:var(--amber);color:var(--black)}
`;
