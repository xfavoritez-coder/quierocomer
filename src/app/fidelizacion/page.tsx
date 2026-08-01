"use client";
import LandingFooter from "@/components/landing/LandingFooter";
import { useLandingLang } from "@/lib/i18n/landing";

export default function FidelizacionPage() {
  const { t, fidSteps } = useLandingLang();
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        :root {
          --blanco: #FFFFFF;
          --tinta: #111111;
          --gris: #71716C;
          --gris-claro: #A8A8A2;
          --ambar: #F59E1B;
          --ambar-tinta: #8F5A05;
          --ambar-fondo: #FFF7EA;
          --linea: #ECECEA;
          --purpura: #6d28d9;
          --purpura-light: #8B5CF6;
          --purpura-dark: #4C1D95;
          --purpura-fondo: #FAF5FF;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Instrument Sans', sans-serif; }
        .fid-page { font-family: 'Instrument Sans', sans-serif; color: var(--tinta); }

        /* NAV */
        .fid-nav {
          position: sticky; top: 0; z-index: 100;
          background: rgba(76,29,149,0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .fid-nav-inner { max-width: 1200px; width: 100%; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
        .fid-nav-back { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.7); text-decoration: none; display: flex; align-items: center; gap: 6px; transition: color .2s; }
        .fid-nav-back:hover { color: white; }
        .fid-nav-cta { font-size: 14px; font-weight: 600; color: var(--purpura); background: white; border: none; border-radius: 8px; padding: 8px 18px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-block; transition: opacity .2s; }
        .fid-nav-cta:hover { opacity: 0.9; }

        /* HERO */
        .fid-hero {
          background: linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #6d28d9 100%);
          padding: 100px 24px 90px; text-align: center;
          position: relative; overflow: hidden;
        }
        .fid-hero::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.3) 0%, transparent 70%);
          pointer-events: none;
        }
        .fid-hero-inner { max-width: 760px; margin: 0 auto; position: relative; }
        .fid-label {
          display: inline-block;
          font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          color: #C4B5FD; border: 1px solid rgba(196,181,253,0.4);
          border-radius: 100px; padding: 5px 14px; margin-bottom: 28px;
        }
        .fid-hero h1 {
          font-size: clamp(40px, 7vw, 72px); font-weight: 700; color: white;
          line-height: 1.05; letter-spacing: -0.03em; margin-bottom: 20px;
        }
        .fid-hero-sub { font-size: 18px; color: rgba(255,255,255,0.65); line-height: 1.65; margin-bottom: 40px; max-width: 520px; margin-left: auto; margin-right: auto; }
        .fid-hero-cta { display: flex; gap: 14px; justify-content: center; align-items: center; flex-wrap: wrap; }
        .fid-btn-white { font-size: 16px; font-weight: 700; color: var(--purpura-dark); background: white; border: none; border-radius: 12px; padding: 14px 32px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-block; transition: opacity .2s; }
        .fid-btn-white:hover { opacity: 0.9; }
        .fid-btn-outline { font-size: 15px; font-weight: 600; color: white; background: transparent; border: 1.5px solid rgba(255,255,255,0.3); border-radius: 12px; padding: 13px 28px; text-decoration: none; display: inline-block; transition: border-color .2s, background .2s; }
        .fid-btn-outline:hover { border-color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.07); }

        /* HOW IT WORKS */
        .fid-how { padding: 80px 24px; background: white; }
        .fid-how-inner { max-width: 900px; margin: 0 auto; }
        .fid-how h2 { font-size: clamp(26px, 4vw, 40px); font-weight: 700; color: var(--tinta); letter-spacing: -0.02em; text-align: center; margin-bottom: 56px; }
        .fid-steps { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        @media (max-width: 640px) { .fid-steps { grid-template-columns: 1fr; } }
        .fid-step { background: var(--purpura-fondo); border: 1.5px solid rgba(109,40,217,0.12); border-radius: 16px; padding: 28px; }
        .fid-step-num { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; background: var(--purpura); color: white; border-radius: 50%; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .fid-step-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .fid-step-desc-row { display: flex; align-items: flex-start; gap: 10px; }
        .fid-step-icon { font-size: 20px; line-height: 1; flex-shrink: 0; margin-top: 1px; }
        .fid-step h3 { font-size: 16px; font-weight: 700; color: var(--tinta); }
        .fid-step p { font-size: 14px; color: var(--gris); line-height: 1.65; margin: 0; }

        /* CERCANIA */
        .fid-cercania { padding: 80px 24px; background: #0F0A1E; }
        .fid-cercania-inner { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 40px; align-items: center; }
        @media (max-width: 680px) { .fid-cercania-inner { grid-template-columns: 1fr; } }
        .fid-cercania h2 { font-size: clamp(24px, 4vw, 38px); font-weight: 700; color: white; letter-spacing: -0.02em; margin-bottom: 16px; line-height: 1.15; }
        .fid-cercania p { font-size: 16px; color: rgba(255,255,255,0.6); line-height: 1.65; }

        /* Phone notification mock */
        .fid-phone-wrap { flex-shrink: 0; }
        .fid-phone {
          width: 220px; height: 380px;
          background: #1A1A2E; border-radius: 36px;
          border: 6px solid #2A2A3E;
          box-shadow: 0 20px 60px rgba(109,40,217,0.3);
          overflow: hidden; position: relative;
        }
        .fid-phone-notch {
          width: 80px; height: 20px;
          background: #1A1A2E; border-radius: 0 0 14px 14px;
          margin: 0 auto; position: relative; z-index: 2;
        }
        .fid-phone-screen {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, #0F0A1E 0%, #1e1b4b 100%);
          display: flex; flex-direction: column; padding: 48px 16px 20px;
        }
        .fid-notification {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-radius: 16px; padding: 14px;
          border: 1px solid rgba(255,255,255,0.15);
        }
        .fid-notif-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .fid-notif-app-icon { width: 20px; height: 20px; border-radius: 5px; background: var(--purpura); display: flex; align-items: center; justify-content: center; font-size: 10px; }
        .fid-notif-app-name { font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 600; }
        .fid-notif-time { font-size: 11px; color: rgba(255,255,255,0.4); margin-left: auto; }
        .fid-notif-title { font-size: 13px; font-weight: 700; color: white; margin-bottom: 3px; }
        .fid-notif-body { font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.4; }
        .fid-phone-time { text-align: center; color: white; margin-top: auto; }
        .fid-phone-time h4 { font-size: 36px; font-weight: 200; letter-spacing: -0.02em; }
        .fid-phone-time p { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px; }

        /* CTA */
        .fid-cta {
          padding: 72px 24px; text-align: center;
          background: linear-gradient(135deg, var(--purpura-dark) 0%, var(--purpura) 100%);
        }
        .fid-cta h2 { font-size: clamp(26px, 4vw, 40px); font-weight: 700; color: white; letter-spacing: -0.02em; margin-bottom: 10px; }
        .fid-cta p { font-size: 16px; color: rgba(255,255,255,0.7); margin-bottom: 32px; }
        .fid-cta-btn { display: inline-block; font-size: 16px; font-weight: 700; color: var(--purpura-dark); background: white; border-radius: 12px; padding: 14px 36px; text-decoration: none; transition: opacity .2s; }
        .fid-cta-btn:hover { opacity: 0.9; }

        @media (max-width: 680px) {
          .fid-hero { padding: 72px 20px 64px; }
          .fid-how { padding: 56px 20px; }
          .fid-cercania { padding: 56px 20px; }
          .fid-phone-wrap { display: flex; justify-content: center; }
        }
      `}</style>

      <div className="fid-page">

        {/* NAV */}
        <nav className="fid-nav">
          <div className="fid-nav-inner">
            <a href="/" className="fid-nav-back">{t("nav_back")}</a>
            <a href="/" className="fid-nav-cta">{t("nav_cta")}</a>
          </div>
        </nav>

        {/* HERO */}
        <section className="fid-hero">
          <div className="fid-hero-inner">
            <span className="fid-label">{t("fid_label")}</span>
            <h1>{t("fid_hero_title")}</h1>
            <p className="fid-hero-sub">
              {t("fid_hero_subtitle")}
            </p>
            <div className="fid-hero-cta">
              <a href="https://quierocomer.com/fidelidad/hand-roll" target="_blank" rel="noopener noreferrer" className="fid-btn-white">
                {t("fid_hero_cta1")}
              </a>
              <a href="/" className="fid-btn-outline">
                {t("fid_hero_cta2")}
              </a>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="fid-how">
          <div className="fid-how-inner">
            <h2>{t("fid_how_title")}</h2>
            <div className="fid-steps">
              {fidSteps.map((s) => (
                <div key={s.num} className="fid-step">
                  <div className="fid-step-title-row">
                    <div className="fid-step-num">{s.num}</div>
                    <h3>{s.title}</h3>
                  </div>
                  <div className="fid-step-desc-row">
                    <span className="fid-step-icon">{s.icon}</span>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CERCANÍA */}
        <section className="fid-cercania">
          <div className="fid-cercania-inner">
            <div>
              <h2>{t("fid_proximity_title")}</h2>
              <p>
                {t("fid_proximity_subtitle")}
              </p>
            </div>
            <div className="fid-phone-wrap">
              <div className="fid-phone">
                <div className="fid-phone-screen">
                  <div className="fid-phone-time">
                    <h4>14:23</h4>
                    <p>{t("fid_phone_date")}</p>
                  </div>
                  <div style={{ marginTop: 24 }}>
                    <div className="fid-notification">
                      <div className="fid-notif-header">
                        <div className="fid-notif-app-icon">⭐</div>
                        <span className="fid-notif-app-name">{t("fid_notif_app")}</span>
                        <span className="fid-notif-time">{t("fid_notif_now")}</span>
                      </div>
                      <div className="fid-notif-title">{t("fid_notif_title")}</div>
                      <div className="fid-notif-body">
                        {t("fid_notif_body")}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="fid-phone-notch"></div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="fid-cta">
          <h2>{t("fid_bottom_title")}</h2>
          <p>{t("fid_bottom_subtitle")}</p>
          <a href="/" className="fid-cta-btn">{t("fid_bottom_cta")}</a>
        </section>

        <LandingFooter />

      </div>
    </>
  );
}
