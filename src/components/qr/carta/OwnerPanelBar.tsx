"use client";

import { useEffect, useState } from "react";

const LS_KEY = (slug: string) => `opb_entered_${slug}`;
const BAR_H = 48;

export default function OwnerPanelBar({ slug }: { slug: string }) {
  const panelUrl = `/api/panel/demo-auth?slug=${slug}`;
  const [visible, setVisible] = useState(false);
  const [hiddenByModal, setHiddenByModal] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(LS_KEY(slug))) setVisible(true);
    } catch {}
  }, [slug]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--opb-h", visible && !hiddenByModal ? `${BAR_H}px` : "0px");
    return () => root.style.setProperty("--opb-h", "0px");
  }, [visible, hiddenByModal]);

  // Ocultar cuando un modal esté abierto (body gets overflow:hidden o position:fixed)
  useEffect(() => {
    if (!visible) return;
    const check = () => {
      const overflow = document.body.style.overflow;
      const position = document.body.style.position;
      setHiddenByModal(overflow === "hidden" || position === "fixed");
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
    return () => observer.disconnect();
  }, [visible]);

  /** Ocultar localmente + marcar server-side para todos los devices */
  const dismiss = () => {
    try { localStorage.setItem(LS_KEY(slug), "1"); } catch {}
    setVisible(false);
    // Fire-and-forget: setea panelVisitedAt e invalida ISR cache
    fetch("/api/qr/banner-dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  };

  if (!visible || hiddenByModal) return null;

  return (
    <>
      <style>{`
        .opb {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 99999;
          height: ${BAR_H}px;
          background: linear-gradient(90deg, #1A0E00 0%, #0F0A04 50%, #1A0E00 100%);
          border-bottom: 1px solid rgba(244,166,35,0.25);
          display: flex;
          align-items: center;
        }
        .opb-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 0 16px;
          width: 100%;
          max-width: 640px;
          margin: 0 auto;
          position: relative;
        }
        .opb-text {
          font-family: "Inter", system-ui, sans-serif;
          font-size: 16px;
          font-weight: 400;
          color: rgba(255,255,255,0.68);
          white-space: nowrap;
        }
        .opb-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 14px;
          background: #F4A623;
          border: none;
          border-radius: 20px;
          color: #1A0900;
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.02em;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: 0 2px 10px rgba(244,166,35,0.3);
          transition: opacity .15s;
        }
        .opb-btn:hover { opacity: 0.88; }
        .opb-close {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.5);
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 4px;
          transition: color .15s;
        }
        .opb-close:hover { color: rgba(255,255,255,0.85); }
      `}</style>

      {/* Spacer en el flujo para empujar el contenido */}
      <div style={{ height: BAR_H }} />

      <div className="opb">
        <div className="opb-inner">
          <span className="opb-text">¿Quieres editar algo?</span>
          <a href={panelUrl} className="opb-btn" onClick={dismiss}>
            Ir al panel →
          </a>
          <button className="opb-close" onClick={dismiss} aria-label="Cerrar">×</button>
        </div>
      </div>
    </>
  );
}
