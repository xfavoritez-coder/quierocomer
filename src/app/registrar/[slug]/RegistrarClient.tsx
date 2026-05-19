"use client";

import { useState, useEffect } from "react";
import Footer from "@/components/Footer";
import NavHamburger from "@/components/NavHamburger";

interface ShowcaseVenue {
  name: string; slug: string; logoUrl: string | null;
  categories: string[];
  dishes: { name: string; price: number; photo: string | null; description: string }[];
}

interface Props {
  restaurant: { id: string; name: string; slug: string };
  showcaseVenues: ShowcaseVenue[];
}

function formatPrice(price: number) {
  return "$" + Math.round(price).toLocaleString("es-CL");
}

const PLAN_INFO: Record<string, { label: string; price: string; priceSub: string; desc: string; features: { icon: string; title: string; desc: string }[] }> = {
  FREE: {
    label: "Gratis", price: "$0", priceSub: "gratis para siempre",
    desc: "Carta digital con QR y panel para editar cuando quieras.",
    features: [
      { icon: "📱", title: "Carta digital con QR", desc: "Tus clientes escanean y ven tu carta al instante." },
      { icon: "✏️", title: "Panel autoadministrable", desc: "Edita precios, fotos y categorías cuando quieras." },
      { icon: "👥", title: "Hasta 10 clientes captados", desc: "Captura datos de tus primeros clientes." },
      { icon: "🖨️", title: "QR descargable", desc: "Imprime tu código QR y ponlo en las mesas." },
    ],
  },
  GOLD: {
    label: "Gold", price: "$35.000", priceSub: "CLP / mes + IVA",
    desc: "Genio IA, ofertas, estadísticas y más para hacer crecer tu restaurante.",
    features: [
      { icon: "🧠", title: "El Genio IA reordena por ti", desc: "Destaca los platos que tus clientes más prefieren." },
      { icon: "📊", title: "Descubre qué vende más", desc: "Estadísticas claras para tomar mejores decisiones." },
      { icon: "🏷️", title: "Crea ofertas que atraen", desc: "Promociones visibles que aumentan tus ventas." },
      { icon: "📣", title: "Anuncios en tu carta", desc: "Comunica novedades, eventos y más." },
    ],
  },
  PREMIUM: {
    label: "Premium", price: "$49.900", priceSub: "CLP / mes + IVA",
    desc: "Multidioma, estadísticas avanzadas, cumpleaños, email marketing y más.",
    features: [
      { icon: "🌍", title: "Carta en varios idiomas", desc: "Español, inglés y portugués automáticos para turistas." },
      { icon: "📊", title: "Descubre qué vende más", desc: "Platos más vistos, horarios de mayor demanda y tendencias semanales." },
{ icon: "🎂", title: "Cumpleaños automáticos", desc: "Registramos automáticamente sus cumpleaños y les enviamos una invitación especial ese día." },
      { icon: "✉️", title: "Email marketing", desc: "Envía campañas y novedades a todos tus clientes." },
    ],
  },
};

