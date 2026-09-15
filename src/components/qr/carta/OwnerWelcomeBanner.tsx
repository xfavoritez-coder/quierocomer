"use client";

import { useEffect, useState } from "react";

interface Props {
  slug: string;
  token: string;
}

export default function OwnerWelcomeBanner({ slug, token }: Props) {
  const [state, setState] = useState<{
    panelUrl: string;
    restaurantName: string;
    logoUrl: string | null;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    const sessionKey = `owb_${slug}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(sessionKey)) return;

    fetch("/api/qr/owner-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid && data.panelUrl) {
          setState({ panelUrl: data.panelUrl, restaurantName: data.restaurantName || "", logoUrl: data.logoUrl || null });
          setTimeout(() => setVisible(true), 500);
        }
      })
      .catch(() => {});
  }, [slug, token]);

  const dismiss = () => {
    setHiding(true);
    try { sessionStorage.setItem(`owb_${slug}`, "1"); } catch {}
    setTimeout(() => setState(null), 380);
  };

  if (!state) return null;

  const initials = state.restaurantName.split(" ").map((w: string) => w[0] || "").join("").slice(0, 2).toUpperCase();

  return (
    <>
      <style>{`
        @keyframes owbFadeIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes owbFadeOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(12px) scale(0.97); }
        }
        @keyframes owbShine {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .owb-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0 12px 20px;
          pointer-events: none;
        }
        .owb-card {
          pointer-events: all;
          width: 100%;
          max-width: 440px;
          background: #0E0A06;
          border: 1px solid rgba(244,166,35,0.3);
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 -2px 0 rgba(244,166,35,0.15), 0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
          animation: owbFadeIn 0.45s cubic-bezier(0.16,1,0.3,1) both;
        }
        .owb-card.hiding {
          animation: owbFadeOut 0.35s ease forwards;
        }
        .owb-top-bar {
          height: 3px;
          background: linear-gradient(90deg, #F4A623, #FBBF4A, #F4A623);
          background-size: 200% auto;
          animation: owbShine 3s linear infinite;
        }
        .owb-body {
          padding: 20px;
        }
        .owb-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .owb-logo {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          flex-shrink: 0;
          overflow: hidden;
          object-fit: cover;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .owb-logo-placeholder {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          flex-shrink: 0;
          background: rgba(244,166,35,0.15);
          border: 1px solid rgba(244,166,35,0.25);
          display: grid;
          place-items: center;
          font-size: 15px;
          font-weight: 700;
          color: #F4A623;
          letter-spacing: 0.02em;
        }
        .owb-title {
          font-size: 15px;
          font-weight: 700;
          color: #F5EAD4;
          line-height: 1.25;
          margin: 0 0 3px;
          letter-spacing: -0.02em;
        }
        .owb-sub {
          font-size: 12.5px;
          color: rgba(255,255,255,0.45);
          margin: 0;
          line-height: 1.4;
        }
        .owb-dismiss {
          margin-left: auto;
          align-self: flex-start;
          background: none;
          border: none;
          color: rgba(255,255,255,0.25);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          padding: 0 0 0 8px;
          flex-shrink: 0;
          transition: color 0.15s;
        }
        .owb-dismiss:hover { color: rgba(255,255,255,0.55); }
        .owb-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          width: 100%;
          padding: 14px;
          background: #F4A623;
          border: none;
          border-radius: 14px;
          color: #1A0900;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.02em;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 4px 20px rgba(244,166,35,0.35);
          transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .owb-cta:hover {
          background: #E09316;
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(244,166,35,0.45);
        }
        .owb-cta:active { transform: scale(0.98); }
        .owb-cta-arrow {
          font-size: 18px;
          line-height: 1;
          transition: transform 0.15s;
        }
        .owb-cta:hover .owb-cta-arrow { transform: translateX(2px); }
        .owb-hint {
          text-align: center;
          font-size: 11px;
          color: rgba(255,255,255,0.2);
          margin-top: 10px;
        }
      `}</style>

      <div className="owb-overlay">
        <div className={`owb-card${hiding ? " hiding" : ""}`} style={{ opacity: visible ? 1 : 0, transition: visible ? "none" : "opacity 0.1s" }}>
          <div className="owb-top-bar" />
          <div className="owb-body">
            <div className="owb-header">
              {state.logoUrl ? (
                <img src={state.logoUrl} alt="" className="owb-logo" />
              ) : (
                <div className="owb-logo-placeholder">{initials}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="owb-title">Tu carta ya está activa ✨</p>
                <p className="owb-sub">Sube fotos y personalízala para que se vea increíble.</p>
              </div>
              <button className="owb-dismiss" onClick={dismiss} aria-label="Cerrar">×</button>
            </div>

            <a href={state.panelUrl} className="owb-cta">
              Entrar a mi panel
              <span className="owb-cta-arrow">→</span>
            </a>

            <p className="owb-hint">Solo verás esto una vez</p>
          </div>
        </div>
      </div>
    </>
  );
}
