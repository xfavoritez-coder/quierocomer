"use client";

function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55;
}

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
  accentColor?: string | null;
  onViewDish?: (dishId: string) => void;
  onViewPromo?: (promo: Promo) => void;
}

const DAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

export default function PromoCompact({ promos, accentColor, onViewDish, onViewPromo }: Props) {
  if (!promos || promos.length === 0) return null;

  const todayDow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();
  const accent = accentColor || "#F4A623";
  const accentLight = isLightColor(accent);
  // Badge: light accent → dark glass pill; dark accent → accent bg with white text
  const badgeBg = accentLight ? "rgba(0,0,0,0.6)" : accent;
  const badgeColor = "#fff";
  // Price: light accent on dark card → white; dark accent → accent
  const priceColor = accentLight ? "#fff" : accent;

  return (
    <div className="promo-compact-scroll" style={{
      display: "flex", flexDirection: "row", gap: 10,
      padding: "0 12px",
      ...(promos.length > 1 ? { overflowX: "auto" as const, scrollSnapType: "x mandatory" as const, WebkitOverflowScrolling: "touch" as const, scrollbarWidth: "none" as const, msOverflowStyle: "none" as any } : {}),
    }}>
      <style>{`.promo-compact-scroll::-webkit-scrollbar { display: none; }`}</style>
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
            onClick={() => {
              if (onViewPromo) { onViewPromo(p); return; }
              if (dish && onViewDish) onViewDish(dish.id);
            }}
            style={{
              width: "100%", minWidth: "100%",
              height: 150, borderRadius: 18, overflow: "hidden", position: "relative",
              background: "#111", display: "flex", border: "none", cursor: "pointer", textAlign: "left",
              flexShrink: 0, scrollSnapAlign: "start",
            }}
          >
            {/* Full background photo with gradient */}
            {photo && (
              <div style={{ position: "absolute", inset: 0 }}>
                <img src={photo} alt={p.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.78) 43%, rgba(0,0,0,0.12) 100%), linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 58%)" }} />
              </div>
            )}

            {/* Day badge */}
            <span style={{
              position: "absolute", top: 8, right: 8, fontSize: 10, fontWeight: 900,
              color: badgeColor, background: badgeBg,
              backdropFilter: accentLight ? "blur(6px)" : undefined,
              WebkitBackdropFilter: accentLight ? "blur(6px)" : undefined,
              padding: "4px 10px", borderRadius: 50, letterSpacing: "0.1em", zIndex: 2,
            }}>{label}</span>

            {/* Content */}
            <div style={{
              position: "relative", zIndex: 1, padding: "14px 14px", width: "50%",
              display: "flex", flexDirection: "column", justifyContent: "flex-start",
            }}>
              <h3 style={{
                margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "white",
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
                  <span style={{ fontSize: 16, fontWeight: 900, color: priceColor }}>
                    ${p.promoPrice.toLocaleString("es-CL")}
                  </span>
                )}
                {p.originalPrice && p.promoPrice && (
                  <del style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>
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