export default function RegistrarClient({ restaurant, showcaseVenues }: Props) {
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [venueIdx, setVenueIdx] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);
  const [confirmPlan, setConfirmPlan] = useState<"GOLD" | "PREMIUM" | null>(null);

  const PLAN_PRICING: Record<string, { label: string; neto: number; iva: number; total: number }> = {
    GOLD: { label: "Gold", neto: 35000, iva: 6650, total: 41650 },
    PREMIUM: { label: "Premium", neto: 49900, iva: 9481, total: 59381 },
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("plan");
    setPlan(p && PLAN_INFO[p] ? p : "PREMIUM");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (showcaseVenues.length <= 1) return;
    const interval = setInterval(() => setVenueIdx(i => (i + 1) % showcaseVenues.length), 4000);
    return () => clearInterval(interval);
  }, [showcaseVenues.length]);

  useEffect(() => {
    const venue = showcaseVenues[venueIdx];
    if (!venue || venue.dishes.length <= 1) return;
    const interval = setInterval(() => setHeroIdx(i => (i + 1) % venue.dishes.length), 5000);
    return () => clearInterval(interval);
  }, [venueIdx, showcaseVenues]);

  const venue = showcaseVenues[venueIdx] || null;
  const dishes = venue?.dishes || [];
  const info = PLAN_INFO[plan || "PREMIUM"] || PLAN_INFO.PREMIUM;
  if (!plan) return <><style dangerouslySetInnerHTML={{ __html: CSS }} /><div style={{ minHeight: "100vh", background: "var(--black)" }} /></>;

  const handleActivar = async () => {
    if (plan !== "FREE" && !confirmPlan) {
      setConfirmPlan(plan as "GOLD" | "PREMIUM");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (plan === "FREE") {
        const res = await fetch("/api/activar/free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: restaurant.id }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error");
        window.location.href = `/activar/${restaurant.slug}/exito?plan=FREE`;
        return;
      }
      const res = await fetch("/api/activar/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurant.id, plan, skipPromo: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Error iniciando pago");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Hubo un error. Intenta nuevamente.");
      setConfirmPlan(null);
      setLoading(false);
    }
  };

  const heroDish = dishes[heroIdx % (dishes.length || 1)];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Header */}
      <header className="rg-header">
        <a className="rg-brand" href="/">
          <img src="/landing/logo.png" alt="" style={{ height: 16 }} />
          QuieroComer
        </a>
        <NavHamburger />
      </header>

      <main className="rg-page">

        {/* Steps */}
        <section className="rg-steps">
          <div className="rg-step-pill">PLAN {info.label.toUpperCase()}</div>
          <div className="rg-step-line">
            <span>✓ Cuenta creada</span>
            <span>✓ Datos completados</span>
            <span><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", border: "1px solid var(--gold)", color: "var(--gold)", fontSize: 11, fontWeight: 900, marginRight: 4 }}>3</span> Activar carta</span>
          </div>
        </section>

        {/* Hero text — full width */}
        <section className="rg-hero">
          <h1>Estás a un paso de tener tu nueva <span>carta QR</span></h1>
          <p>
            Actívala ahora y empieza a recibir en <strong>{restaurant.name}</strong> más clientes con una carta digital profesional.
          </p>
        </section>

        <section className="rg-main-grid">
          {/* Left: phone */}
          <div>
            {venue && (
              <div className="rg-phone-wrap">
                <div className="rg-phone">
                  <div className="rg-screen">
                    <div className="rg-food-img" style={{ backgroundImage: heroDish?.photo ? `linear-gradient(to bottom, transparent 45%, rgba(0,0,0,.86)), url(${heroDish.photo})` : undefined }}>
                      <div className="rg-tag">Destacado</div>
                      <h3>{heroDish?.name || venue.name}</h3>
                      {heroDish?.description && <small>{heroDish.description}</small>}
                      {heroDish?.price && <div className="rg-price">{formatPrice(heroDish.price)}</div>}
                    </div>

                    <div className="rg-tabs">
                      {venue.categories.slice(0, 3).map((c, i) => (
                        <span key={i} className={i === 0 ? "active" : ""}>{c}</span>
                      ))}
                    </div>

                    {dishes.slice(0, 3).map((d, i) => (
                      <div key={i} className="rg-item">
                        {d.photo ? (
                          <img src={d.photo} alt="" />
                        ) : (
                          <div style={{ width: 42, height: 42, borderRadius: 10, background: "#1a1a1a", flexShrink: 0 }} />
                        )}
                        <div>
                          <strong>{d.name}</strong>
                          <small>{formatPrice(d.price)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rg-metric">
                  <strong>+12 clientes</strong><br />
                  vieron tu carta hoy
                </div>
              </div>
            )}

            {/* Línea conectora vertical (mobile) */}
            <div className="rg-connector-v">
              <div className="rg-connector-line" />
              <div className="rg-connector-arrow" />
            </div>
          </div>

          {/* Right: connector horizontal (desktop) + checkout */}
          <div className="rg-right-col">
            <div className="rg-connector-h" />
            <section className="rg-checkout">
            <div className="rg-plan-label">PLAN {info.label.toUpperCase()}</div>
            <div className="rg-price-row"><span className="rg-price-main">{info.price}</span> <span className="rg-price-sub">{info.priceSub}</span></div>

            <div className="rg-divider" />

            <div className="rg-benefit">
              <div className="rg-check">✓</div>
              <div>Activación inmediata<small>Tu carta online en minutos.</small></div>
            </div>
            <div className="rg-benefit">
              <div className="rg-check">✓</div>
              <div>Panel para editar todo<small>Agrega platos, fotos y precios cuando quieras.</small></div>
            </div>
            <div className="rg-benefit">
              <div className="rg-check">✓</div>
              <div>Soporte personalizado<small>Te ayudamos a configurar tu carta paso a paso.</small></div>
            </div>
            <div className="rg-benefit">
              <div className="rg-check">✓</div>
              <div>Cancela o cambia de plan cuando quieras<small>Sin contratos ni compromisos.</small></div>
            </div>

            {error && <div className="rg-error">{error}</div>}

            {!done ? (
              <button className="rg-cta" disabled={loading} onClick={handleActivar}>
                {loading ? "Procesando..." : plan === "FREE" ? "Activar gratis" : `Activar mi carta`}
              </button>
            ) : (
              <div className="rg-done">Activado. Redirigiendo...</div>
            )}

            <div className="rg-secure"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Pago 100% seguro · vía <svg width="12" height="12" viewBox="0 0 48 48" style={{ display: "inline", verticalAlign: "-2px", marginLeft: 3 }}><circle cx="24" cy="24" r="24" fill="#009ee3"/><path d="M15.8 19.5c0-1 .4-1.9 1-2.6a3.7 3.7 0 0 1 2.7-1.1c1 0 1.9.4 2.6 1.1.7.7 1.1 1.6 1.1 2.6v8.9h-7.4v-8.9zm9.8 0c0-1 .4-1.9 1.1-2.6a3.7 3.7 0 0 1 2.6-1.1c1 0 2 .4 2.7 1.1.7.7 1 1.6 1 2.6v8.9h-7.4v-8.9z" fill="#fff"/></svg> MercadoPago</div>
          </section>
          </div>
        </section>

        {/* Features */}
        <h2 className="rg-section-title">
          Con Plan {info.label}, tu carta <br className="rg-mobile-br" /><span>trabaja por ti</span>
        </h2>

        <section className="rg-features">
          {info.features.map((f, i) => (
            <article key={i} className="rg-feature">
              <div className="rg-icon">{f.icon}</div>
              <div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </article>
          ))}
        </section>

        {/* Social proof */}
        <section className="rg-proof">
          <h2>Restaurantes en Santiago que ya están creciendo con <span style={{ color: "var(--muted)" }}>QuieroComer</span></h2>
          <div className="rg-logos">
            {showcaseVenues.slice(0, 4).map((v, i) => (
              <a key={i} href={`/qr/${v.slug}`} target="_blank" rel="noopener" className="rg-logo-circle">
                {v.logoUrl ? <img src={v.logoUrl} alt={v.name} /> : v.name.split(" ")[0]}
              </a>
            ))}
          </div>
          <div className="rg-alt-link" style={{ marginTop: 16 }}>
            ¿Ya tienes carta QR o física?<br /><a href="/subircarta"><span style={{ textDecoration: "underline" }}>Súbela y te la transformamos</span> →</a>
          </div>
        </section>
      </main>

      <Footer />

      {/* Modal resumen de pago */}
      {confirmPlan && (() => {
        const p = PLAN_PRICING[confirmPlan];
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => { if (!loading) setConfirmPlan(null); }}>
            <div style={{ background: "#111", border: "1px solid rgba(255,255,255,.1)", borderRadius: 24, width: "100%", maxWidth: 380, padding: "28px 24px", position: "relative" }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setConfirmPlan(null)} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>×</button>

              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: "#E8A33D", fontWeight: 700, marginBottom: 8 }}>Resumen de pago</div>
                <h3 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, color: "#E8DDC8", margin: 0 }}>Plan {p.label}</h3>
              </div>

              <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "#C9BBA0" }}>
                  <span>Mensualidad</span>
                  <span style={{ fontWeight: 700 }}>${p.neto.toLocaleString("es-CL")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "#888" }}>
                  <span>IVA (19%)</span>
                  <span>${p.iva.toLocaleString("es-CL")}</span>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "#E8DDC8" }}>
                  <span>Total</span>
                  <span>${p.total.toLocaleString("es-CL")} CLP</span>
                </div>
              </div>

              <div style={{ fontSize: 12, color: "#888", textAlign: "center", marginBottom: 16 }}>
                Serás redirigido a MercadoPago para completar tu pago de forma segura.
              </div>

              {error && <div style={{ color: "#e85d5d", fontSize: 13, textAlign: "center", marginBottom: 10 }}>{error}</div>}

              <button
                disabled={loading}
                onClick={() => handleActivar()}
                style={{ width: "100%", padding: 15, background: "linear-gradient(135deg,#ffc44f,#f3a333)", color: "#100b03", border: "none", borderRadius: 999, fontSize: 15, fontWeight: 900, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1, boxShadow: "0 12px 28px rgba(245,164,51,.22)" }}
              >
                {loading ? "Redirigiendo a MercadoPago..." : `Pagar $${p.total.toLocaleString("es-CL")} CLP`}
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, fontSize: 11, color: "#666" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Pago 100% seguro · vía <svg width="12" height="12" viewBox="0 0 48 48" style={{ display: "inline", verticalAlign: "-2px", marginLeft: 3 }}><circle cx="24" cy="24" r="24" fill="#009ee3"/><path d="M15.8 19.5c0-1 .4-1.9 1-2.6a3.7 3.7 0 0 1 2.7-1.1c1 0 1.9.4 2.6 1.1.7.7 1.1 1.6 1.1 2.6v8.9h-7.4v-8.9zm9.8 0c0-1 .4-1.9 1.1-2.6a3.7 3.7 0 0 1 2.6-1.1c1 0 2 .4 2.7 1.1.7.7 1 1.6 1 2.6v8.9h-7.4v-8.9z" fill="#fff"/></svg> MercadoPago
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

