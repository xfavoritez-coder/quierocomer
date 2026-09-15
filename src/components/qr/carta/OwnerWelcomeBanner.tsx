"use client";

import { useEffect, useState } from "react";

interface Props {
  slug: string;
  token: string;
}

/**
 * OwnerWelcomeBanner
 *
 * Shown when the carta is opened with an owner token (?ot=...).
 * On mount it calls POST /api/qr/owner-token to validate and consume the token.
 * If valid, shows a welcome banner with a direct panel autologin button.
 * Once dismissed, the banner does not appear again in the same session.
 */
export default function OwnerWelcomeBanner({ slug, token }: Props) {
  const [panelUrl, setPanelUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    const sessionKey = `owner_banner_dismissed_${slug}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(sessionKey)) {
      return;
    }

    // Validate and consume the token
    fetch("/api/qr/owner-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid && data.panelUrl) {
          setPanelUrl(data.panelUrl);
          // Small delay to let the carta render first, then slide in
          setTimeout(() => setVisible(true), 600);
        }
      })
      .catch(() => {});
  }, [slug, token]);

  const handleDismiss = () => {
    setVisible(false);
    const sessionKey = `owner_banner_dismissed_${slug}`;
    try { sessionStorage.setItem(sessionKey, "1"); } catch {}
    setTimeout(() => setDismissed(true), 350);
  };

  if (dismissed || !panelUrl) return null;

  return (
    <>
      <style>{`
        @keyframes ownerBannerSlideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ownerBannerSlideDown {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(100%); }
        }
        .owner-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          padding: 0 12px 12px;
          pointer-events: none;
        }
        .owner-banner-card {
          background: #1A1410;
          border: 1px solid rgba(244,166,35,0.35);
          border-radius: 20px;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 -4px 40px rgba(244,166,35,0.12), 0 8px 32px rgba(0,0,0,0.4);
          max-width: 520px;
          margin: 0 auto;
          pointer-events: all;
          animation: ownerBannerSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        .owner-banner-card.hiding {
          animation: ownerBannerSlideDown 0.3s ease forwards;
        }
        .owner-banner-icon {
          font-size: 26px;
          flex-shrink: 0;
          line-height: 1;
        }
        .owner-banner-body {
          flex: 1;
          min-width: 0;
        }
        .owner-banner-title {
          font-size: 14px;
          font-weight: 700;
          color: #F4C55A;
          margin: 0 0 3px;
          letter-spacing: -0.01em;
          line-height: 1.25;
        }
        .owner-banner-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          margin: 0;
          line-height: 1.4;
        }
        .owner-banner-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .owner-banner-cta {
          background: #F4A623;
          color: #1A0E00;
          font-size: 13px;
          font-weight: 800;
          padding: 9px 16px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          box-shadow: 0 4px 16px rgba(244,166,35,0.30);
          transition: background 0.15s, transform 0.15s;
        }
        .owner-banner-cta:hover {
          background: #E09820;
          transform: translateY(-1px);
        }
        .owner-banner-dismiss {
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.35);
          font-size: 18px;
          line-height: 1;
          padding: 4px;
          transition: color 0.15s;
          flex-shrink: 0;
        }
        .owner-banner-dismiss:hover {
          color: rgba(255,255,255,0.7);
        }
        @media (max-width: 480px) {
          .owner-banner-card {
            flex-wrap: wrap;
            gap: 10px;
          }
          .owner-banner-actions {
            width: 100%;
            justify-content: space-between;
          }
          .owner-banner-cta {
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>

      <div className="owner-banner">
        <div className={`owner-banner-card${!visible ? " hiding" : ""}`}>
          <span className="owner-banner-icon">✨</span>
          <div className="owner-banner-body">
            <p className="owner-banner-title">¡Tu carta QuieroComer está activa!</p>
            <p className="owner-banner-sub">Esta es la versión base — entra al panel para agregar fotos y personalizarla.</p>
          </div>
          <div className="owner-banner-actions">
            <a href={panelUrl} className="owner-banner-cta">
              Entrar a mi panel <span>→</span>
            </a>
            <button
              className="owner-banner-dismiss"
              onClick={handleDismiss}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
