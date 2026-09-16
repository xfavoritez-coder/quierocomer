"use client";

import { useEffect, useState } from "react";

const LS_KEY = (slug: string) => `opb_entered_${slug}`;

export default function OwnerPanelBar({ slug }: { slug: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(LS_KEY(slug))) setVisible(true);
    } catch {}
  }, [slug]);

  useEffect(() => {
    document.documentElement.style.setProperty("--opb-h", visible ? "44px" : "0px");
    return () => document.documentElement.style.setProperty("--opb-h", "0px");
  }, [visible]);

  const dismiss = () => {
    try { localStorage.setItem(LS_KEY(slug), "1"); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        .opb {
          position: sticky;
          top: 0;
          z-index: 99999;
          background: linear-gradient(90deg, #1A0E00 0%, #0F0A04 50%, #1A0E00 100%);
          border-bottom: 1px solid rgba(244,166,35,0.25);
        }
        .opb-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 11px 16px;
          max-width: 640px;
          margin: 0 auto;
          position: relative;
        }
        .opb-text {
          font-family: "Inter", system-ui, sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.65);
          letter-spacing: -0.01em;
          white-space: nowrap;
        }
        .opb-text strong {
          font-family: "Space Grotesk", system-ui, sans-serif;
          color: #fff;
          font-weight: 700;
          letter-spacing: -0.03em;
        }
        .opb-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 16px;
          background: #F4A623;
          border: none;
          border-radius: 20px;
          color: #1A0900;
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.02em;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: 0 2px 12px rgba(244,166,35,0.35);
          transition: opacity .15s, transform .1s;
        }
        .opb-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .opb-btn:active { transform: scale(0.97); }
        .opb-close {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: rgba(255,255,255,0.25);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          padding: 4px;
          transition: color .15s;
        }
        .opb-close:hover { color: rgba(255,255,255,0.6); }
      `}</style>
      <div className="opb">
        <div className="opb-inner">
          <span className="opb-text"><strong>¿Quieres cambiar algo?</strong></span>
          <a href="/panel" className="opb-btn" onClick={dismiss}>
            Entrar a mi panel →
          </a>
          <button className="opb-close" onClick={dismiss} aria-label="Cerrar">×</button>
        </div>
      </div>
    </>
  );
}
