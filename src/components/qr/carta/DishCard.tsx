"use client";

import Image from "next/image";
import type { Dish } from "@prisma/client";

interface DishCardProps {
  dish: Dish;
  variant: "basic" | "premium";
  onClick: () => void;
  averageRating?: { avg: number; count: number };
}

/* ── BASIC ── */
function BasicCard({ dish, onClick, averageRating }: Omit<DishCardProps, "variant">) {
  const photo = dish.photos?.[0];
  return (
    <button
      onClick={onClick}
      className="flex gap-3 w-full text-left"
      style={{ padding: "16px 0", borderBottom: "1px solid #f0f0f0" }}
    >
      <div className="shrink-0 relative overflow-hidden bg-neutral-900" style={{ width: 80, height: 80, borderRadius: 10 }}>
        {photo ? (
          <Image src={photo} alt={dish.name} fill className="object-cover" sizes="80px" />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xl">🍽</div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <h3 className="font-[family-name:var(--font-dm)] truncate" style={{ fontSize: "1rem", fontWeight: 700, color: "#0e0e0e", lineHeight: 1.3 }}>
          {dish.name}
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
    </button>
  );
}

/* ── PREMIUM NORMAL ── */
function PremiumNormalCard({ dish, onClick }: Omit<DishCardProps, "variant">) {
  const photo = dish.photos?.[0];
  return (
    <button onClick={onClick} className="flex flex-col text-left w-full" style={{ background: "none" }}>
      <div className="relative w-full bg-neutral-900 overflow-hidden" style={{ aspectRatio: "3/4", borderRadius: 10 }}>
        {photo ? (
          <Image src={photo} alt={dish.name} fill className="object-cover" sizes="155px" style={{ transform: "scale(1.08)" }} />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-2xl">🍽</div>
        )}
      </div>
      <div style={{ padding: "8px 2px 0" }}>
        <h3 className="font-[family-name:var(--font-dm)] truncate" style={{ fontSize: "1rem", fontWeight: 700, color: "#0e0e0e", lineHeight: 1.3 }}>
          {dish.name}
        </h3>
        <div style={{ marginTop: -3 }}>
          {dish.discountPrice ? (
            <span className="font-[family-name:var(--font-dm)]">
              <span className="line-through" style={{ color: "#ccc", fontSize: "0.72rem", marginRight: 4 }}>${dish.price.toLocaleString("es-CL")}</span>
              <span style={{ color: "#666", fontSize: "0.9rem" }}>${dish.discountPrice.toLocaleString("es-CL")}</span>
            </span>
          ) : (
            <span className="font-[family-name:var(--font-dm)]" style={{ color: "#666", fontSize: "0.9rem" }}>${dish.price.toLocaleString("es-CL")}</span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── PREMIUM FEATURED (RECOMMENDED) ── */
function PremiumFeaturedCard({ dish, onClick }: Omit<DishCardProps, "variant">) {
  const photo = dish.photos?.[0];
  // Match total height of normal card: photo (155 * 4/3 = 207) + text area (~52) = ~259px
  return (
    <button
      onClick={onClick}
      className="relative text-left overflow-hidden w-full bg-neutral-900"
      style={{ height: "calc(155px * 4 / 3 + 52px)", borderRadius: 10 }}
    >
      {photo ? (
        <Image src={photo} alt={dish.name} fill className="object-cover" sizes="155px" style={{ transform: "scale(1.08)" }} />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-2xl">🍽</div>
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)" }} />
      <span
        className="absolute font-[family-name:var(--font-dm)]"
        style={{ top: 8, left: 8, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", color: "white", fontSize: "0.62rem", fontWeight: 600, padding: "3px 8px", borderRadius: 6 }}
      >
        ⭐ Recomendado
      </span>
      <h3 className="absolute font-[family-name:var(--font-dm)] line-clamp-2" style={{ bottom: 28, left: 10, right: 10, fontSize: "1rem", fontWeight: 700, color: "white", lineHeight: 1.3 }}>
        {dish.name}
      </h3>
      <span className="absolute font-[family-name:var(--font-dm)]" style={{ bottom: 10, left: 10, fontSize: "0.9rem", fontWeight: 700, color: "#F4A623" }}>
        {dish.discountPrice ? `$${dish.discountPrice.toLocaleString("es-CL")}` : `$${dish.price.toLocaleString("es-CL")}`}
      </span>
    </button>
  );
}

export default function DishCard(props: DishCardProps) {
  if (props.variant === "basic") return <BasicCard {...props} />;
  const isRecommended = props.dish.tags?.includes("RECOMMENDED");
  return isRecommended ? <PremiumFeaturedCard {...props} /> : <PremiumNormalCard {...props} />;
}
