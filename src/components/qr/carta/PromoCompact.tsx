"use client";

import { useState } from "react";
import Image from "next/image";

interface Promo {
  id: string;
  name: string;
  description: string | null;
  promoPrice: number | null;
  originalPrice: number | null;
  daysOfWeek?: number[];
  dishes: { id: string; name: string; description?: string | null; price: number; photos: string[] }[];
  imageUrl?: string | null;
  promoType?: string;
}

interface Props {
  promos: Promo[];
  onViewDish?: (dishId: string) => void;
}

const DAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

export default function PromoCompact({ promos, onViewDish }: Props) {
  if (!promos || promos.length === 0) return null;

  const todayDow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 12px" }}>
      {promos.map((p) => {
        const dish = p.dishes?.[0];
        const photo = p.imageUrl || dish?.photos?.[0];
        const label = p.daysOfWeek?.length ? `HOY ${DAY_NAMES[todayDow]}` : "OFERTA";
        const desc = p.description
          || (p.dishes?.length > 1 ? p.dishes.map(d => d.name).join(" + ") : null)
          || dish?.description;

        return (
          <button
            key={p.id}
            onClick={() => { if (dish && onViewDish) onViewDish(dish.id); }}
            style={{
              width: "100%", height: 130, borderRadius: 18, overflow: "hidden", position: "relative",
              background: "#111", display: "flex", border: "none", cursor: "pointer", textAlign: "left",
            }}
          >
            {/* Full background photo with gradient */}
            {photo && (
              <div style={{ position: "absolute", inset: 0 }}>
                <Image src={photo} alt={p.name} fill className="object-cover" sizes="430px" style={{ objectPosition: "center" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.78) 43%, rgba(0,0,0,0.12) 100%), linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 58%)" }} />
              </div>
            )}

            {/* Day badge */}
            <span style={{
              position: "absolute", top: 8, right: 8, fontSize: 10, fontWeight: 900,
              color: "white", background: "var(--carta-accent, #F4A623)",
              padding: "4px 10px", borderRadius: 50, letterSpacing: "0.1em", zIndex: 2,
            }}>{label}</span>

            {/* Content */}
            <div style={{
              position: "relative", zIndex: 1, padding: "12px 14px", width: "50%",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "var(--carta-accent, #F4A623)", letterSpacing: "0.15em", textTransform: "uppercase" }}>OFERTA</span>
              <h3 style={{
                margin: "2px 0 4px", fontSize: 17, fontWeight: 800, color: "white",
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, lineHeight: 1.2,
                fontFamily: "inherit",
              }}>{p.name}</h3>
              {desc && (
                <p style={{
                  margin: "0 0 8px", fontSize: 13, color: "rgba(255,255,255,0.6)",
                  lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{desc}</p>
              )}
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                {p.promoPrice && (
                  <span style={{ fontSize: 14, fontWeight: 900, color: "var(--carta-accent, #F4A623)" }}>
                    ${p.promoPrice.toLocaleString("es-CL")}
                  </span>
                )}
                {p.originalPrice && p.promoPrice && (
                  <del style={{ fontSize: 11, color: "#666" }}>
                    ${p.originalPrice.toLocaleString("es-CL")}
                  </del>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
