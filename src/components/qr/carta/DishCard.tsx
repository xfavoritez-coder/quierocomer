"use client";

import { useState } from "react";
import Image from "next/image";
import type { Dish } from "@prisma/client";
import SpicyStamp from "./SpicyStamp";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

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
  isPopular?: boolean;
}

function DishBadges({ dish }: { dish: Dish }) {
  const d = dish as any;
  const badges: { icon: string; title: string }[] = [];
  if (d.dishDiet === "VEGAN") badges.push({ icon: "🌿", title: "Vegano" });
  else if (d.dishDiet === "VEGETARIAN") badges.push({ icon: "🥗", title: "Vegetariano" });
  if (d.isSpicy) badges.push({ icon: "🌶️", title: "Picante" });
  if (!badges.length) return null;
  return <>{badges.map((b, i) => <span key={i} style={{ fontSize: "12px", verticalAlign: "middle" }} title={b.title}>{b.icon}</span>)}</>;
}

/* ── BASIC ── */
function BasicCard({ dish, onClick, averageRating, autoRecommended, recommendationReason, isExploration, restaurantName, isPopular }: Omit<DishCardProps, "variant">) {
  const lang = useLang();
  const photo = dish.photos?.[0];
  const isRec = dish.tags?.includes("RECOMMENDED");

  const inner = (
    <>
      <div className="shrink-0 relative overflow-hidden bg-neutral-900" style={{ width: 80, height: 80, borderRadius: 10 }}>
        {photo ? (
          <Image src={photo} alt={dish.name} fill className="object-cover" sizes="240px" quality={95} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, color-mix(in srgb, var(--carta-accent, #F4A623) 12%, var(--carta-surface, #f5f5f0)), color-mix(in srgb, var(--carta-accent, #F4A623) 4%, var(--carta-surface, #f5f5f0)))", position: "relative", overflow: "hidden" }}>
            <span style={{ fontSize: "1.4rem", opacity: 0.35 }}>🍽️</span>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 30%, color-mix(in srgb, var(--carta-accent, #F4A623) 10%, transparent), transparent 60%)" }} />
          </div>
        )}
        <SpicyStamp isSpicy={!!(dish as any).isSpicy} size={20} top={4} left={4} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <h3 className="font-[family-name:var(--font-dm)]" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--carta-text)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
            {dish.name}{" "}<DishBadges dish={dish} />
          </h3>
          {dish.tags?.includes("NEW") && <span style={{ fontSize: "9px", fontWeight: 700, color: "white", background: "var(--carta-accent, #e85530)", padding: "2px 7px", borderRadius: 50, letterSpacing: "0.05em", flexShrink: 0 }}>NUEVO</span>}
        </div>
        {(isRec || isPopular) && (
          <div className="flex items-center gap-1 flex-wrap font-[family-name:var(--font-dm)]">
            {isRec && (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--carta-badge-text)", background: "var(--carta-badge-bg)", padding: "2px 8px", borderRadius: 50 }}>
                ⭐ {t(lang, "recommended")}
              </span>
            )}
            {isPopular && (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#e85530", background: "rgba(232,85,48,0.1)", padding: "2px 8px", borderRadius: 50 }}>
                🔥 {t(lang, "feedPopular")}
              </span>
            )}
          </div>
        )}
        {dish.description && (
          <p className="line-clamp-2 font-[family-name:var(--font-dm)]" style={{ fontSize: "0.9rem", color: "var(--carta-text3)", lineHeight: 1.4 }}>
            {dish.description}
          </p>
        )}
        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
          {dish.discountPrice ? (
            <>
              <span className="line-through font-[family-name:var(--font-dm)]" style={{ color: "#ccc", fontSize: "0.8rem" }}>${dish.price.toLocaleString("es-CL")}</span>
              <span className="font-[family-name:var(--font-dm)]" style={{ color: "var(--carta-accent, #F4A623)", fontWeight: 700, fontSize: "0.95rem" }}>${dish.discountPrice.toLocaleString("es-CL")}</span>
            </>
          ) : (
            <span className="font-[family-name:var(--font-dm)]" style={{ color: "var(--carta-accent, #F4A623)", fontWeight: 700, fontSize: "0.95rem" }}>${dish.price.toLocaleString("es-CL")}</span>
          )}
          {averageRating && (
            <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "0.78rem", color: "var(--carta-accent, #F4A623)" }}>
              ★ <span style={{ color: "var(--carta-text3)" }}>{averageRating.avg.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (isRec) {
    return (
      <div style={{ borderRadius: 14, background: "color-mix(in srgb, var(--carta-accent, #F4A623) 4%, transparent)", border: "2px solid color-mix(in srgb, var(--carta-accent, #F4A623) 30%, transparent)", marginBottom: 8 }}>
        <button onClick={onClick} className="flex gap-3 w-full text-left" style={{ padding: "14px 12px", background: "transparent" }}>{inner}</button>
      </div>
    );
  }

  if (autoRecommended) {
    return (
      <div style={{ borderRadius: 14, background: isExploration ? "rgba(99,102,241,0.04)" : "color-mix(in srgb, var(--carta-accent, #F4A623) 6%, transparent)", border: `1.5px solid ${isExploration ? "rgba(99,102,241,0.2)" : "color-mix(in srgb, var(--carta-accent, #F4A623) 20%, transparent)"}`, marginBottom: 8 }}>
        <button onClick={onClick} className="flex gap-3 w-full text-left" style={{ padding: "14px 12px", background: "transparent" }}>{inner}</button>
      </div>
    );
  }

  return (
    <button onClick={onClick} className="flex gap-3 w-full text-left" style={{ padding: "16px 0", borderBottom: "1px solid var(--carta-border)" }}>{inner}</button>
  );
}

/* ── PREMIUM CARD — foto arriba, info abajo ── */
function PremiumCard({ dish, onClick, autoRecommended, restaurantName, isPopular }: Omit<DishCardProps, "variant">) {
  const lang = useLang();
  const photo = dish.photos?.[0];
  const isRec = dish.tags?.includes("RECOMMENDED");
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      onClick={onClick}
      className="text-left overflow-hidden w-full"
      style={{
        borderRadius: 14,
        background: isRec ? "var(--carta-surface-rec, var(--carta-surface))" : "var(--carta-surface)",
        border: isRec ? "2px solid color-mix(in srgb, var(--carta-accent, #F4A623) 30%, transparent)" : "1px solid var(--carta-card-border)",
        boxShadow: isRec ? "0 2px 12px color-mix(in srgb, var(--carta-accent, #F4A623) 10%, transparent)" : "var(--carta-card-shadow)",
      }}
    >
      {/* Foto */}
      <div className="relative overflow-hidden" style={{ width: "100%", aspectRatio: "200/210", background: "#1a1a1a" }}>
        {photo ? (
          <>
            {!loaded && <div style={{ position: "absolute", inset: 0, background: "#1a1a1a", overflow: "hidden" }}><div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)", animation: "shimmer 1.5s infinite" }} /></div>}
            <Image src={photo} alt={dish.name} fill className="object-cover" sizes="640px" style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease" }} quality={95} onLoad={() => setLoaded(true)} />
          </>
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, color-mix(in srgb, var(--carta-accent, #F4A623) 12%, var(--carta-surface, #1a1a1a)), color-mix(in srgb, var(--carta-accent, #F4A623) 4%, var(--carta-surface, #1a1a1a)))", position: "relative" }}>
            <span style={{ fontSize: "2.2rem", opacity: 0.3 }}>🍽️</span>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 60% 40%, color-mix(in srgb, var(--carta-accent, #F4A623) 10%, transparent), transparent 60%)" }} />
          </div>
        )}
        <SpicyStamp isSpicy={!!(dish as any).isSpicy} size={26} top={8} right={8} />
        {/* Badges sobre la foto */}
        {(isRec || isPopular) && (
          <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4, zIndex: 2 }}>
            {isRec && <span className="font-[family-name:var(--font-dm)]" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "white", fontSize: "0.73rem", fontWeight: 600, padding: "3px 9px", borderRadius: 50 }}>⭐ {t(lang, "recommended")}</span>}
            {isPopular && !isRec && <span className="font-[family-name:var(--font-dm)]" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", color: "white", fontSize: "0.73rem", fontWeight: 600, padding: "3px 8px", borderRadius: 6 }}>🔥 {t(lang, "feedPopular")}</span>}
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <h3 className="font-[family-name:var(--font-dm)]" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--carta-text)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0, flex: 1, minWidth: 0 }}>
            {dish.name}{" "}<DishBadges dish={dish} />
          </h3>
          {dish.tags?.includes("NEW") && <span style={{ background: "var(--carta-accent, #e85530)", color: "white", fontSize: "9px", fontWeight: 700, padding: "2px 7px", borderRadius: 50, letterSpacing: "0.05em", flexShrink: 0 }}>NUEVO</span>}
        </div>
        {dish.description && (
          <p className="line-clamp-2 font-[family-name:var(--font-dm)]" style={{ fontSize: "0.88rem", color: "var(--carta-text3)", lineHeight: 1.4, margin: "3px 0 0" }}>
            {dish.description}
          </p>
        )}
        <div style={{ marginTop: 6 }}>
          {dish.discountPrice ? (
            <>
              <span className="line-through font-[family-name:var(--font-dm)]" style={{ color: "var(--carta-text3)", fontSize: "0.78rem", marginRight: 6 }}>${dish.price.toLocaleString("es-CL")}</span>
              <span className="font-[family-name:var(--font-dm)]" style={{ color: "var(--carta-accent, #F4A623)", fontWeight: 700, fontSize: "0.95rem" }}>${dish.discountPrice.toLocaleString("es-CL")}</span>
            </>
          ) : (
            <span className="font-[family-name:var(--font-dm)]" style={{ color: "var(--carta-accent, #F4A623)", fontWeight: 700, fontSize: "0.95rem" }}>${dish.price.toLocaleString("es-CL")}</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function DishCard(props: DishCardProps) {
  if (props.variant === "basic") return <BasicCard {...props} />;
  return (
    <>
      <PremiumCard {...props} />
      <style>{`@keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }`}</style>
    </>
  );
}
