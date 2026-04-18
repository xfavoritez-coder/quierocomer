"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Image from "next/image";
import { getGuestId } from "@/lib/guestId";

interface Props {
  restaurantId: string;
}

interface Promo {
  id: string;
  name: string;
  description: string | null;
  discountPct: number | null;
  promoPrice: number | null;
  originalPrice: number | null;
  dishes: { id: string; name: string; photos: string[]; price: number }[];
}

const DISMISS_KEY = "quierocomer_promo_dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function PromoBanner({ restaurantId }: Props) {
  const [promo, setPromo] = useState<Promo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(`${DISMISS_KEY}_${restaurantId}`);
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < DISMISS_DURATION) return;

    // Check if already shown this session
    if (sessionStorage.getItem(`${DISMISS_KEY}_${restaurantId}`)) return;

    const guestId = getGuestId();
    fetch(`/api/qr/promos?restaurantId=${restaurantId}&guestId=${guestId}`)
      .then(r => r.json())
      .then(d => {
        if (d.promo) {
          setPromo(d.promo);
          // Track PROMO_VIEWED
          fetch("/api/qr/stats", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventType: "QR_SCAN", restaurantId, guestId, sessionId: guestId }),
          }).catch(() => {});
          // Show with delay
          setTimeout(() => setVisible(true), 2000);
        }
      })
      .catch(() => {});
  }, [restaurantId]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setDismissed(true), 300);
    localStorage.setItem(`${DISMISS_KEY}_${restaurantId}`, String(Date.now()));
    sessionStorage.setItem(`${DISMISS_KEY}_${restaurantId}`, "1");
  };

  if (dismissed || !promo) return null;

  const dish = promo.dishes[0];

  return (
    <div
      className="fixed font-[family-name:var(--font-dm)]"
      style={{
        bottom: 100, left: 12, right: 12, zIndex: 70,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.3s ease-out",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div style={{
        background: "rgba(14,14,14,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16,
        padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>
        {/* Dish photo */}
        {dish?.photos?.[0] && (
          <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative" }}>
            <Image src={dish.photos[0]} alt={dish.name} fill className="object-cover" sizes="52px" />
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {promo.name}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            {promo.discountPct && (
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#F4A623", background: "rgba(244,166,35,0.15)", padding: "1px 6px", borderRadius: 4 }}>
                -{promo.discountPct}%
              </span>
            )}
            {promo.promoPrice && (
              <span style={{ fontSize: "0.78rem", color: "#4ade80", fontWeight: 600 }}>
                ${promo.promoPrice.toLocaleString("es-CL")}
              </span>
            )}
            {promo.originalPrice && promo.promoPrice && (
              <span style={{ fontSize: "0.7rem", color: "#666", textDecoration: "line-through" }}>
                ${promo.originalPrice.toLocaleString("es-CL")}
              </span>
            )}
          </div>
        </div>

        {/* Close */}
        <button onClick={dismiss} style={{ flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer" }}>
          <X size={16} color="rgba(255,255,255,0.4)" />
        </button>
      </div>
    </div>
  );
}
