"use client";

import { useEffect, useState } from "react";
import Footer from "@/components/Footer";
import NavHamburger from "@/components/NavHamburger";

export default function PlanesClient() {
  const [isMobile, setIsMobile] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalPlan, setModalPlan] = useState<string>("");
  const [localName, setLocalName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 9);
    if (d.length <= 1) return d;
    if (d.length <= 5) return `${d[0]} ${d.slice(1)}`;
    return `${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`;
  };
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const openModal = (plan: string) => {
    setModalPlan(plan);
    setShowModal(true);
    setError("");
  };

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localName.trim() || !email.includes("@")) {
      setError("Completa nombre del local y email.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/activar/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localName: localName.trim(), ownerName: ownerName.trim(), email: email.trim(), whatsapp: `+56${whatsapp.replace(/\s/g, "").replace(/^\+?56/, "")}` }),
      });
      const data = await res.json();
      if (!res.ok || !data.slug) throw new Error(data.error || "Error");
      window.location.href = `/registrar/${data.slug}?plan=${modalPlan}`;
    } catch (err: any) {
      setError(err?.message || "Error al registrar. Intenta de nuevo.");
      setSending(false);
    }
  };

  // Tip toggle
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const tip = (e.target as HTMLElement).closest(".qc-tip");
      if (tip) {
        e.preventDefault();
        const wasOpen = tip.classList.contains("open");
        document.querySelectorAll(".qc-tip.open").forEach(t => t.classList.remove("open"));
        if (!wasOpen) tip.classList.add("open");
      } else {
        document.querySelectorAll(".qc-tip.open").forEach(t => t.classList.remove("open"));
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

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

      {/* Hero */}
      <header style={{ position: "relative", minHeight: 540, display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden", padding: "60px 0 60px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/landing/estoes.png')", backgroundSize: "cover", backgroundPosition: "center bottom", filter: "saturate(.85) brightness(.75)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(10,9,8,.2) 0%,rgba(10,9,8,.5) 35%,rgba(10,9,8,.9) 70%,#0A0908 100%),linear-gradient(90deg,rgba(10,9,8,.7) 0%,rgba(10,9,8,.2) 50%,transparent 100%)" }} />
        <div id="pl-hero-text">
          <style dangerouslySetInnerHTML={{ __html: "#pl-hero-text{position:relative;z-index:2;max-width:1100px;margin:0 auto;padding:0 20px;text-align:center;display:flex;flex-direction:column;align-items:center}" }} />
          <div className="planes-eyebrow">Planes</div>
          <h1 id="pl-hero-h1">
            El plan perfecto para <br className="pl-mobile-br" /><span style={{ color: "#E8A33D", fontStyle: "italic" }}>tu restaurante</span>
          </h1>
          <p id="pl-hero-sub">Cambia cuando quieras. Sin permanencia.</p>
          <style dangerouslySetInnerHTML={{ __html: "#pl-hero-h1{font-family:'Cormorant Garamond',serif;font-size:clamp(38px,8vw,62px);line-height:1.02;font-weight:400;max-width:480px;margin:0 0 16px}#pl-hero-sub{font-size:15px;color:#B7A993;max-width:380px;line-height:1.5;margin:0}" }} />
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px 60px", marginTop: -120, position: "relative", overflow: "hidden" }}>

        <div className="qc-plans">
          <article className="qc-plan">
            <h3>Gratis</h3>
            <div className="qc-plan-price">$0</div>
            <p>Para comenzar.</p>
            <div className="qc-checks">
              <div>✓ Carta digital con QR <span className="qc-tip">i<span className="qc-tip-text">Tu carta lista para que tus clientes la escaneen desde la mesa</span></span></div>
              <div>✓ Vista Lista <span className="qc-tip">i<span className="qc-tip-text">Tus platos organizados por categoría en formato lista clásico</span></span></div>
              <div>✓ Panel para editar tu carta <span className="qc-tip">i<span className="qc-tip-text">Cambia platos, precios, fotos y categorías cuando quieras</span></span></div>
              <div>✓ Hasta 10 clientes captados <span className="qc-tip">i<span className="qc-tip-text">Captura datos de hasta 10 clientes que escanean tu carta</span></span></div>
            </div>
            <button className="qc-plan-btn" onClick={() => openModal("FREE")}>Comenzar gratis</button>
          </article>

          <article className="qc-plan qc-gold">
            <h3>Gold</h3>
            <div className="qc-plan-price">$35.000<small>/mes + IVA</small></div>
            <p>Para crecer tu restaurante.</p>
            <div className="qc-checks">
              <div>✓ Todo lo del plan Gratis</div>
              <div>✓ El Genio IA <span className="qc-tip">i<span className="qc-tip-text">Un asistente inteligente que reordena tu carta según los gustos de cada cliente</span></span></div>
              <div>✓ Ofertas y promociones <span className="qc-tip">i<span className="qc-tip-text">Crea ofertas temporales que aparecen directo en la carta de tus clientes</span></span></div>
              <div>✓ Vistas Lista + Galería <span className="qc-tip">i<span className="qc-tip-text">Dos formas de mostrar tu carta: lista clásica y galería con fotos grandes</span></span></div>
              <div>✓ Estadísticas de tu carta <span className="qc-tip">i<span className="qc-tip-text">Ve cuántas personas visitan tu carta, qué platos miran más y en qué horarios</span></span></div>
              <div>✓ Anuncios dentro de la carta <span className="qc-tip">i<span className="qc-tip-text">Destaca platos o muestra banners promocionales que tus clientes ven al navegar</span></span></div>
            </div>
            <button className="qc-plan-btn" onClick={() => openModal("GOLD")}>Elegir Gold</button>
          </article>

          <article className="qc-plan qc-featured">
            <div className="qc-badge">Más elegido</div>
            <h3>Premium</h3>
            <div className="qc-plan-price">$49.900<small>/mes + IVA</small></div>
            <p>Para restaurantes que quieren vender más.</p>
            <div className="qc-checks">
              <div>✓ Todo lo de Gold</div>
              <div>✓ Vistas Lista + Galería + Impact <span className="qc-tip">i<span className="qc-tip-text">Tres diseños distintos para tu carta: lista clásica, galería con fotos y la vista Impact</span></span></div>
              <div>✓ Estadísticas avanzadas <span className="qc-tip">i<span className="qc-tip-text">Platos más vistos, horarios pico, tendencias semanales y comparativas</span></span></div>
              <div>✓ Botón llamar garzón <span className="qc-tip">i<span className="qc-tip-text">Tus clientes llaman al garzón desde la carta con un toque</span></span></div>
              <div>✓ Carta en varios idiomas <span className="qc-tip">i<span className="qc-tip-text">Tu carta se traduce automáticamente a inglés, portugués y más</span></span></div>
              <div>✓ Cumpleaños automáticos <span className="qc-tip">i<span className="qc-tip-text">El sistema detecta clientes que cumplen años y les envía una invitación especial</span></span></div>
              <div>✓ Clientes captados ilimitados <span className="qc-tip">i<span className="qc-tip-text">Registra todos los clientes que escanean tu carta, sin límite</span></span></div>
              <div>✓ Email marketing <span className="qc-tip">i<span className="qc-tip-text">Envía campañas y novedades por email a toda tu base de clientes</span></span></div>
              <div>✓ Integración con Toteat <span className="qc-tip">i<span className="qc-tip-text">Conecta tu POS Toteat para sincronizar carta, ver ventas reales y cruzar datos</span></span></div>
            </div>
            <button className="qc-plan-btn" onClick={() => openModal("PREMIUM")}>Activar Premium</button>
          </article>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, padding: "18px 0", borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <p style={{ fontSize: 14, color: "#C9BBA0", marginBottom: 8 }}>¿Ya tienes tu carta en otra plataforma o de forma física?</p>
          <a href="/subircarta" style={{ color: "#E8A33D", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
            Sube tu carta y la importamos gratis →
          </a>
        </div>

      </main>

      {/* Modal de registro */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(100%,400px)", background: "#141210", border: "1px solid rgba(255,255,255,.08)", borderRadius: 24, padding: "32px 24px", position: "relative" }}>
            <button onClick={() => setShowModal(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#9B8E7A", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: "#E8A33D", fontWeight: 700, marginBottom: 8 }}>
                {modalPlan === "FREE" ? "Plan Gratis" : modalPlan === "GOLD" ? "Plan Gold" : "Plan Premium"}
              </div>
              <h2 style={{ fontFamily: "Georgia,serif", fontSize: 24, fontWeight: 400, color: "#E8DDC8", margin: 0 }}>Crea tu cuenta</h2>
              <p style={{ fontSize: 13, color: "#9B8E7A", marginTop: 6 }}>En 30 segundos tienes tu carta lista para agregar tus platos.</p>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `.qc-modal-input::placeholder{color:rgba(140,125,100,.45)!important}` }} />
            <form onSubmit={handleRegistrar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#C9BBA0", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4, display: "block" }}>Nombre del local</label>
                <input className="qc-modal-input" type="text" placeholder="Pizzería Don Mario" value={localName} onChange={(e) => setLocalName(e.target.value)} required style={{ width: "100%", padding: "12px 14px", background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, color: "#E8DDC8", fontSize: 15, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#C9BBA0", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4, display: "block" }}>Tu nombre</label>
                <input className="qc-modal-input" type="text" placeholder="Mario González" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} style={{ width: "100%", padding: "12px 14px", background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, color: "#E8DDC8", fontSize: 15, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#C9BBA0", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4, display: "block" }}>Correo electrónico</label>
                <input className="qc-modal-input" type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%", padding: "12px 14px", background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, color: "#E8DDC8", fontSize: 15, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#C9BBA0", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4, display: "block" }}>WhatsApp</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, color: "#E8DDC8", fontSize: 14, flexShrink: 0, cursor: "default" }}>
                    <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}><rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="7" fill="#D52B1E"/><rect width="7" height="7" fill="#0039A6"/><polygon points="3.5,1.5 4.1,3.3 6,3.3 4.5,4.4 5,6.2 3.5,5.1 2,6.2 2.5,4.4 1,3.3 2.9,3.3" fill="#fff"/></svg>
                    <span style={{ fontWeight: 600 }}>+56</span>
                  </div>
                  <input className="qc-modal-input" type="tel" placeholder="9 1234 5678" value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} required style={{ width: "100%", padding: "12px 14px", background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, color: "#E8DDC8", fontSize: 15, outline: "none" }} />
                </div>
              </div>

              {error && <div style={{ color: "#e85d5d", fontSize: 13, textAlign: "center" }}>{error}</div>}

              <button type="submit" disabled={sending} style={{ marginTop: 4, width: "100%", padding: 15, background: "linear-gradient(135deg,#ffc44f,#f3a333)", color: "#100b03", border: "none", borderRadius: 999, fontSize: 15, fontWeight: 900, cursor: sending ? "wait" : "pointer", opacity: sending ? 0.6 : 1, boxShadow: "0 12px 28px rgba(245,164,51,.22)" }}>
                {sending ? "Creando..." : "Continuar"}
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

const STYLES = `
.pl-hero{position:relative;min-height:480px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;padding:140px 0 80px}
.pl-hero-bg{position:absolute;inset:0;background:url('/landing/estoes.png') center/cover;filter:saturate(.85) brightness(.75);z-index:-3}
.pl-hero-after{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,9,8,.2) 0%,rgba(10,9,8,.5) 35%,rgba(10,9,8,.9) 70%,#0A0908 100%),linear-gradient(90deg,rgba(10,9,8,.7) 0%,rgba(10,9,8,.2) 50%,transparent 100%);z-index:-2}
.pl-hero-content{max-width:1100px;margin:0 auto;padding:0 clamp(22px,4vw,64px);text-align:left}
body{background:#0A0908!important;color:#E8DDC8!important;font-family:'Inter',sans-serif!important}
.grain{position:fixed;inset:0;pointer-events:none;z-index:30;opacity:.13;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E")}
.planes-main{max-width:1100px;margin:0 auto;padding:110px 20px 60px;position:relative;z-index:1}
.planes-glow{position:absolute;top:10%;left:50%;transform:translateX(-50%);width:600px;height:400px;background:radial-gradient(circle,rgba(232,163,61,.08),transparent 60%);pointer-events:none}
.planes-header{text-align:center;margin-bottom:40px;position:relative}
.planes-eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#E8A33D;font-weight:600;margin-bottom:14px}
.planes-header h1{font-family:'Cormorant Garamond',serif;font-size:clamp(32px,5vw,50px);line-height:1.05;font-weight:400;margin-bottom:12px}
.planes-header h1 span{color:#E8A33D;font-style:italic}
.planes-header p{font-size:14px;color:#C9BBA0;opacity:.6}
.qc-plans{display:grid;gap:14px;position:relative}
.qc-plan{border-radius:25px;padding:20px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.10);position:relative}
.qc-plan.qc-gold{border-color:rgba(255,178,45,.22)}
.qc-plan.qc-gold h3{color:#E8A33D}
.qc-plan.qc-featured{border-color:rgba(255,178,45,.55);background:linear-gradient(135deg,rgba(255,178,45,.13),rgba(255,255,255,.035)),#0c0c0c;box-shadow:0 0 32px rgba(255,178,45,.10)}
.qc-plan.qc-featured h3{color:#E8A33D}
.qc-badge{position:absolute;right:16px;top:16px;border-radius:999px;padding:7px 10px;color:#ffd38a;background:rgba(255,178,45,.14);font-size:10px;font-weight:950}
.qc-plan h3{margin:0 0 10px;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#E8DDC8}
.qc-plan-price{font-size:30px;font-weight:950;margin-bottom:8px}
.qc-plan-price small{font-size:12px;color:#C9BBA0}
.qc-plan.qc-featured .qc-plan-price{color:#E8A33D}
.qc-plan p{margin:0 0 14px;color:#C9BBA0;font-size:13px;line-height:1.4}
.qc-checks{display:grid;gap:8px;margin-bottom:16px}
.qc-checks > div{color:#E8DDC8;font-size:14px;display:flex;align-items:center;gap:4px}
.qc-tip{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;border-radius:50%;background:rgba(232,163,61,.12);color:#E8A33D;font-size:10px;font-weight:800;font-style:italic;cursor:pointer;flex-shrink:0;position:relative;-webkit-tap-highlight-color:transparent}
.qc-tip.open .qc-tip-text{display:block}
.qc-tip-text{display:none;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(232,163,61,.25);border-radius:8px;padding:10px 12px;font-size:13px;font-weight:400;font-style:normal;color:#C9BBA0;width:200px;text-align:left;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,.5);line-height:1.4}
.qc-plan-btn{display:block;width:100%;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#E8DDC8;padding:14px 15px;font-weight:950;cursor:pointer;font-size:14px;text-align:center;text-decoration:none;transition:.2s;font-family:inherit}
.qc-plan-btn:hover{background:rgba(255,255,255,.12);transform:translateY(-1px)}
.qc-plan.qc-featured .qc-plan-btn{background:linear-gradient(135deg,#ffc44f,#f3a333);color:#100b03;border:0}
.qc-plan.qc-featured .qc-plan-btn:hover{background:linear-gradient(135deg,#ffd76b,#f5b84a)}
.planes-bottom{text-align:center;margin-top:32px;position:relative}
.planes-bottom p{font-size:14px;color:#C9BBA0;opacity:.6}
.planes-bottom a{color:#E8A33D;text-decoration:none;font-weight:600}
.planes-bottom a:hover{text-decoration:underline}
.pl-hero-wrap{position:relative;z-index:2;max-width:1100px;margin:0 auto;padding:0 20px;text-align:center;display:flex;flex-direction:column;align-items:center}
@media(min-width:700px){.pl-mobile-br{display:none}}
@media(max-width:699px){.pl-hero-wrap{text-align:left;align-items:flex-start}}
@media(min-width:768px){.qc-plans{grid-template-columns:repeat(3,1fr)}}
`;