const CSS = `
:root { --bg:#050505; --card:#11100f; --card-2:#161412; --gold:#f4a623; --gold-soft:#ffc45a; --text:#f5ead8; --muted:#a99d8c; --border:rgba(244,166,35,.28); }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Inter,system-ui,-apple-system,sans-serif; background:radial-gradient(circle at top,rgba(244,166,35,.13),transparent 34%),linear-gradient(180deg,#080706,#030303)!important; color:var(--text)!important; min-height:100vh; }
.rg-page { width:100%; max-width:480px; margin:0 auto; padding:86px 18px 34px; }
.rg-header { position:fixed; top:0; left:0; right:0; z-index:100; display:flex; justify-content:space-between; align-items:center; padding:14px clamp(18px,4vw,64px); background:rgba(10,9,8,.65); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); margin-bottom:0; }
.rg-brand { display:flex; align-items:center; gap:8px; font-family:Georgia,serif; font-size:18px; font-weight:700; color:var(--text); text-decoration:none; }
.rg-steps { text-align:center; margin-bottom:26px; }
.rg-step-pill { display:inline-block; color:var(--gold-soft); border:1px solid var(--border); border-radius:999px; padding:8px 18px; font-size:12px; font-weight:800; letter-spacing:2px; margin-bottom:14px; }
.rg-step-line { display:flex; justify-content:center; gap:12px; font-size:12px; color:var(--muted); flex-wrap:wrap; }
.rg-step-line b { color:var(--gold); }
.rg-hero { text-align:center; margin-bottom:26px; }
.rg-hero h1 { font-family:Georgia,serif; font-size:clamp(36px,11vw,60px); line-height:.95; letter-spacing:-1px; margin-bottom:16px; }
.rg-hero h1 span { color:var(--gold); font-style:italic; font-weight:500; }
.rg-hero p { color:#d8cdbd; font-size:16px; line-height:1.45; max-width:330px; margin:0 auto; }
.rg-hero p strong { color:var(--gold-soft); }
.rg-phone-wrap { position:relative; margin:0 auto 28px; width:270px; filter:drop-shadow(0 26px 55px rgba(244,166,35,.22)); }
.rg-phone { background:#080808; border:8px solid #252525; border-radius:38px; padding:12px; box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 0 80px rgba(244,166,35,.16); }
.rg-screen { overflow:hidden; border-radius:26px; background:#0c0c0c; border:1px solid rgba(255,255,255,.08); }
.rg-food-img { height:170px; background:linear-gradient(to bottom,transparent 45%,rgba(0,0,0,.86)),#1a1a1a; background-size:cover; background-position:center; padding:14px; display:flex; flex-direction:column; justify-content:flex-end; }
.rg-tag { align-self:flex-start; background:var(--gold); color:#17110a; font-size:9px; font-weight:800; padding:4px 7px; border-radius:999px; margin-bottom:8px; }
.rg-food-img h3 { font-size:21px; line-height:1.05; margin-bottom:5px; }
.rg-food-img small { color:#e9dfcf; font-size:11px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rg-price { color:var(--gold); font-weight:800; margin-top:6px; font-size:15px; }
.rg-tabs { display:flex; gap:7px; padding:12px 12px 5px; }
.rg-tabs span { background:#191919; border:1px solid rgba(255,255,255,.08); color:#cfc7ba; padding:7px 10px; border-radius:999px; font-size:11px; white-space:nowrap; }
.rg-tabs span.active { color:var(--gold); border-color:var(--gold); }
.rg-item { display:flex; align-items:center; gap:10px; margin:8px 12px; padding:9px; border-radius:14px; background:#151515; border:1px solid rgba(255,255,255,.06); }
.rg-item img { width:42px; height:42px; border-radius:10px; object-fit:cover; flex-shrink:0; }
.rg-item strong { display:block; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px; }
.rg-item small { color:var(--gold); font-weight:800; }
.rg-metric { position:absolute; right:-20px; top:92px; background:rgba(14,13,12,.92); border:1px solid var(--border); border-radius:16px; padding:12px; width:145px; box-shadow:0 20px 40px rgba(0,0,0,.45); font-size:12px; }
.rg-metric strong { color:var(--gold-soft); }
.rg-checkout { background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.01)),var(--card); border:1px solid var(--border); border-radius:26px; padding:24px 20px; margin-bottom:30px; box-shadow:0 22px 60px rgba(0,0,0,.38); }
.rg-plan-label { color:var(--gold-soft); font-size:12px; font-weight:900; letter-spacing:2px; margin-bottom:10px; }
.rg-price-row { display:flex; align-items:baseline; gap:8px; margin-bottom:20px; }
.rg-price-main { font-size:44px; color:var(--gold-soft); font-weight:900; letter-spacing:-1.5px; }
.rg-price-sub { color:#d8cdbd; font-weight:700; font-size:13px; }
.rg-divider { height:1px; background:rgba(255,255,255,.12); margin:20px 0; }
.rg-benefit { display:flex; gap:11px; margin-bottom:16px; color:#eadfce; font-size:14px; line-height:1.35; }
.rg-benefit small { display:block; color:var(--muted); margin-top:2px; }
.rg-check { width:22px; height:22px; min-width:22px; border-radius:50%; border:1px solid var(--gold); color:var(--gold); display:grid; place-items:center; font-size:13px; font-weight:900; }
.rg-error { background:rgba(232,80,80,.12); border:1px solid rgba(232,80,80,.3); border-radius:12px; padding:10px 14px; margin-bottom:10px; color:#e85d5d; font-size:13px; text-align:center; }
.rg-cta { display:block; width:100%; border:none; border-radius:18px; background:linear-gradient(135deg,#ffd36a,#f4a623); color:#120d06; padding:17px; font-size:16px; font-weight:900; cursor:pointer; margin-top:22px; box-shadow:0 18px 42px rgba(244,166,35,.25); font-family:inherit; }
.rg-cta:disabled { opacity:.6; cursor:wait; }
.rg-done { text-align:center; color:#74e49a; font-weight:700; font-size:16px; padding:14px 0; }
.rg-secure { text-align:center; color:var(--muted); font-size:12px; margin-top:8px; }
.rg-section-title { text-align:center; font-family:Georgia,serif; font-size:30px; margin:28px 0 26px; line-height:1.2; }
.rg-section-title span { color:var(--gold); font-style:italic; }
.rg-features { display:grid; gap:12px; margin-bottom:28px; }
.rg-feature { background:var(--card-2); border:1px solid rgba(255,255,255,.08); border-radius:20px; padding:18px; display:flex; gap:14px; align-items:flex-start; }
.rg-icon { width:44px; height:44px; min-width:44px; border-radius:15px; background:rgba(244,166,35,.1); border:1px solid var(--border); display:grid; place-items:center; color:var(--gold); font-size:21px; }
.rg-feature h3 { font-size:15px; font-weight:800; margin-bottom:5px; }
.rg-feature p { font-size:14px; color:var(--muted); line-height:1.4; }
.rg-proof { border:1px solid rgba(244,166,35,.18); background:rgba(255,255,255,.03); border-radius:24px; padding:22px 18px; text-align:center; margin-top:26px; }
.rg-proof h2 { font-size:18px; color:var(--muted); margin-bottom:18px; font-family:Georgia,serif; font-weight:400; }
.rg-logos { display:flex; justify-content:center; gap:12px; flex-wrap:wrap; padding:12px 0; }
.rg-logo-circle { width:66px; height:66px; border-radius:50%; border:1px solid var(--border); display:grid; place-items:center; font-family:Georgia,serif; font-size:10px; color:#eadfce; background:#111; overflow:hidden; }
.rg-logo-circle img { width:100%; height:100%; object-fit:cover; }
.rg-alt-link { text-align:center; }
.rg-alt-link a { color:rgba(160,145,120,.75); font-size:14px; text-decoration:none; font-weight:500; }
.rg-connector-v { width:1px; height:42px; margin:14px auto 0; background:linear-gradient(to bottom,rgba(255,178,45,0),rgba(255,178,45,.7)); position:relative; z-index:2; }
.rg-connector-v::after { content:""; position:absolute; bottom:-5px; left:50%; width:9px; height:9px; border-right:1px solid rgba(255,178,45,.85); border-bottom:1px solid rgba(255,178,45,.85); transform:translateX(-50%) rotate(45deg); }
.rg-connector-h { display:none; }
.rg-right-col { }
@media(min-width:600px) { .rg-mobile-br { display:none; } }
@media(min-width:860px) {
  .rg-page { max-width:1020px; padding:96px 32px 50px; }
  .rg-hero { text-align:center; margin-bottom:36px; }
  .rg-hero h1 { font-size:50px; }
  .rg-hero p { margin:0 auto; max-width:420px; }
  .rg-main-grid { display:grid; grid-template-columns:auto auto; gap:0; align-items:center; justify-content:center; }
  .rg-phone-wrap { width:270px; margin:0; }
  .rg-food-img { height:170px; }
  .rg-connector-v { display:none; }
  .rg-right-col { display:flex; align-items:center; }
  .rg-connector-h { display:block; width:80px; height:1px; background:linear-gradient(to right,rgba(255,178,45,0),rgba(255,178,45,.7)); position:relative; flex-shrink:0; z-index:2; }
  .rg-checkout { max-width:380px; margin:0; }
  .rg-price-main { font-size:34px; }
  .rg-features { grid-template-columns:repeat(4,1fr); }
  .rg-feature { display:block; text-align:center; padding:24px 18px; }
  .rg-icon { margin:0 auto 14px; }
}
.rg-main-grid { padding:24px 0 28px; }
`;
