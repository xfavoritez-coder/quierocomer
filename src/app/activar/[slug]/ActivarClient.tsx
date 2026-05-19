"use client";

import { useState, useEffect } from "react";
import Footer from "@/components/Footer";
import NavHamburger from "@/components/NavHamburger";

interface Props {
  restaurant: { id: string; name: string; slug: string; logoUrl: string | null };
  categories: string[];
  dishes: { name: string; price: number; photo: string | null; description: string }[];
  activeVenues: { name: string; slug: string; logoUrl: string | null; plan?: string }[];
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatPrice(price: number) {
  return "$" + Math.round(price).toLocaleString("es-CL");
}

const CSS = `
:root { --cream: #E8DDC8; --cream-soft: #C9BBA0; --amber: #E8A33D; --black: #0A0908; --gray-warm: #7D7366; --gray-deep: #3A342D; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, -apple-system, sans-serif; background: radial-gradient(circle at 50% 0%, rgba(232,163,61,.16), transparent 30%), radial-gradient(circle at 50% 58%, rgba(232,163,61,.07), transparent 36%), var(--black); color: var(--cream); }
.page { width: 100%; max-width: 430px; margin: 0 auto; min-height: 100vh; padding: 18px 16px 44px; overflow: hidden; }
.activar-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 14px clamp(18px,4vw,64px); display: flex; justify-content: space-between; align-items: center; background: linear-gradient(180deg, rgba(10,9,8,.92), rgba(10,9,8,.15)); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.activar-nav .logo { font-family: Georgia, serif; font-size: 17px; font-weight: 400; color: var(--cream); display: flex; align-items: center; gap: 8px; letter-spacing: .02em; text-decoration: none; }
.activar-nav .logo img { height: 16px; width: auto; object-fit: contain; }
.activar-nav .nav-link { color: var(--cream-soft); font-size: 14px; text-decoration: none; letter-spacing: .04em; }
.activar-nav .nav-cta { padding: 8px 14px; background: rgba(232,163,61,.12); border: 1px solid rgba(232,163,61,.25); color: var(--cream); font-size: 12px; font-weight: 700; text-decoration: none; letter-spacing: .04em; border-radius: 4px; }
.hero { text-align: center; padding-top: 60px; }
.resto-logo { width: 76px; height: 76px; margin: 0 auto 18px; border-radius: 24px; border: 1px solid rgba(255,255,255,.14); display: grid; place-items: center; font-weight: 950; font-size: 20px; color: var(--amber); box-shadow: 0 18px 40px rgba(0,0,0,.45); overflow: hidden; background: #111; }
.resto-logo img { width: 100%; height: 100%; object-fit: cover; }
.eyebrow { color: var(--amber); font-size: 11px; letter-spacing: 3.5px; font-weight: 950; text-transform: uppercase; margin-bottom: 13px; }
h1 { margin: 0; font-family: Georgia, serif; font-size: 40px; line-height: 1.02; letter-spacing: -.8px; font-weight: 400; }
h1 em { color: var(--amber); font-style: italic; }
.subtitle { margin: 16px auto 22px; max-width: 350px; color: var(--cream-soft); font-size: 15px; line-height: 1.48; }
.phone-wrap { position: relative; margin: 0 auto 22px; width: 260px; }
.phone { width: 260px; height: 470px; border-radius: 44px; padding: 12px; background: linear-gradient(145deg, #313131, #060606); border: 1px solid rgba(255,255,255,.18); box-shadow: 0 28px 60px rgba(0,0,0,.6), 0 0 48px rgba(255,174,42,.14); }
.screen { height: 100%; border-radius: 31px; overflow: hidden; background: #0a0908; display: flex; flex-direction: column; }
.screen-topbar { display: flex; align-items: center; padding: 6px 12px; background: #0e0e0e; gap: 5px; }
.screen-header-logo { width: 20px; height: 20px; border-radius: 50%; overflow: hidden; border: 1px solid rgba(255,255,255,.12); background: #222; flex-shrink: 0; }
.screen-header-logo img { width: 100%; height: 100%; object-fit: cover; }
.screen-header-name { font-size: 10px; font-weight: 700; color: rgba(255,255,255,.85); flex: 1; text-align: left; }
.screen-lang { width: 16px; height: 16px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
.screen-header { height: 185px; position: relative; overflow: hidden; }
.screen-header img.hero-bg { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
.screen-header-fallback { width: 100%; height: 100%; background: linear-gradient(135deg, rgba(232,163,61,.15), #0a0908); }
.screen-header-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,.25) 0%, rgba(0,0,0,.55) 50%, rgba(0,0,0,.7) 100%); display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; }
.screen-header-center { display: flex; flex-direction: column; align-items: center; text-align: center; }
.screen-header-dish { font-size: 14px; font-weight: 800; color: #fff; line-height: 1.1; }
.screen-header-desc { font-size: 9px; color: rgba(255,255,255,.6); margin-top: 3px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.screen-header-btn { margin-top: 6px; background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.7); border-radius: 99px; padding: 4px 14px; font-size: 9px; font-weight: 800; }
.screen-dots { display: flex; gap: 4px; justify-content: center; padding: 8px 0 0; }
.screen-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,.3); }
.screen-dot.active { background: var(--amber); width: 14px; border-radius: 99px; }
.screen-cats { display: flex; gap: 4px; padding: 8px 10px; margin-top: 4px; border-bottom: 1px solid rgba(255,255,255,.06); overflow: hidden; }
.screen-cat { padding: 5px 10px; border-radius: 99px; font-size: 9px; font-weight: 600; white-space: nowrap; background: rgba(255,255,255,.05); color: rgba(255,255,255,.45); border: 1px solid transparent; }
.screen-cat.active { background: rgba(232,163,61,.12); color: var(--amber); border-color: rgba(232,163,61,.25); }
.screen-dishes { flex: 1; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
.phone-caption { margin-top: 11px; color: var(--gray-warm); font-size: 12px; text-align: center; }
.activation-flow { position: relative; margin-top: 28px; padding-bottom: 8px; }
.activation-flow::before { content: ""; position: absolute; left: 50%; top: 330px; transform: translateX(-50%); width: 360px; height: 360px; background: radial-gradient(circle, rgba(255,178,45,.22), transparent 66%); pointer-events: none; z-index: 0; }
.flow-arrow { width: 1px; height: 42px; margin: 14px auto 0; background: linear-gradient(to bottom, rgba(255,178,45,.0), rgba(255,178,45,.7)); position: relative; z-index: 2; }
.flow-arrow::after { content: ""; position: absolute; bottom: -5px; left: 50%; width: 9px; height: 9px; border-right: 1px solid rgba(255,178,45,.85); border-bottom: 1px solid rgba(255,178,45,.85); transform: translateX(-50%) rotate(45deg); }
.offer { position: relative; margin: 24px 0 30px; padding: 22px; border-radius: 22px; background: linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025)), #101010; border: 1px solid rgba(255,178,45,.45); box-shadow: 0 0 36px rgba(255,178,45,.10); }
.offer-label { color: #a855f7; font-size: 14px; font-weight: 950; letter-spacing: .7px; text-transform: uppercase; margin-bottom: 6px; }
.price-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.old-price { color: rgba(232,221,200,.5); font-size: 20px; font-weight: 900; text-decoration: line-through; text-decoration-thickness: 2px; }
.discount { position: absolute; top: 16px; right: 16px; border-radius: 999px; padding: 8px 10px; background: rgba(168,85,247,.14); border: 1px solid rgba(168,85,247,.35); color: #c084fc; font-size: 11px; font-weight: 950; }
.new-price { margin: -2px 0 6px; color: var(--amber); font-size: 38px; font-weight: 950; letter-spacing: -1.5px; }
.new-price small { font-size: 13px; color: var(--cream-soft); letter-spacing: 0; }
.offer-text { color: var(--cream-soft); font-size: 12px; line-height: 1.4; margin-bottom: 12px; }
.cta { width: 100%; border: 0; border-radius: 999px; padding: 14px 18px; background: linear-gradient(135deg, #ffc44f, #f3a333); color: #100b03; font-size: 15px; font-weight: 950; box-shadow: 0 18px 34px rgba(245,164,51,.22); cursor: pointer; transition: opacity .2s; }
.cta:disabled { opacity: .6; cursor: wait; }
.secure { margin-top: 13px; text-align: center; color: var(--gray-warm); font-size: 12px; }
.divider { height: 1px; background: rgba(255,255,255,.08); margin: 32px 0 24px; }
.section-title { text-align: center; margin: 0 0 7px; font-family: Georgia, serif; font-size: 26px; font-weight: 400; }
.section-sub { text-align: center; color: var(--gray-warm); margin: 0 auto 18px; font-size: 13px; line-height: 1.4; }
.venues { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.venue { min-height: 155px; padding: 15px; border-radius: 20px; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.08); text-align: center; }
.venue-logo { width: 48px; height: 48px; margin: 0 auto 10px; border-radius: 15px; display: grid; place-items: center; font-size: 12px; font-weight: 950; overflow: hidden; background: #151515; border: 1px solid rgba(255,255,255,.1); color: var(--amber); }
.venue-logo img { width: 100%; height: 100%; object-fit: cover; }
.stars { color: var(--amber); font-size: 11px; margin-bottom: 6px; }
.venue strong { display: block; font-size: 13px; margin-bottom: 6px; }
.venue-badge { display: inline-block; font-size: 9px; font-weight: 900; letter-spacing: .5px; padding: 4px 8px; border-radius: 999px; text-transform: uppercase; }
.venue-badge-premium { background: rgba(168,85,247,.12); color: #c4b5fd; border: 1px solid rgba(168,85,247,.25); }
.venue-badge-gold { background: rgba(255,178,45,.12); color: #ffd184; border: 1px solid rgba(255,178,45,.25); }
.venue-badge-free { background: rgba(255,255,255,.06); color: var(--gray-warm); border: 1px solid rgba(255,255,255,.1); }
.benefits-eyebrow { display: inline-flex; align-items: center; gap: 8px; margin: 0 auto 12px; padding: 8px 12px; border-radius: 999px; background: rgba(255,178,45,.10); color: #ffbd55; border: 1px solid rgba(255,178,45,.18); font-size: 11px; font-weight: 950; letter-spacing: .8px; text-transform: uppercase; }
.benefits { display: grid; gap: 12px; }
.benefit { position: relative; overflow: hidden; display: grid; grid-template-columns: 58px 1fr; gap: 14px; align-items: center; padding: 17px; min-height: 110px; border-radius: 26px; background: linear-gradient(135deg, rgba(255,255,255,.075), rgba(255,255,255,.025)), #111; border: 1px solid rgba(255,255,255,.09); box-shadow: 0 16px 34px rgba(0,0,0,.26); }
.benefit::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 12% 20%, rgba(255,178,45,.13), transparent 28%), radial-gradient(circle at 100% 100%, rgba(255,178,45,.06), transparent 30%); pointer-events: none; }
.benefit-icon { position: relative; z-index: 1; width: 58px; height: 58px; border-radius: 20px; display: grid; place-items: center; font-size: 27px; background: linear-gradient(135deg, rgba(255,178,45,.22), rgba(255,178,45,.08)); border: 1px solid rgba(255,178,45,.18); box-shadow: 0 10px 24px rgba(255,178,45,.09); }
.benefit-content { position: relative; z-index: 1; }
.benefit strong { display: block; margin-bottom: 6px; font-size: 16px; line-height: 1.15; letter-spacing: -.2px; }
.benefit p { margin: 0; color: var(--cream-soft); font-size: 14px; line-height: 1.45; }
.benefit.highlight { border-color: rgba(255,178,45,.34); background: linear-gradient(135deg, rgba(255,178,45,.13), rgba(255,255,255,.03)), #111; }
.plans { display: grid; gap: 14px; }
.plan { border-radius: 25px; padding: 20px; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.10); position: relative; }
.plan.gold { border-color: rgba(255,178,45,.22); }
.plan.gold h3 { color: var(--amber); }
.plan.featured { border-color: rgba(255,178,45,.55); background: linear-gradient(135deg, rgba(255,178,45,.13), rgba(255,255,255,.035)), #0c0c0c; box-shadow: 0 0 32px rgba(255,178,45,.10); }
.plan.featured h3 { color: var(--amber); }
.badge { position: absolute; right: 16px; top: 16px; border-radius: 999px; padding: 7px 10px; color: #ffd38a; background: rgba(255,178,45,.14); font-size: 10px; font-weight: 950; }
.plan h3 { margin: 0 0 10px; font-family: Georgia, serif; font-size: 24px; font-weight: 400; color: var(--cream); }
.plan-price { font-size: 30px; font-weight: 950; margin-bottom: 8px; }
.plan-price small { font-size: 12px; color: var(--cream-soft); }
.plan.featured .plan-price { color: var(--amber); }
.strike { display: block; color: rgba(232,221,200,.45); font-size: 15px; font-weight: 700; text-decoration: line-through; text-decoration-thickness: 2px; margin-top: 2px; margin-bottom: 6px; }
.plan p { margin: 0 0 14px; color: var(--cream-soft); font-size: 13px; line-height: 1.4; }
.checks { display: grid; gap: 8px; margin-bottom: 16px; }
.checks div { color: var(--cream); font-size: 14px; display: flex; align-items: center; gap: 4px; }
.tip { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 50%; background: rgba(232,163,61,.12); color: var(--amber); font-size: 10px; font-weight: 800; font-style: italic; cursor: pointer; flex-shrink: 0; position: relative; -webkit-tap-highlight-color: transparent; }
.tip.open .tip-text { display: block; }
.tip-text { display: none; position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); background: #1a1a1a; border: 1px solid rgba(232,163,61,.25); border-radius: 8px; padding: 10px 12px; font-size: 13px; font-weight: 400; font-style: normal; color: var(--cream-soft); width: 200px; text-align: left; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,.5); line-height: 1.4; }
.plan-btn { width: 100%; border-radius: 999px; border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.06); color: var(--cream); padding: 14px 15px; font-weight: 950; cursor: pointer; font-size: 14px; }
.plan.featured .plan-btn { background: linear-gradient(135deg, #ffc44f, #f3a333); color: #100b03; border: 0; }
.plan-btn:disabled { opacity: .5; cursor: wait; }
.done-msg { text-align: center; padding: 14px 0; }
.done-msg p { color: #74e49a; font-weight: 700; font-size: 16px; margin: 0; }
footer { margin-top: 34px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.08); text-align: center; color: var(--gray-warm); font-size: 12px; line-height: 2; }
footer a { color: var(--gray-warm); text-decoration: none; }
@media (min-width: 768px) {
  .page { max-width: 720px; padding: 30px 32px 60px; }
  h1 { font-size: 50px; }
  .subtitle { font-size: 17px; max-width: 480px; }
  .activation-flow { max-width: 480px; margin: 40px auto 0; }
  .phone-wrap { margin: 0 auto; }
  .venues { grid-template-columns: repeat(4, 1fr); }
  .plans { grid-template-columns: repeat(3, 1fr); }
  .benefits { grid-template-columns: 1fr 1fr; }
  .section-title { font-size: 32px; }
}
@media (min-width: 1024px) {
  .page { max-width: 900px; padding: 40px 48px 80px; }
  h1 { font-size: 58px; }
}
@media (max-width: 360px) { h1 { font-size: 34px; } .venues { grid-template-columns: 1fr; } }
`;

export default function ActivarClient({ restaurant, categories, dishes, activeVenues }: Props) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    if (dishes.length <= 1) return;
    const max = Math.min(dishes.length, 3);
    const interval = setInterval(() => setHeroIdx(i => (i + 1) % max), 3000);
    return () => clearInterval(interval);
  }, [dishes.length]);

  // Tooltip toggle for plan features
  useEffect(() => {
    const handler = (e: Event) => {
      const tip = (e.target as HTMLElement).closest(".tip");
      if (tip) {
        e.preventDefault();
        const wasOpen = tip.classList.contains("open");
        document.querySelectorAll(".tip.open").forEach(t => t.classList.remove("open"));
        if (!wasOpen) tip.classList.add("open");
      } else {
        document.querySelectorAll(".tip.open").forEach(t => t.classList.remove("open"));
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const [error, setError] = useState("");

  // Mostrar error si vuelve de pago fallido
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pago") === "error") {
      const reason = params.get("reason") || "";
      setError(reason === "charge_failed"
        ? "No se pudo procesar el cobro. Intenta nuevamente."
        : "No se pudo completar el pago. Intenta nuevamente.");
      params.delete("pago"); params.delete("reason");
      const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", clean);
    }
  }, []);

  const handleActivar = async (plan: "FREE" | "GOLD" | "PREMIUM") => {
    setLoading(true);
    setSelectedPlan(plan);
    setError("");

    try {
      if (plan === "FREE") {
        const res = await fetch("/api/activar/free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: restaurant.id }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Error"); }
        window.location.href = `/activar/${restaurant.slug}/exito?plan=FREE`;
        return;
      }

      // Plan pago: registrar tarjeta + pagar via Flow
      const res = await fetch("/api/activar/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurant.id, plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Error iniciando pago");

      // Redirigir a Webpay
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Hubo un error. Intenta nuevamente.");
      setLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav className="activar-nav">
        <a className="logo" href="/">
          <img src="/landing/logo.png" alt="" />
          QuieroComer
        </a>
        <NavHamburger />
      </nav>

      <main className="page">
        {/* Hero */}
        <section className="hero">
          <div className="resto-logo">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} />
            ) : (
              getInitials(restaurant.name)
            )}
          </div>
          <div className="eyebrow">Carta de {restaurant.name}</div>
          <h1>Ya estás listo para <em>activar tu carta</em></h1>
          <p className="subtitle">
            No es solo una carta bonita. Es una herramienta para mejorar la experiencia de tu restaurant, vender más y entender mejor a tus clientes.
          </p>

          {/* Phone + arrow + offer flow */}
          <div className="activation-flow">
          <div className="phone-wrap">
            <div className="phone">
              <div className="screen">
                {/* Top bar — separate from hero */}
                <div className="screen-topbar">
                  <div className="screen-header-logo">
                    {restaurant.logoUrl && <img src={restaurant.logoUrl} alt="" />}
                  </div>
                  <div className="screen-header-name">{restaurant.name}</div>
                  <div className="screen-lang">
                    <svg viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="4" fill="#c60b1e"/><rect y="4" width="16" height="8" fill="#ffc400"/><rect y="12" width="16" height="4" fill="#c60b1e"/></svg>
                  </div>
                </div>

                {/* Hero photo with slider */}
                <div className="screen-header">
                  {dishes[heroIdx]?.photo ? (
                    <img className="hero-bg" src={dishes[heroIdx].photo} alt="" />
                  ) : (
                    <div className="screen-header-fallback" />
                  )}
                  <div className="screen-header-overlay">
                    <div className="screen-header-center">
                      <div className="screen-header-dish">{dishes[heroIdx]?.name || restaurant.name}</div>
                      {dishes[heroIdx]?.description && (
                        <div className="screen-header-desc">{dishes[heroIdx].description}</div>
                      )}
                      <button className="screen-header-btn">Ver</button>
                    </div>
                    <div className="screen-dots" style={{ position: "relative", zIndex: 1 }}>
                      {dishes.slice(0, 3).map((_, i) => (
                        <div key={i} className={`screen-dot${i === heroIdx ? " active" : ""}`} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Category nav */}
                {categories.length > 0 && (
                  <div className="screen-cats">
                    {categories.map((c, i) => (
                      <span key={i} className={`screen-cat${i === 0 ? " active" : ""}`}>{c}</span>
                    ))}
                  </div>
                )}

                {/* Dish list */}
                <div style={{
                  flex: 1, padding: "6px 12px", display: "flex", flexDirection: "column", gap: 5, overflow: "hidden", textAlign: "left",
                  background: "radial-gradient(circle at 20% 30%, rgba(232,163,61,.06), transparent 50%), radial-gradient(circle at 80% 70%, rgba(232,163,61,.04), transparent 40%)",
                }}>
                  {dishes.slice(0, 3).map((d, i) => (
                    <div key={i} style={{
                      display: "flex", flexDirection: "row", alignItems: "flex-start", borderRadius: 12,
                      background: i === 1 ? "linear-gradient(135deg, rgba(232,163,61,.06), rgba(255,255,255,.03))" : "rgba(255,255,255,.04)",
                      border: i === 1 ? "1px solid rgba(232,163,61,.25)" : "1px solid rgba(255,255,255,.06)",
                      overflow: "hidden",
                      boxShadow: "0 2px 8px rgba(0,0,0,.15)",
                    }}>
                      {d.photo ? (
                        <img src={d.photo} alt="" style={{ width: 46, height: 46, objectFit: "cover", flexShrink: 0, display: "block" }} />
                      ) : (
                        <div style={{ width: 46, height: 46, flexShrink: 0, background: "#1a1a1a" }} />
                      )}
                      <div style={{ padding: "6px 10px", textAlign: "left" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#E8DDC8", textAlign: "left", display: "flex", alignItems: "center", gap: 3 }}>{i === 1 && <span style={{ color: "#E8A33D", fontSize: 9 }}>★</span>}{d.name}</div>
                        {d.description && <div style={{ fontSize: 8, color: "rgba(255,255,255,.45)", marginTop: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{d.description}</div>}
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#E8A33D", marginTop: 2, textAlign: "left" }}>{formatPrice(d.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="phone-caption">Vista previa de tu carta</div>
          </div>

          <div className="flow-arrow" />

          <div className="offer" style={{ position: "relative", zIndex: 3, margin: "-4px 6px 0", textAlign: "left" }}>
          <span className="discount">-90% dcto</span>
          <div className="offer-label">Oferta plan Premium</div>
          <span className="old-price">$49.900</span>
          <div className="new-price">$4.900 <small>CLP primer mes</small></div>
          <div className="offer-text">
            Activa multidioma, estadísticas, automatizaciones, capta cumpleaños y más.
          </div>
          {error && <div style={{ background: "rgba(232,80,80,.12)", border: "1px solid rgba(232,80,80,.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 10, color: "#e85d5d", fontSize: 13, textAlign: "center" }}>{error}</div>}
          {!done ? (
            <button className="cta" disabled={loading} onClick={() => handleActivar("PREMIUM")}>
              {loading && selectedPlan === "PREMIUM" ? "Procesando..." : "Activar por $4.900"}
            </button>
          ) : (
            <div className="done-msg"><p>Activado. Redirigiendo...</p></div>
          )}
          <div style={{ marginTop: 12, textAlign: "center", color: "var(--gray-warm)", fontSize: 12 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Pago 100% seguro</div>
        </div>
        </div>{/* end activation-flow */}
        </section>{/* end hero */}

        <div className="divider" />

        {/* Venues */}
        <section>
          <h2 className="section-title">Restaurantes que ya tienen su carta activa</h2>
          <p className="section-sub" style={{ fontSize: 15 }}>Cartas reales funcionando con QuieroComer.</p>
          <div className="venues">
            {activeVenues.map((v, i) => {
              const plan = ((v as any).plan || "PREMIUM").toLowerCase();
              return (
                <a href={`/qr/${v.slug}`} target="_blank" rel="noopener" key={i} className="venue" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="venue-logo">
                    {v.logoUrl ? <img src={v.logoUrl} alt={v.name} /> : getInitials(v.name)}
                  </div>
                  <div className="stars">★★★★★</div>
                  <strong>{v.name}</strong>
                  <span className={`venue-badge venue-badge-${plan}`}>{plan}</span>
                </a>
              );
            })}
          </div>
        </section>

        <div className="divider" />

        {/* Benefits */}
        <section>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div className="benefits-eyebrow">Después de activar</div>
            <h2 className="section-title" style={{ marginTop: 12 }}>La experiencia en tu restaurant cambia <em style={{ color: "var(--amber)", fontStyle: "italic" }}>para siempre.</em></h2>
          </div>
          <div className="benefits">
            <article className="benefit highlight">
              <div className="benefit-icon">🌍</div>
              <div className="benefit-content">
                <strong>Carta en varios idiomas</strong>
                <p>Español, inglés y portugués para turistas y clientes extranjeros.</p>
              </div>
            </article>
            <article className="benefit">
              <div className="benefit-icon">🧞</div>
              <div className="benefit-content">
                <strong>Sube el ticket de cada mesa</strong>
                <p>Sugerimos automáticamente acompañamientos, postres y bebidas según lo que cada cliente está viendo.</p>
              </div>
            </article>
            <article className="benefit">
              <div className="benefit-icon">📈</div>
              <div className="benefit-content">
                <strong>Descubre qué vende más</strong>
                <p>Ve qué platos llaman más la atención y qué promociones funcionan.</p>
              </div>
            </article>
            <article className="benefit highlight">
              <div className="benefit-icon">🎂</div>
              <div className="benefit-content">
                <strong>Clientes que vuelven solos</strong>
                <p>Guarda clientes y envía correos automáticos en cumpleaños y fechas especiales.</p>
              </div>
            </article>
          </div>
        </section>

        <div className="divider" />

        {/* Plans */}
        <section>
          <p className="section-sub" id="planes" style={{ fontSize: 15 }}>Cambia cuando quieras. Sin permanencia.</p>

          <div className="plans">
            <article className="plan">
              <h3>Gratis</h3>
              <div className="plan-price">$0</div>
              <p>Para comenzar.</p>
              <div className="checks">
                <div>✓ Carta digital con QR <span className="tip">i<span className="tip-text">Tu carta lista para que tus clientes la escaneen desde la mesa</span></span></div>
                <div>✓ Vista Lista <span className="tip">i<span className="tip-text">Tus platos organizados por categoría en formato lista clásico</span></span></div>
                <div>✓ Panel para editar tu carta <span className="tip">i<span className="tip-text">Cambia platos, precios, fotos y categorías cuando quieras, sin depender de nadie</span></span></div>
                <div>✓ Hasta 10 clientes registrados <span className="tip">i<span className="tip-text">Captura datos de hasta 10 clientes que escanean tu carta</span></span></div>
              </div>
              {!done ? (
                <button className="plan-btn" disabled={loading} onClick={() => handleActivar("FREE")}>
                  {loading && selectedPlan === "FREE" ? "Activando..." : "Elegir Gratis"}
                </button>
              ) : selectedPlan === "FREE" ? (
                <div className="done-msg"><p>Activado.</p></div>
              ) : (
                <button className="plan-btn" disabled>Elegir Gratis</button>
              )}
            </article>

            <article className="plan gold">
              <h3>Gold</h3>
              <div className="plan-price">$35.000<small>/mes + IVA</small></div>
              <p>Para crecer tu restaurante.</p>
              <div className="checks">
                <div>✓ Todo lo del plan Gratis</div>
                <div>✓ El Genio IA <span className="tip">i<span className="tip-text">Un asistente inteligente que reordena tu carta según los gustos de cada cliente</span></span></div>
                <div>✓ Ofertas y promociones <span className="tip">i<span className="tip-text">Crea ofertas temporales que aparecen directo en la carta de tus clientes</span></span></div>
                <div>✓ Vistas Lista + Galería <span className="tip">i<span className="tip-text">Dos formas de mostrar tu carta: lista clásica y galería con fotos grandes</span></span></div>
                <div>✓ Estadísticas de tu carta <span className="tip">i<span className="tip-text">Ve cuántas personas visitan tu carta, qué platos miran más y en qué horarios</span></span></div>
                <div>✓ Anuncios dentro de la carta <span className="tip">i<span className="tip-text">Destaca platos o muestra banners promocionales que tus clientes ven al navegar</span></span></div>
              </div>
              {!done ? (
                <button className="plan-btn" disabled={loading} onClick={() => handleActivar("GOLD")}>
                  {loading && selectedPlan === "GOLD" ? "Activando..." : "Activar Gold"}
                </button>
              ) : selectedPlan === "GOLD" ? (
                <div className="done-msg"><p>Activado.</p></div>
              ) : (
                <button className="plan-btn" disabled>Activar Gold</button>
              )}
            </article>

            <article className="plan featured">
              <div className="badge">Más elegido</div>
              <h3>Premium</h3>
              <div className="plan-price">$4.900 <small>primer mes</small></div>
              <span className="strike">$49.900/mes + IVA</span>
              <p>Para restaurantes que quieren vender más.</p>
              <div className="checks">
                <div>✓ Todo lo de Gold</div>
                <div>✓ Vistas Lista + Galería + Impact <span className="tip">i<span className="tip-text">Tres diseños distintos para tu carta: lista clásica, galería con fotos y la vista Impact con hero de platos destacados</span></span></div>
                <div>✓ Estadísticas avanzadas <span className="tip">i<span className="tip-text">Platos más vistos, horarios pico, tendencias semanales y comparativas</span></span></div>
                <div>✓ Botón llamar garzón <span className="tip">i<span className="tip-text">Tus clientes llaman al garzón desde la carta con un toque, sin levantar la mano</span></span></div>
                <div>✓ Carta en varios idiomas <span className="tip">i<span className="tip-text">Tu carta se traduce automáticamente a inglés, portugués y más. Ideal para turistas</span></span></div>
                <div>✓ Cumpleaños automáticos <span className="tip">i<span className="tip-text">El sistema detecta clientes que cumplen años y les envía una invitación especial</span></span></div>
                <div>✓ Clientes ilimitados <span className="tip">i<span className="tip-text">Registra todos los clientes que escanean tu carta, sin límite</span></span></div>
                <div>✓ Email marketing <span className="tip">i<span className="tip-text">Envía campañas y novedades por email a toda tu base de clientes</span></span></div>
                <div>✓ Integración con Toteat <span className="tip">i<span className="tip-text">Conecta tu POS Toteat para sincronizar carta, ver ventas reales y cruzar datos</span></span></div>
              </div>
              {!done ? (
                <button className="plan-btn" disabled={loading} onClick={() => handleActivar("PREMIUM")}>
                  {loading && selectedPlan === "PREMIUM" ? "Activando..." : "Activar Premium"}
                </button>
              ) : selectedPlan === "PREMIUM" ? (
                <div className="done-msg"><p>Activado.</p></div>
              ) : (
                <button className="plan-btn" disabled>Activar Premium</button>
              )}
            </article>
          </div>

        </section>

        {/* Final CTA */}
        <div className="divider" />
        <div style={{
          textAlign: "center", padding: "24px 20px", borderRadius: 26,
          background: "radial-gradient(circle at top, rgba(232,163,61,.14), transparent 60%), rgba(255,255,255,.03)",
          border: "1px solid rgba(232,163,61,.2)",
        }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Lleva tu restaurante al siguiente nivel</h2>
          <p style={{ color: "var(--cream-soft)", fontSize: 14, margin: "0 0 18px", lineHeight: 1.5 }}>
            Activa tu carta hoy y comienza a usarla cuando quieras.
          </p>
          {!done ? (
            <button
              disabled={loading}
              onClick={() => handleActivar("PREMIUM")}
              style={{
                width: "100%", maxWidth: 300, border: "2px solid var(--amber)", borderRadius: 999,
                padding: "14px 20px", background: "transparent", color: "var(--amber)",
                fontSize: 15, fontWeight: 800, cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading && selectedPlan === "PREMIUM" ? "Activando..." : "Activar Premium por $4.900"}
            </button>
          ) : (
            <div className="done-msg"><p>Activado. Redirigiendo a tu panel...</p></div>
          )}
        </div>
      </main>

      <Footer />
      <div style={{ textAlign: "center", color: "rgba(135,125,115,.5)", fontSize: 12, padding: "0 0 24px" }}>
        Creado en Santiago, Chile
      </div>
    </>
  );
}
