"use client";

import { useEffect, useState } from "react";

interface Props {
  slug: string;
  token: string;
}

export default function OwnerWelcomeBanner({ slug, token }: Props) {
  const [valid, setValid] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  const panelUrl = `/api/panel/demo-auth?slug=${slug}&ot=${token}`;

  useEffect(() => {
    const lsKey = `owb_clicked_${slug}`;
    if (typeof localStorage !== "undefined" && localStorage.getItem(lsKey)) return;

    fetch("/api/qr/owner-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setValid(true);
          setTimeout(() => setVisible(true), 400);
        }
      })
      .catch(() => {});
  }, [slug, token]);

  const dismiss = () => {
    setHiding(true);
    setTimeout(() => setValid(false), 350);
  };

  const handlePanelClick = () => {
    try { localStorage.setItem(`owb_clicked_${slug}`, "1"); } catch {}
  };

  if (!valid) return null;

  return (
    <>
      <style>{`
        @keyframes owbUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes owbDown {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(16px); }
        }
        .owb-wrap {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0 16px 24px;
          pointer-events: none;
        }
        .owb-card {
          pointer-events: all;
          width: 100%;
          max-width: 420px;
          background: #18120A;
          border: 1px solid rgba(244,166,35,0.22);
          border-radius: 22px;
          padding: 20px 20px 16px;
          box-shadow: 0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
          animation: owbUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        .owb-card.hiding { animation: owbDown 0.32s ease forwards; }
        .owb-top {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }
        .owb-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          background: rgba(244,166,35,0.14);
          border: 1px solid rgba(244,166,35,0.25);
          display: grid;
          place-items: center;
          flex-shrink: 0;
          font-size: 22px;
          line-height: 1;
        }
        .owb-text { flex: 1; min-width: 0; }
        .owb-title {
          font-size: 16px;
          font-weight: 700;
          color: #F5EAD4;
          margin: 0 0 5px;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .owb-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.45);
          margin: 0;
          line-height: 1.45;
        }
        .owb-close {
          background: none;
          border: none;
          color: rgba(255,255,255,0.25);
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          transition: color 0.15s;
          margin-top: -2px;
        }
        .owb-close:hover { color: rgba(255,255,255,0.6); }
        .owb-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 15px;
          background: #F4A623;
          border: none;
          border-radius: 14px;
          color: #1A0900;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.025em;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 4px 20px rgba(244,166,35,0.3);
          transition: background 0.15s, transform 0.12s;
        }
        .owb-btn:hover { background: #E09316; transform: translateY(-1px); }
        .owb-btn:active { transform: scale(0.98); }
      `}</style>

      <div className="owb-wrap">
        <div className={`owb-card${hiding ? " hiding" : ""}`} style={{ opacity: visible ? 1 : 0, transition: visible ? "none" : "opacity 0.1s" }}>
          <div className="owb-top">
            <div className="owb-icon">✦</div>
            <div className="owb-text">
              <p className="owb-title">Tu carta ya está lista ✨</p>
              <p className="owb-sub">Tus clientes ya pueden verla. Personalízala con tu logo, colores y fotografías.</p>
            </div>
            <button className="owb-close" onClick={dismiss} aria-label="Cerrar">×</button>
          </div>

          <a href={panelUrl} className="owb-btn" onClick={handlePanelClick}>
            Entrar a mi panel →
          </a>
        </div>
      </div>
    </>
  );
}
