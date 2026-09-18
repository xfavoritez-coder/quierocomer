"use client";
import { useState } from "react";
import { User, Sparkles, Globe, Bell, Printer } from "lucide-react";
import LandingFooter from "@/components/landing/LandingFooter";
import SubirCartaModal from "@/components/landing/SubirCartaModal";

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [ucOpen, setUcOpen] = useState(false);
  const openModal = () => { setUcOpen(true); document.body.style.overflow = "hidden"; };
  const closeModal = () => { setUcOpen(false); document.body.style.overflow = ""; };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        :root {
          --yellow: #F59E1B;
          --yellow-hover: #E08D0C;
          --ink: #111111;
          --muted: #73736D;
          --paper: #FCFBF7;
          --white: #FFFFFF;
          --line: #EAE8E1;
          --max: 1080px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        body {
          background: var(--paper);
          color: var(--ink);
          font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        a { color: inherit; text-decoration: none; }
        button, input { font: inherit; }

        .lp-container {
          width: min(calc(100% - 32px), var(--max));
          margin: 0 auto;
        }

        /* NAV */
        .lp-header {
          height: 76px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: rgba(13,13,13,0.92);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .lp-logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 22px;
          font-weight: 850;
          letter-spacing: -.04em;
          text-decoration: none;
          color: #fff;
        }

        /* HERO — base (mobile first) */
        .lp-hero {
          position: relative;
          overflow: hidden;
          background: #080808;
          padding: 80px 24px 88px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: unset;
          padding: 100px 24px 108px;
        }
        @keyframes heroFloat {
          0%   { transform: scale(1)    translateY(0px); }
          50%  { transform: scale(1.04) translateY(-6px); }
          100% { transform: scale(1)    translateY(0px); }
        }
        .lp-hero-bg {
          position: absolute;
          inset: -8%;
          background-image: url('/hero.png');
          background-size: cover;
          background-position: center 55%;
          animation: heroFloat 14s ease-in-out infinite;
          will-change: transform;
        }
        .lp-hero-overlay {
          position: absolute;
          inset: 0;
          background: rgba(8,8,8,0.72);
        }
        .lp-hero-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 70% at 50% 50%, transparent 20%, rgba(0,0,0,0.82) 100%);
          pointer-events: none;
        }

        .lp-hero-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 100%;
          max-width: 560px;
        }

        .lp-eyebrow {
          margin-bottom: 18px;
          color: rgba(255,255,255,0.45);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .lp-hero h1 {
          font-size: clamp(48px, 11vw, 62px);
          line-height: 1.06;
          letter-spacing: -.04em;
          font-weight: 850;
          color: #fff;
          margin: 0;
          max-width: 420px;
        }

        .lp-hero-sub {
          margin: 22px auto 0;
          color: rgba(255,255,255,0.55);
          font-size: 20px;
          line-height: 1.65;
          max-width: 400px;
        }

        .lp-hero-cta {
          margin-top: 40px;
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .lp-hero-cta .lp-btn {
          min-height: 68px !important;
          padding: 0 48px !important;
          font-size: 22px !important;
          width: auto !important;
        }

        /* HERO DESKTOP */
        @media (min-width: 860px) {
          .lp-hero {
            min-height: unset;
            height: 84vh;
            max-height: 820px;
            padding: 0 24px;
          }
          .lp-hero::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 820px;
            height: 520px;
            background: radial-gradient(ellipse at center, rgba(244,166,35,0.18) 0%, rgba(244,166,35,0.05) 45%, transparent 70%);
            pointer-events: none;
          }
          .lp-hero-bg,
          .lp-hero-overlay,
          .lp-hero-vignette {
            display: none;
          }
          .lp-hero-content {
            max-width: 780px;
            padding-top: 0;
            margin-top: -60px;
          }
          .lp-hero-cta .lp-btn {
            min-height: 76px !important;
            padding: 0 64px !important;
            font-size: 24px !important;
          }
          .lp-hero h1 {
            font-size: clamp(48px, 5.5vw, 76px);
            max-width: 700px;
          }
          .lp-hero-sub {
            font-size: 21px;
            max-width: 520px;
          }
        }

        .lp-btn {
          border: 0;
          border-radius: 14px;
          background: var(--yellow);
          color: #fff;
          min-height: 60px;
          padding: 0 40px;
          font-size: 19px;
          font-weight: 850;
          letter-spacing: -.02em;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(245,158,27,.4);
          transition: .18s ease;
          white-space: nowrap;
        }

        .lp-btn:hover {
          background: var(--yellow-hover);
          transform: translateY(-2px);
          box-shadow: 0 16px 40px rgba(245,158,27,.5);
        }

        /* FEATURES SECTION */
        /* FEATURES SECTION */
        .lp-features {
          background: #fff;
          padding: 88px 0 96px;
        }
        .lp-features-head {
          text-align: center;
          margin-bottom: 52px;
        }
        .lp-features-head h2 {
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -.03em;
          color: #0D0D0D;
          margin: 0 0 10px;
        }
        .lp-features-head p {
          color: rgba(0,0,0,0.42);
          font-size: 17px;
          margin: 0;
        }
        .lp-features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        .lp-feat-card {
          background: #fff;
          border: 1px solid #EBEBEB;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          transition: box-shadow .2s, transform .2s;
        }
        .lp-feat-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          transform: translateY(-3px);
        }
        .lp-feat-visual {
          height: 148px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lp-feat-body {
          padding: 20px 22px 24px;
        }
        .lp-feat-card h3 {
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -.02em;
          color: #0D0D0D;
          margin: 0 0 6px;
        }
        .lp-feat-card p {
          font-size: 16px;
          color: rgba(0,0,0,0.48);
          line-height: 1.65;
          margin: 0;
        }

        /* FINAL CTA */
        .lp-final-cta {
          background: #0A0A0A;
          padding: 100px 24px 108px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .lp-final-cta::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -55%);
          width: 700px;
          height: 480px;
          background: radial-gradient(ellipse at center, rgba(244,166,35,0.13) 0%, rgba(244,166,35,0.04) 45%, transparent 70%);
          pointer-events: none;
        }
        .lp-final-cta-icon {
          position: relative;
          z-index: 1;
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 28px;
          color: #F4A623;
        }
        .lp-final-cta h2 {
          position: relative;
          z-index: 1;
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: clamp(40px, 5.5vw, 50px);
          font-weight: 800;
          letter-spacing: -.04em;
          color: #fff;
          margin: 0 0 16px;
          line-height: 1.1;
        }
        .lp-final-cta h2 span {
          color: #F4A623;
        }
        .lp-final-cta-sub {
          position: relative;
          z-index: 1;
          font-size: 18px;
          color: rgba(255,255,255,0.42);
          max-width: 400px;
          margin: 0 auto 36px;
          line-height: 1.6;
        }
        .lp-final-cta .lp-btn {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          width: auto;
          min-width: 220px;
        }

        @media (max-width: 580px) {
          .lp-features { padding: 60px 0 68px; }
          .lp-feat-visual { height: 110px; }
          .lp-final-cta { padding: 72px 24px; }
          .lp-feat-card h3 { font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .lp-feat-card p { font-size: 15px; }
          .lp-feat-body { padding: 14px 14px 18px; }
        }

        /* LOGOS STRIP */
        .lp-clients {
          padding: 24px 0;
          background: var(--paper);
          border-bottom: 1px solid var(--line);
        }
        .lp-clients-label {
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #B0AEA6;
          margin-bottom: 16px;
        }

        .lp-nav-ingresar {
          display: inline-flex;
          align-items: center;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
          text-decoration: none;
          padding: 8px 18px;
          border: 1.5px solid rgba(255,255,255,0.18);
          border-radius: 10px;
          background: transparent;
          transition: border-color .15s, background .15s;
          white-space: nowrap;
        }
        .lp-nav-ingresar:hover { border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.07); }

        /* VIDEO */
        .lp-video-section {
          background: #F5F2EB;
          padding: 58px 0 86px;
          border-top: 1px solid rgba(0,0,0,.04);
        }
        .lp-video-head {
          text-align: center;
          margin-bottom: 28px;
        }
        .lp-video-head h2 {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -.04em;
          line-height: 1.15;
          color: var(--ink);
        }
        .lp-video-head p {
          margin: 8px 0 0;
          color: #8C8982;
          font-size: 15px;
          letter-spacing: .01em;
        }
        .lp-video-wrap { width: min(100%, 640px); margin: 0 auto; }
        .lp-video-card {
          position: relative;
          overflow: hidden;
          aspect-ratio: 16/9;
          border-radius: 26px;
          background: #111;
          box-shadow: 0 24px 80px rgba(0,0,0,.10);
        }
        .lp-video-placeholder {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 50% 35%, rgba(255,212,0,.18), transparent 26%),
            linear-gradient(145deg, #202020 0%, #0E0E0E 100%);
          color: white;
        }
        .lp-video-center { max-width: 590px; padding: 34px; text-align: center; }
        .lp-play {
          width: 74px; height: 74px; margin: 0 auto 24px;
          border: 0; border-radius: 50%;
          background: var(--yellow); color: #111;
          display: grid; place-items: center;
          font-size: 22px; cursor: pointer;
          box-shadow: 0 14px 36px rgba(0,0,0,.24);
        }
        .lp-video-center strong {
          display: block;
          font-size: clamp(26px, 3vw, 40px);
          line-height: 1.04;
          letter-spacing: -.045em;
          font-weight: 800;
        }
        .lp-video-center span {
          display: block;
          margin-top: 12px;
          color: rgba(255,255,255,.58);
          font-size: 13px;
        }

        /* MODAL */
        .lp-velo {
          position: fixed;
          inset: 0;
          background: rgba(17,17,17,.58);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 90;
          padding: 24px;
          animation: lpFadeIn .2s ease;
        }
        @keyframes lpFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .lp-modal {
          background: var(--white);
          border-radius: 24px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 80px 34px 32px;
          position: relative;
          text-align: center;
          box-shadow: 0 30px 90px rgba(0,0,0,.32);
          animation: lpSlideUp .22s ease;
        }
        @keyframes lpSlideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .lp-modal h3 {
          margin: 0 0 28px;
          font-size: 28px;
          font-weight: 850;
          letter-spacing: -.045em;
          line-height: 1.08;
          color: var(--ink);
        }

        .lp-cerrar {
          position: absolute; top: 20px; right: 20px;
          background: none; border: 0; cursor: pointer;
          font-size: 26px; line-height: 1;
          color: #A09F97;
          width: 38px; height: 38px; border-radius: 50%;
          transition: .15s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .lp-cerrar:hover { background: var(--paper); color: var(--ink); }

        .lp-volver {
          position: absolute; top: 20px; left: 20px;
          background: none; border: 0; cursor: pointer;
          font-size: 14px; font-weight: 700;
          color: var(--muted);
          padding: 9px 12px; border-radius: 10px;
          transition: .15s ease;
        }
        .lp-volver:hover { background: var(--paper); color: var(--ink); }

        .lp-opcion {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          text-align: left;
          color: var(--ink);
          background: var(--white);
          border: 1.5px solid var(--line);
          border-radius: 16px;
          padding: 18px 20px;
          margin-bottom: 10px;
          cursor: pointer;
          transition: .15s ease;
        }
        .lp-opcion:hover { border-color: var(--ink); background: var(--paper); transform: translateY(-1px); }
        .lp-opcion svg { flex-shrink: 0; opacity: .7; }
        .lp-opcion-text { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .lp-opcion-title { font-size: 16px; font-weight: 700; letter-spacing: -.02em; }
        .lp-opcion-sub { font-size: 12px; color: var(--muted); font-weight: 400; }
        .lp-hint { font-size: 13px; color: var(--muted); margin-bottom: 14px; line-height: 1.5; }
        .lp-campo-label { display: block; font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 6px; text-align: left; }
        .lp-scratch-grid { display: grid; gap: 12px; text-align: left; margin-bottom: 14px; }

        /* SHOWCASE */
        .lp-showcase { padding: 80px 0 100px; }
        .lp-showcase-eyebrow {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #A3A098;
          margin-bottom: 50px;
        }
        .lp-logos-track-wrap { overflow: hidden; position: relative; }
        .lp-logos-track-wrap::before,
        .lp-logos-track-wrap::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0;
          width: 80px;
          z-index: 2;
          pointer-events: none;
        }
        .lp-logos-track-wrap::before { left: 0; background: linear-gradient(to right, var(--paper), transparent); }
        .lp-logos-track-wrap::after { right: 0; background: linear-gradient(to left, var(--paper), transparent); }
        .lp-logos-track {
          display: flex;
          gap: 16px;
          width: max-content;
          animation: lpScroll 30s linear infinite !important;
        }
        .lp-logos-track:hover { animation-play-state: paused; }
        @keyframes lpScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .lp-logo-card {
          width: 110px;
          flex-shrink: 0;
          min-height: 100px;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: rgba(255,255,255,.6);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px 10px;
          text-decoration: none;
          transition: .18s ease;
        }
        .lp-logo-card:hover { border-color: #bbb; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.07); }
        .lp-logo-card img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
        .lp-logo-card span { font-size: 12px; font-weight: 500; color: #76736D; text-align: center; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; display: block; }

        .lp-campo {
          width: 100%;
          border: 1.5px solid var(--line);
          border-radius: 14px;
          padding: 18px 20px;
          font-size: 16px;
          background: var(--paper);
          margin-bottom: 14px;
          text-align: left;
          outline: none;
          transition: .15s ease;
          display: block;
        }
        .lp-campo:focus { border-color: var(--ink); background: var(--white); }

        .lp-modal-btn {
          width: 100%;
          min-height: 56px;
          border: 0;
          border-radius: 14px;
          background: var(--yellow);
          color: #fff;
          font-size: 17px;
          font-weight: 850;
          letter-spacing: -.02em;
          cursor: pointer;
          transition: .18s ease;
          box-shadow: 0 8px 24px rgba(245,158,27,.22);
        }
        .lp-modal-btn:hover:not(:disabled) { background: var(--yellow-hover); transform: translateY(-1px); }
        .lp-modal-btn:disabled { opacity: .5; cursor: default; transform: none; }

        .lp-dropzone {
          border: 1.5px dashed rgba(17,17,17,.2);
          background: var(--paper);
          border-radius: 18px;
          padding: 32px 20px;
          margin-bottom: 16px;
          cursor: pointer;
          transition: .18s ease;
          text-align: center;
        }
        .lp-dropzone:hover { border-color: var(--ink); }

        .lp-thumbs { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px; }
        .lp-thumb { position: relative; width: 64px; height: 64px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); flex-shrink: 0; }
        .lp-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .lp-thumb-del {
          position: absolute; top: 2px; right: 2px;
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(0,0,0,.55); border: none; color: #fff;
          font-size: 12px; cursor: pointer; display: grid; place-items: center; padding: 0;
        }

        .lp-error { color: #e85d5d; font-size: 14px; margin-bottom: 12px; }

        @media (max-width: 760px) {
          .lp-container { width: min(calc(100% - 48px), var(--max)); }
          .lp-header { height: 64px; }
          .lp-logo { font-size: 20px; }
          .lp-video-section { padding: 44px 0 60px; }
          .lp-video-card { border-radius: 20px; aspect-ratio: 4/3; }
          .lp-showcase { padding: 60px 0 80px; }
          .lp-video-center { padding: 22px; }
          .lp-play { width: 62px; height: 62px; }
          .lp-modal { padding: 76px 22px 26px; }
          .lp-modal h3 { font-size: 24px; }
        }

        @media (max-width: 420px) {
          .lp-container { width: min(calc(100% - 40px), var(--max)); }
          .lp-hero h1 { font-size: 30px; }
          .lp-eyebrow { font-size: 10px; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
          html { scroll-behavior: auto; }
        }

        :focus-visible { outline: 3px solid var(--yellow); outline-offset: 3px; }
      `}</style>

      {/* HEADER */}
      <header className="lp-header">
        <div className="lp-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" className="lp-logo" aria-label="QuieroComer">
            <img src="/logo.png" alt="" style={{ width: 30, height: 30, objectFit: "contain", flexShrink: 0 }} />
            <span>QuieroComer</span>
          </a>
          <a href="/panel" className="lp-nav-ingresar"><User size={15} strokeWidth={2.2} style={{ marginRight: 6 }} />Ingresar</a>
        </div>
      </header>

      <main>

        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-hero-bg" style={{ backgroundPosition: "center 55%" }} />
          <div className="lp-hero-overlay" />
          <div className="lp-hero-vignette" />
          <div className="lp-hero-content">
<h1>Tu restaurante puede vender más.</h1>
            <p className="lp-hero-sub">
              Transforma tu carta en una herramienta que atrae, vende y fideliza a tus clientes.
            </p>
            <div className="lp-hero-cta">
              <button className="lp-btn" onClick={openModal}>
                Subir mi carta →
              </button>
            </div>
          </div>
        </section>

        {/* CLIENTES — logos en escala de grises rotando */}
        <section className="lp-clients">
          <p className="lp-clients-label">Restaurantes que ya usan QuieroComer</p>
          {(() => {
            const items = [
              { name: "Hand Roll", slug: "hand-roll", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/hand-roll/logo.png" },
              { name: "Horus Vegan", slug: "horusvegan", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/horusvegan/logo.png" },
              { name: "Juana la Brava", slug: "juana-la-brava", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1779212065016-vn71iczuzue.jpg" },
              { name: "Alleria Pizza", slug: "alleria-pizza", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1777477859043-9ibluljyt89.png" },
              { name: "El Menú de la Esquina", slug: "el-menu-de-la-esquina", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1787507811438-ffgc0wfstb.webp" },
              { name: "Guffsushi Nikkei", slug: "guffsushi", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1781291439973-bzmbjnjzwo.webp" },
              { name: "La Oveja Negra", slug: "la-oveja-negra-restaurante", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1781573105032-to2loqezh47.webp" },
              { name: "Entre Pisco Y Pebre", slug: "entre-pisco-y-pebre", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1785560529971-6n72tdb1cf7.webp" },
              { name: "Haruna", slug: "haruna", logo: "https://bjpqzmzciinnrwpofyrf.supabase.co/storage/v1/object/public/images/270e2313-2be3-4790-85a8-876e64f7bcd1/logos/1778689321363-C109DBC8-DAE3-4CF4-9C5A-E5577B6AAED5--1-.png" },
              { name: "Avenida Del Sabor", slug: "avenida-del-sabor", logo: "https://fudo-apps-storage.s3.sa-east-1.amazonaws.com/production/368718/images/4a39edf4-2e03-44fd-86c0-195f9762caec" },
            ];
            const doubled = [...items, ...items];
            return (
              <div className="lp-logos-track-wrap">
                <div className="lp-logos-track">
                  {doubled.map((r, i) => (
                    <a key={i} href={`https://quierocomer.com/${r.slug}`} target="_blank" rel="noopener noreferrer" className="lp-logo-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.logo} alt={r.name} loading="lazy" />
                      <span>{r.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>

        {/* VIDEO (placeholder) — oculto hasta tener el video */}
        <section className="lp-video-section" style={{ display: 'none' }}>
          <div className="lp-container">
            <div className="lp-video-head">
              <h2>Mira cómo funciona</h2>
              <p>En menos de 1 minuto.</p>
            </div>
            <div className="lp-video-wrap">
              <div className="lp-video-card">
                <div className="lp-video-placeholder">
                  <div className="lp-video-center">
                    <button className="lp-play" aria-label="Ver cómo funciona">▶</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="lp-features">
          <div className="lp-container">
            <div className="lp-features-head">
              <h2>Todo el marketing de tu restaurante, desde tu carta.</h2>
            </div>
            <div className="lp-features-grid">
              <div className="lp-feat-card">
                <div className="lp-feat-visual" style={{ background: "linear-gradient(135deg, #1A0E00 0%, #2d1a00 100%)", position: "relative", overflow: "hidden" }}>
                  {/* dots pattern */}
                  {[...Array(12)].map((_, i) => (
                    <div key={i} style={{
                      position: "absolute",
                      width: 28, height: 28, borderRadius: "50%",
                      border: "1.5px solid rgba(244,166,35,0.25)",
                      left: `${(i % 4) * 26 + 4}%`,
                      top: `${Math.floor(i / 4) * 38 + 12}%`,
                    }} />
                  ))}
                  <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 16px rgba(244,166,35,0.4)" }}>⭐</div>
                    <div style={{ background: "rgba(244,166,35,0.12)", border: "1px solid rgba(244,166,35,0.3)", borderRadius: 8, padding: "4px 14px", fontSize: 12, color: "#F4A623", fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.08em" }}>LOYALTY CARD</div>
                  </div>
                </div>
                <div className="lp-feat-body">
                  <h3>Programa de lealtad</h3>
                  <p>Tarjetas digitales de puntos y sellos para fidelizar clientes sin apps ni papel.</p>
                </div>
              </div>
              <div className="lp-feat-card">
                <div className="lp-feat-visual" style={{ background: "linear-gradient(135deg, #0d1f0d 0%, #162516 100%)", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "80%", maxWidth: 200 }}>
                    {/* mock order card */}
                    <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 16px", width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>Pedido #47</span>
                        <span style={{ fontSize: 10, background: "rgba(74,222,128,0.15)", color: "#4ade80", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>Nuevo</span>
                      </div>
                      {["Lomo a lo pobre", "Jugo de naranja"].map(item => (
                        <div key={item} style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", paddingLeft: 8, borderLeft: "2px solid rgba(244,166,35,0.4)", marginBottom: 3 }}>{item}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, color: "#4ade80", fontWeight: 700, letterSpacing: "0.02em" }}>Directo a tu cocina →</div>
                  </div>
                </div>
                <div className="lp-feat-body">
                  <h3>Pedidos online</h3>
                  <p>Recibe pedidos desde la carta directamente, sin llamadas ni comisiones de terceros.</p>
                </div>
              </div>
              <div className="lp-feat-card">
                <div className="lp-feat-visual">
                  <img src="/ff1.png" alt="Recomienda platos" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%", display: "block" }} />
                </div>
                <div className="lp-feat-body">
                  <h3>Recomienda platos</h3>
                  <p>Aprende las preferencias de cada cliente y reordena la carta a su gusto.</p>
                </div>
              </div>
              <div className="lp-feat-card">
                <div className="lp-feat-visual">
                  <img src="/ff2.png" alt="Habla su idioma" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div className="lp-feat-body">
                  <h3>Habla su idioma</h3>
                  <p>Tu carta se traduce sola al idioma del cliente.</p>
                </div>
              </div>
              <div className="lp-feat-card">
                <div className="lp-feat-visual">
                  <img src="/ff3.png" alt="Llama al garzón" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div className="lp-feat-body">
                  <h3>Llama al garzón</h3>
                  <p>Piden asistencia desde la carta, sin levantarse.</p>
                </div>
              </div>
              <div className="lp-feat-card">
                <div className="lp-feat-visual">
                  <img src="/f4.png" alt="También puedes imprimirla" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div className="lp-feat-body">
                  <h3>Imprímela con 1 click</h3>
                  <p>Genera una versión imprimible lista para poner en mesas.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="lp-final-cta">
          <h2>Tu carta ya existe.<br /><span>Haz que haga más.</span></h2>
          <p className="lp-final-cta-sub">Sube tu carta y activa todo un arsenal de marketing: carta QR, pedidos online, loyalty, traducción automática y más.</p>
          <button className="lp-btn" onClick={openModal}>Subir mi carta →</button>
        </section>

      </main>

      <LandingFooter />

      <SubirCartaModal open={ucOpen} onClose={closeModal} />
    </>
  );
}
