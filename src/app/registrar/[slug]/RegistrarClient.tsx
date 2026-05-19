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

const PLAN_INFO: Record<string, { label: string; price: string; desc: string }> = {
  FREE: { label: "Gratis", price: "$0", desc: "Carta digital con QR y panel para editar cuando quieras." },
  GOLD: { label: "Gold", price: "$35.000/mes + IVA", desc: "Genio IA, ofertas, estadísticas y más para hacer crecer tu restaurante." },
  PREMIUM: { label: "Premium", price: "$49.900/mes + IVA", desc: "Multidioma, estadísticas avanzadas, cumpleaños, email marketing y más." },
};

export default function RegistrarClient({ restaurant, showcaseVenues }: Props) {
  const [plan, setPlan] = useState("PREMIUM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [venueIdx, setVenueIdx] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);

  // Read plan from URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("plan");
    if (p && PLAN_INFO[p]) setPlan(p);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // Rotate showcase venues
  useEffect(() => {
    if (showcaseVenues.length <= 1) return;
    const interval = setInterval(() => setVenueIdx(i => (i + 1) % showcaseVenues.length), 4000);
    return () => clearInterval(interval);
  }, [showcaseVenues.length]);

  // Rotate hero dish within current venue
  useEffect(() => {
    const venue = showcaseVenues[venueIdx];
    if (!venue || venue.dishes.length <= 1) return;
    const interval = setInterval(() => setHeroIdx(i => (i + 1) % venue.dishes.length), 3000);
    return () => clearInterval(interval);
  }, [venueIdx, showcaseVenues]);

  const venue = showcaseVenues[venueIdx] || null;
  const dishes = venue?.dishes || [];
  const info = PLAN_INFO[plan] || PLAN_INFO.PREMIUM;

  const handleActivar = async () => {
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
        body: JSON.stringify({ restaurantId: restaurant.id, plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Error iniciando pago");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Hubo un error. Intenta nuevamente.");
      setLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav className="reg-nav">
        <a className="reg-logo" href="/">
          <img src="/landing/logo.png" alt="" style={{ height: 16 }} />
          QuieroComer
        </a>
        <NavHamburger />
      </nav>

      <main className="reg-page">
        {/* Hero */}
        <section className="reg-hero">
          <div className="reg-eyebrow">Plan {info.label}</div>
          <h1 className="reg-title">Activa tu <em>carta digital</em></h1>
          <p className="reg-subtitle">Crea tu carta desde cero, agrega tus platos y empieza a usarla con tus clientes.</p>

          {/* Phone showcase */}
          {venue && (
            <div className="reg-phone-wrap">
              <div className="reg-phone">
                <div className="reg-screen">
                  <div className="reg-topbar">
                    <div className="reg-topbar-logo">
                      {venue.logoUrl && <img src={venue.logoUrl} alt="" />}
                    </div>
                    <div className="reg-topbar-name">{venue.name}</div>
                  </div>

                  <div className="reg-screen-hero">
                    {dishes[heroIdx % dishes.length]?.photo ? (
                      <img src={dishes[heroIdx % dishes.length].photo!} alt="" className="reg-hero-img" />
                    ) : (
                      <div className="reg-hero-fallback" />
                    )}
                    <div className="reg-hero-overlay">
                      <div className="reg-hero-dish">{dishes[heroIdx % dishes.length]?.name || venue.name}</div>
                      <div className="reg-hero-dots">
                        {dishes.slice(0, 3).map((_, i) => (
                          <div key={i} className={`reg-dot${i === (heroIdx % dishes.length) ? " active" : ""}`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {venue.categories.length > 0 && (
                    <div className="reg-cats">
                      {venue.categories.map((c, i) => (
                        <span key={i} className={`reg-cat${i === 0 ? " active" : ""}`}>{c}</span>
                      ))}
                    </div>
                  )}

                  <div className="reg-dishes">
                    {dishes.slice(0, 3).map((d, i) => (
                      <div key={i} className="reg-dish-card">
                        {d.photo ? (
                          <img src={d.photo} alt="" className="reg-dish-photo" />
                        ) : (
                          <div className="reg-dish-photo-empty" />
                        )}
                        <div className="reg-dish-info">
                          <div className="reg-dish-name">{d.name}</div>
                          <div className="reg-dish-price">{formatPrice(d.price)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="reg-phone-caption">{venue.name}</div>
            </div>
          )}

          {/* Activation card */}
          <div className="reg-card">
            <div className="reg-card-label">Plan {info.label}</div>
            {plan !== "FREE" ? (
              <div className="reg-card-price">{info.price.split("/")[0]} <small>CLP/{info.price.split("/")[1]}</small></div>
            ) : (
              <div className="reg-card-price">$0 <small>gratis</small></div>
            )}
            <div className="reg-card-desc">{info.desc}</div>

            {error && <div className="reg-error">{error}</div>}

            {!done ? (
              <>
                <button className="reg-cta" disabled={loading} onClick={handleActivar}>
                  {loading ? "Procesando..." : plan === "FREE" ? "Activar gratis" : `Activar plan ${info.label}`}
                </button>
                <div className="reg-alt-link">
                  <a href="/subircarta">¿Ya tienes carta en otro lugar? Súbela y la importamos →</a>
                </div>
              </>
            ) : (
              <div className="reg-done">Activado. Redirigiendo...</div>
            )}

            <div className="reg-cancel-note">Puedes cancelar o cambiar de plan cuando quieras</div>
          </div>
        </section>

        {/* Benefits */}
        <div className="reg-divider" />
        <section className="reg-benefits-section">
          <div className="reg-benefits-title">Lo que incluye tu plan</div>
          <div className="reg-benefits">
            {plan === "PREMIUM" && <>
              <div className="reg-benefit"><span>🌍</span><div><strong>Carta en varios idiomas</strong><p>Español, inglés y portugués automáticos.</p></div></div>
              <div className="reg-benefit"><span>📈</span><div><strong>Estadísticas avanzadas</strong><p>Platos más vistos, horarios pico, tendencias.</p></div></div>
              <div className="reg-benefit"><span>🎂</span><div><strong>Cumpleaños automáticos</strong><p>Email personalizado el día de su cumpleaños.</p></div></div>
              <div className="reg-benefit"><span>🧞</span><div><strong>El Genio IA</strong><p>Reordena la carta según gustos de cada cliente.</p></div></div>
            </>}
            {plan === "GOLD" && <>
              <div className="reg-benefit"><span>🧞</span><div><strong>El Genio IA</strong><p>Reordena la carta según gustos de cada cliente.</p></div></div>
              <div className="reg-benefit"><span>📊</span><div><strong>Estadísticas</strong><p>Visitantes, platos más vistos, horarios.</p></div></div>
              <div className="reg-benefit"><span>🏷️</span><div><strong>Ofertas y promociones</strong><p>Crea descuentos visibles en la carta.</p></div></div>
              <div className="reg-benefit"><span>📢</span><div><strong>Anuncios en la carta</strong><p>Banners de novedades al abrir la carta.</p></div></div>
            </>}
            {plan === "FREE" && <>
              <div className="reg-benefit"><span>📱</span><div><strong>Carta digital con QR</strong><p>Tus clientes escanean y ven tu carta.</p></div></div>
              <div className="reg-benefit"><span>✏️</span><div><strong>Panel autoadministrable</strong><p>Edita tu carta cuando quieras.</p></div></div>
            </>}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

const CSS = `
:root { --cream:#E8DDC8; --cream-soft:#C9BBA0; --amber:#E8A33D; --black:#0A0908; --gray-warm:#7D7366; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: radial-gradient(circle at 50% 0%, rgba(232,163,61,.12), transparent 30%), var(--black) !important; color: var(--cream) !important; font-family: Inter, -apple-system, sans-serif !important; }
.reg-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 14px clamp(18px,4vw,64px); display: flex; justify-content: space-between; align-items: center; background: rgba(10,9,8,.88); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.reg-logo { font-family: Georgia, serif; font-size: 17px; color: var(--cream); display: flex; align-items: center; gap: 8px; text-decoration: none; }
.reg-page { max-width: 430px; margin: 0 auto; min-height: 100vh; padding: 18px 16px 44px; }
.reg-hero { text-align: center; padding-top: 60px; }
.reg-eyebrow { color: var(--amber); font-size: 11px; letter-spacing: 3.5px; font-weight: 950; text-transform: uppercase; margin-bottom: 13px; }
.reg-title { font-family: Georgia, serif; font-size: 38px; line-height: 1.02; font-weight: 400; margin-bottom: 14px; }
.reg-title em { color: var(--amber); font-style: italic; }
.reg-subtitle { color: var(--cream-soft); font-size: 15px; line-height: 1.48; max-width: 340px; margin: 0 auto 28px; }
.reg-phone-wrap { margin: 0 auto 20px; width: 240px; }
.reg-phone { width: 240px; height: 420px; border-radius: 40px; padding: 10px; background: linear-gradient(145deg, #313131, #060606); border: 1px solid rgba(255,255,255,.18); box-shadow: 0 24px 50px rgba(0,0,0,.5), 0 0 40px rgba(255,174,42,.1); }
.reg-screen { height: 100%; border-radius: 30px; overflow: hidden; background: #0a0908; display: flex; flex-direction: column; }
.reg-topbar { display: flex; align-items: center; padding: 5px 10px; background: #0e0e0e; gap: 5px; }
.reg-topbar-logo { width: 18px; height: 18px; border-radius: 50%; overflow: hidden; border: 1px solid rgba(255,255,255,.12); background: #222; flex-shrink: 0; }
.reg-topbar-logo img { width: 100%; height: 100%; object-fit: cover; }
.reg-topbar-name { font-size: 9px; font-weight: 700; color: rgba(255,255,255,.85); }
.reg-screen-hero { height: 160px; position: relative; overflow: hidden; }
.reg-hero-img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; transition: opacity .6s ease; }
.reg-hero-fallback { width: 100%; height: 100%; background: linear-gradient(135deg, rgba(232,163,61,.15), #0a0908); }
.reg-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,.2), rgba(0,0,0,.65)); display: flex; flex-direction: column; justify-content: flex-end; padding: 10px; }
.reg-hero-dish { font-size: 13px; font-weight: 800; color: #fff; }
.reg-hero-dots { display: flex; gap: 3px; margin-top: 6px; }
.reg-dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,.3); }
.reg-dot.active { background: var(--amber); width: 12px; border-radius: 99px; }
.reg-cats { display: flex; gap: 3px; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.06); overflow: hidden; }
.reg-cat { padding: 4px 8px; border-radius: 99px; font-size: 8px; font-weight: 600; white-space: nowrap; background: rgba(255,255,255,.05); color: rgba(255,255,255,.45); border: 1px solid transparent; }
.reg-cat.active { background: rgba(232,163,61,.12); color: var(--amber); border-color: rgba(232,163,61,.25); }
.reg-dishes { flex: 1; padding: 6px 8px; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.reg-dish-card { display: flex; border-radius: 10px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); overflow: hidden; }
.reg-dish-photo { width: 40px; height: 40px; object-fit: cover; flex-shrink: 0; }
.reg-dish-photo-empty { width: 40px; height: 40px; flex-shrink: 0; background: #1a1a1a; }
.reg-dish-info { padding: 5px 8px; text-align: left; }
.reg-dish-name { font-size: 10px; font-weight: 700; color: #E8DDC8; }
.reg-dish-price { font-size: 9px; font-weight: 800; color: var(--amber); margin-top: 2px; }
.reg-phone-caption { margin-top: 8px; color: var(--gray-warm); font-size: 11px; text-align: center; transition: opacity .4s ease; }
.reg-card { margin: 24px 0; padding: 22px; border-radius: 22px; background: linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.02)); border: 1px solid rgba(255,178,45,.3); box-shadow: 0 0 30px rgba(255,178,45,.06); text-align: left; }
.reg-card-label { color: var(--amber); font-size: 13px; font-weight: 950; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 6px; }
.reg-card-price { font-size: 34px; font-weight: 950; color: var(--amber); margin-bottom: 6px; }
.reg-card-price small { font-size: 13px; color: var(--cream-soft); }
.reg-card-desc { color: var(--cream-soft); font-size: 13px; line-height: 1.4; margin-bottom: 16px; }
.reg-error { background: rgba(232,80,80,.12); border: 1px solid rgba(232,80,80,.3); border-radius: 12px; padding: 10px 14px; margin-bottom: 10px; color: #e85d5d; font-size: 13px; text-align: center; }
.reg-cta { width: 100%; border: 0; border-radius: 999px; padding: 15px; background: linear-gradient(135deg, #ffc44f, #f3a333); color: #100b03; font-size: 15px; font-weight: 950; cursor: pointer; box-shadow: 0 14px 28px rgba(245,164,51,.18); transition: opacity .2s; }
.reg-cta:disabled { opacity: .6; cursor: wait; }
.reg-alt-link { text-align: center; margin-top: 14px; }
.reg-alt-link a { color: var(--amber); font-size: 13px; text-decoration: none; font-weight: 600; }
.reg-done { text-align: center; color: #74e49a; font-weight: 700; font-size: 16px; padding: 14px 0; }
.reg-cancel-note { margin-top: 10px; text-align: center; color: var(--gray-warm); font-size: 12px; }
.reg-divider { height: 1px; background: rgba(255,255,255,.08); margin: 28px 0 24px; }
.reg-benefits-section { text-align: center; }
.reg-benefits-title { font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: var(--amber); margin-bottom: 16px; }
.reg-benefits { display: grid; gap: 10px; text-align: left; }
.reg-benefit { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 18px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); }
.reg-benefit span { font-size: 22px; flex-shrink: 0; margin-top: 2px; }
.reg-benefit strong { display: block; font-size: 14px; margin-bottom: 3px; }
.reg-benefit p { font-size: 12px; color: var(--cream-soft); line-height: 1.4; }
@media(min-width:768px) {
  .reg-page { max-width: 600px; }
  .reg-title { font-size: 48px; }
  .reg-benefits { grid-template-columns: 1fr 1fr; }
}
`;
