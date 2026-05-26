"use client";

import { useState, useEffect } from "react";

interface Props {
  restaurantName: string;
  restaurantSlug: string;
  restaurantLogo?: string | null;
  restaurantId: string;
}

/**
 * Slim floating banner for logged-in restaurant owners viewing their own carta.
 * Only visible if panel_token cookie exists (checked client-side).
 * Customers never see this.
 */
export default function OwnerBanner({ restaurantName, restaurantSlug, restaurantLogo, restaurantId }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [visits, setVisits] = useState<number | null>(null);

  // Check if owner is logged in via panel cookie
  useEffect(() => {
    const cookies = document.cookie.split(";").map(c => c.trim());
    const isLogged = cookies.some(c => c.startsWith("panel_demo=")) || cookies.some(c => c.startsWith("panel_logged="));
    if (isLogged) {
      setTimeout(() => setVisible(true), 800);
      // Fetch today's visits
      fetch(`/api/qr/stats-mini?restaurantId=${restaurantId}`)
        .then(r => r.json())
        .then(d => setVisits(d.todayVisits ?? 0))
        .catch(() => {});
    }
  }, [restaurantId]);

  if (!visible || dismissed) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: "calc(16px + env(safe-area-inset-bottom))",
          left: 16,
          zIndex: 55,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px 8px 12px",
          borderRadius: 50,
          background: "rgba(10,10,10,.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,.1)",
          boxShadow: "0 8px 32px rgba(0,0,0,.4)",
          animation: "ownerBannerIn 0.4s ease-out",
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        {/* Logo */}
        {restaurantLogo ? (
          <img src={restaurantLogo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(244,166,35,.15)", display: "inline-grid", placeItems: "center", fontSize: 12, flexShrink: 0 }}>🍽</span>
        )}

        {/* Stats */}
        <span style={{
          fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.5)",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-dm, system-ui, sans-serif)",
        }}>
          {visits !== null ? `👁 ${visits} visita${visits !== 1 ? "s" : ""} hoy` : restaurantName}
        </span>

        {/* Panel button */}
        <a
          href={`/api/panel/demo-auth?slug=${restaurantSlug}`}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 14px", borderRadius: 50,
            background: "linear-gradient(135deg, #ffc44f, #f3a333)",
            color: "#0a0a0a", fontSize: 12, fontWeight: 800,
            textDecoration: "none", whiteSpace: "nowrap",
            fontFamily: "var(--font-dm, system-ui, sans-serif)",
          }}
        >
          Mi panel
        </a>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,.3)", fontSize: 16, lineHeight: 1,
            padding: "2px 4px", flexShrink: 0,
          }}
        >×</button>
      </div>

      <style>{`
        @keyframes ownerBannerIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
