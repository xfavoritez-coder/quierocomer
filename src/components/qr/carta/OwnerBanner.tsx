"use client";

import { useState, useEffect } from "react";

interface Props {
  restaurantName: string;
  restaurantSlug: string;
  restaurantLogo?: string | null;
  restaurantId: string;
}

/**
 * Floating banner for logged-in restaurant owners viewing their own carta.
 * Validates ownership server-side — customers never see this.
 */
export default function OwnerBanner({ restaurantName, restaurantSlug, restaurantLogo, restaurantId }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [visits, setVisits] = useState<number | null>(null);

  useEffect(() => {
    // Quick client-side check: skip fetch if no panel cookies at all
    const cookies = document.cookie.split(";").map(c => c.trim());
    const hasPanel = cookies.some(c => c.startsWith("panel_demo=")) ||
                     cookies.some(c => c.startsWith("panel_logged=")) ||
                     cookies.some(c => c.startsWith("admin_token="));
    if (!hasPanel) return;

    // Validate ownership server-side
    fetch(`/api/qr/is-owner?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.isOwner) return;
        setTimeout(() => setVisible(true), 800);
        // Fetch today's visits
        fetch(`/api/qr/stats-mini?restaurantId=${restaurantId}`)
          .then(r => r.json())
          .then(d => setVisits(d.todayVisits ?? 0))
          .catch(() => {});
      })
      .catch(() => {});
  }, [restaurantId]);

  if (!visible || dismissed) return null;

  return (
    <>
      <div
        id="owner-banner"
        style={{
          position: "fixed",
          bottom: "calc(20px + env(safe-area-inset-bottom))",
          left: 16,
          zIndex: 55,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px 12px 16px",
          borderRadius: 20,
          background: "rgba(10,10,10,.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,.12)",
          boxShadow: "0 8px 32px rgba(0,0,0,.45)",
          animation: "ownerBannerIn 0.4s ease-out",
        }}
      >
        {/* Logo */}
        {restaurantLogo ? (
          <img src={restaurantLogo} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <span style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(244,166,35,.15)", display: "inline-grid", placeItems: "center", fontSize: 16, flexShrink: 0 }}>🍽</span>
        )}

        {/* Stats */}
        <span style={{
          flex: 1,
          fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.55)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          fontFamily: "var(--font-dm, system-ui, sans-serif)",
        }}>
          {visits !== null ? `👁 ${visits} visita${visits !== 1 ? "s" : ""} hoy` : restaurantName}
        </span>

        {/* Panel button */}
        <a
          href={`/api/panel/demo-auth?slug=${restaurantSlug}`}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 50,
            background: "linear-gradient(135deg, #ffc44f, #f3a333)",
            color: "#0a0a0a", fontSize: 14, fontWeight: 800,
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
            color: "rgba(255,255,255,.35)", fontSize: 20, lineHeight: 1,
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
