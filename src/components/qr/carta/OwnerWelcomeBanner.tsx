"use client";

import { useEffect, useState } from "react";

interface Props {
  slug: string;
  token: string;
}

export default function OwnerWelcomeBanner({ slug, token }: Props) {
  const [valid, setValid] = useState(false);
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
        if (data.valid) setValid(true);
      })
      .catch(() => {});
  }, [slug, token]);

  const dismiss = () => {
    setHiding(true);
    setTimeout(() => setValid(false), 300);
  };

  const handlePanelClick = () => {
    try { localStorage.setItem(`owb_clicked_${slug}`, "1"); } catch {}
  };

  if (!valid) return null;

  return (
    <>
      <style>{`
        @keyframes owbSlideDown {
          from { opacity: 0; transform: translateY(-100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes owbSlideUp {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-100%); }
        }
        .owb-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          background: #0F0A04;
          animation: owbSlideDown 0.35s cubic-bezier(0.16,1,0.3,1) both;
        }
        .owb-bar.hiding {
          animation: owbSlideUp 0.3s ease forwards;
        }
        .owb-inner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          max-width: 640px;
          margin: 0 auto;
        }
        .owb-copy {
          flex: 1;
          min-width: 0;
        }
        .owb-title {
          font-size: 14px;
          font-weight: 700;
          color: #F5EAD4;
          margin: 0;
          line-height: 1.25;
          letter-spacing: -0.01em;
        }
        .owb-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          margin: 1px 0 0;
          line-height: 1.3;
        }
        .owb-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 8px 14px;
          background: #F4A623;
          border: none;
          border-radius: 20px;
          color: #1A0900;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .owb-btn:hover { opacity: 0.85; }
        .owb-close {
          background: none;
          border: none;
          color: rgba(255,255,255,0.3);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          transition: color 0.15s;
        }
        .owb-close:hover { color: rgba(255,255,255,0.7); }
      `}</style>

      <div className={`owb-bar${hiding ? " hiding" : ""}`}>
        <div className="owb-inner">
          <div className="owb-copy">
            <p className="owb-title">✨ Tu carta ya está lista</p>
            <p className="owb-sub">Personalízala con tu logo, colores y fotos.</p>
          </div>
          <a href={panelUrl} className="owb-btn" onClick={handlePanelClick}>
            Entrar a mi panel →
          </a>
          <button className="owb-close" onClick={dismiss} aria-label="Cerrar">×</button>
        </div>
      </div>
    </>
  );
}
