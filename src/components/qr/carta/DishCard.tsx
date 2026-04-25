"use client";

import Image from "next/image";
import type { Dish } from "@prisma/client";

interface DishCardProps {
  dish: Dish;
  variant: "basic" | "premium";
  onClick: () => void;
  averageRating?: { avg: number; count: number };
  autoRecommended?: boolean;
  recommendationReason?: string | null;
  isExploration?: boolean;
  hasPersonalization?: boolean;
  restaurantName?: string;
}

function DishBadges({ dish }: { dish: Dish }) {
  const d = dish as any;
  const badges: { icon: string; title: string }[] = [];
  if (d.dishDiet === "VEGAN") badges.push({ icon: "🌿", title: "Vegano" });
  else if (d.dishDiet === "VEGETARIAN") badges.push({ icon: "🌱", title: "Vegetariano" });
  if (d.isSpicy) badges.push({ icon: "🌶️", title: "Picante" });
  if (!badges.length) return null;
  return <>{badges.map((b, i) => <span key={i} style={{ fontSize: "12px", flexShrink: 0 }} title={b.title}>{b.icon}</span>)}</>;
}

/* ── BASIC ── */
function BasicCard({ dish, onClick, averageRating, autoRecommended, recommendationReason, isExploration, restaurantName }: Omit<DishCardProps, "variant">) {
  const photo = dish.photos?.[0];
  const isRec = dish.tags?.includes("RECOMMENDED");

  const inner = (
    <>
      <div className="shrink-0 relative overflow-hidden bg-neutral-900" style={{ width: 80, height: 80, borderRadius: 10 }}>
        {photo ? (
          <Image src={photo} alt={dish.name} fill className="object-cover" sizes="80px" />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xl">🍽</div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <h3 className="font-[family-name:var(--font-dm)] flex items-center gap-1" style={{ fontSize: "1rem", fontWeight: 700, color: "#0e0e0e", lineHeight: 1.3 }}>
          <span className="truncate">{dish.name}</span>
          {dish.tags?.includes("NEW") && <span style={{ fontSize: "8px", fontWeight: 700, color: "white", background: "#e85530", padding: "1px 6px", borderRadius: 50, flexShrink: 0, letterSpacing: "0.05em" }}>NUEVO</span>}
          <DishBadges dish={dish} />
          {autoRecommended && (
            <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#d97706", background: "rgba(244,166,35,0.12)", padding: "2px 8px", borderRadius: 50, flexShrink: 0 }}>
              ✨ Para ti
            </span>
          )}
          {isRec && !autoRecommended && (
            <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#d97706", background: "rgba(244,166,35,0.12)", padding: "2px 8px", borderRadius: 50, flexShrink: 0 }}>
              ⭐ {restaurantName ? `Por ${restaurantName}` : "Recomendado"}
            </span>
          )}
        </h3>
        {dish.description && (
          <p className="line-clamp-2 font-[family-name:var(--font-dm)]" style={{ fontSize: "0.9rem", color: "#999", lineHeight: 1.4 }}>
            {dish.description}
          </p>
        )}
        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
          {dish.discountPrice ? (
            <>
              <span className="line-through font-[family-name:var(--font-dm)]" style={{ color: "#ccc", fontSize: "0.8rem" }}>${dish.price.toLocaleString("es-CL")}</span>
              <span className="font-[family-name:var(--font-dm)]" style={{ color: "#888", fontWeight: 500, fontSize: "0.95rem" }}>${dish.discountPrice.toLocaleString("es-CL")}</span>
            </>
          ) : (
            <span className="font-[family-name:var(--font-dm)]" style={{ color: "#888", fontWeight: 500, fontSize: "0.95rem" }}>${dish.price.toLocaleString("es-CL")}</span>
          )}
          {averageRating && (
            <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "0.78rem", color: "#F4A623" }}>
              ★ <span style={{ color: "#999" }}>{averageRating.avg.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (isRec) {
    return (
      <div style={{ borderRadius: 14, background: "rgba(244,166,35,0.04)", border: "2px solid rgba(244,166,35,0.3)", marginBottom: 8 }}>
        <button onClick={onClick} className="flex gap-3 w-full text-left" style={{ padding: "14px 12px", background: "transparent" }}>{inner}</button>
      </div>
    );
  }

  if (autoRecommended) {
    return (
      <div style={{ borderRadius: 14, background: isExploration ? "rgba(99,102,241,0.04)" : "rgba(244,166,35,0.06)", border: `1.5px solid ${isExploration ? "rgba(99,102,241,0.2)" : "rgba(244,166,35,0.2)"}`, marginBottom: 8 }}>
        <button onClick={onClick} className="flex gap-3 w-full text-left" style={{ padding: "14px 12px", background: "transparent" }}>{inner}</button>
      </div>
    );
  }

  return (
    <button onClick={onClick} className="flex gap-3 w-full text-left" style={{ padding: "16px 0", borderBottom: "1px solid #f0f0f0" }}>{inner}</button>
  );
}

/* ── PREMIUM CARD (unified — all cards use featured layout) ── */
function PremiumCard({ dish, onClick, autoRecommended, restaurantName }: Omit<DishCardProps, "variant">) {
  const photo = dish.photos?.[0];
  const isRec = dish.tags?.includes("RECOMMENDED");

  let badge: string | null = null;
  if (autoRecommended) badge = "✨ Para ti";
  else if (isRec) badge = `⭐ ${restaurantName ? `Por ${restaurantName}` : "Recomendado"}`;

  return (
    <button
      onClick={onClick}
      className="relative text-left overflow-hidden w-full bg-neutral-900"
      style={{ height: "calc(205px * 4 / 3 + 45px)", borderRadius: 10, ...(autoRecommended ? { boxShadow: "0 0 0 1.5px rgba(244,166,35,0.5)" } : {}) }}
    >
      {photo ? (
        <Image src={photo} alt={dish.name} fill className="object-cover" sizes="205px" style={{ transform: "scale(1.08)" }} />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-2xl">🍽</div>
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 30%, transparent 55%)" }} />
      <div className="absolute" style={{ top: 7, right: 7, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, zIndex: 2 }}>
        {badge && (
          <span className="font-[family-name:var(--font-dm)]" style={autoRecommended
            ? { background: "rgba(244,166,35,0.2)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(244,166,35,0.3)", color: "#fbbf24", fontSize: "0.82rem", fontWeight: 600, padding: "4px 10px", borderRadius: 50 }
            : { background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", color: "white", fontSize: "0.82rem", fontWeight: 600, padding: "4px 10px", borderRadius: 8 }
          }>{badge}</span>
        )}
        {dish.tags?.includes("NEW") && <span className="font-[family-name:var(--font-dm)]" style={{ background: "#e85530", color: "white", fontSize: "0.52rem", fontWeight: 700, padding: "3px 8px", borderRadius: 6, letterSpacing: "0.05em" }}>NUEVO</span>}
      </div>
      <h3 className="absolute font-[family-name:var(--font-dm)] line-clamp-2 flex items-center gap-1" style={{ bottom: 27, left: 10, right: 10, fontSize: "1.125rem", fontWeight: 700, color: "white", lineHeight: 1.3 }}>
        <span>{dish.name}</span>
        <DishBadges dish={dish} />
      </h3>
      <span className="absolute font-[family-name:var(--font-dm)]" style={{ bottom: 9, left: 10, fontSize: "0.9rem", fontWeight: 500, color: "#F4A623" }}>
        {dish.discountPrice ? `$${dish.discountPrice.toLocaleString("es-CL")}` : `$${dish.price.toLocaleString("es-CL")}`}
      </span>
    </button>
  );
}

export default function DishCard(props: DishCardProps) {
  if (props.variant === "basic") return <BasicCard {...props} />;
  return <PremiumCard {...props} />;
}
