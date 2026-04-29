"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { Dish, Category } from "@prisma/client";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

interface Props {
  dishes: Dish[];
  categories: Category[];
  onDishClick?: (dishId: string) => void;
}

export default function GenioVeganCarousel({ dishes, categories, onDishClick }: Props) {
  const lang = useLang();

  const { veganDishes, sectionCount } = useMemo(() => {
    const vegan = dishes.filter(d => (d as any).dishDiet === "VEGAN" && d.isActive);
    const catIds = new Set(vegan.map(d => d.categoryId));
    return { veganDishes: vegan, sectionCount: catIds.size };
  }, [dishes]);

  if (veganDishes.length === 0) return null;

  const title = t(lang, "gVeganDishesForYou").replace("{n}", String(veganDishes.length));
  const subtitle = t(lang, "gVeganInSections").replace("{n}", String(sectionCount));

  return (
    <div
      id="genio-vegan-carousel"
      className="font-[family-name:var(--font-dm)]"
      style={{
        margin: "0 20px 16px",
        padding: "14px 12px 12px",
        background: "#EAF3DE",
        border: "0.5px solid rgba(99, 153, 34, 0.2)",
        borderRadius: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "#fff", border: "0.5px solid rgba(99, 153, 34, 0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.1rem", flexShrink: 0,
        }}>
          🧞
        </div>
        <div>
          <p style={{ fontSize: "0.88rem", fontWeight: 600, color: "#173404", margin: 0 }}>{title}</p>
          <p style={{ fontSize: "0.72rem", color: "#3B6D11", margin: "2px 0 0" }}>{subtitle}</p>
        </div>
      </div>

      {/* Scrollable cards */}
      <div style={{
        display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4,
        scrollbarWidth: "none" as any,
      }}>
        {veganDishes.slice(0, 20).map(d => {
          const photo = d.photos?.[0];
          return (
            <button
              key={d.id}
              onClick={() => onDishClick?.(d.id)}
              className="active:scale-[0.97] transition-transform"
              style={{
                flexShrink: 0, width: 130, background: "#fff",
                border: "0.5px solid rgba(99, 153, 34, 0.15)",
                borderRadius: 12, padding: 6, cursor: "pointer",
                textAlign: "left", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              {/* Photo with VEGAN badge */}
              <div style={{ position: "relative", width: "100%", height: 72, borderRadius: 8, overflow: "hidden", background: "#f0f0f0", marginBottom: 5 }}>
                {photo ? (
                  <Image src={photo} alt={d.name} fill className="object-cover" sizes="130px" />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "#e8e8e8", display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: "1.2rem" }}>🍽</div>
                )}
                {/* VEGAN badge */}
                <span style={{
                  position: "absolute", top: 6, left: 6,
                  background: "rgba(255,255,255,0.95)",
                  color: "#3A8E68", fontSize: "10px", fontWeight: 600,
                  padding: "2px 6px", borderRadius: 4, letterSpacing: "0.3px",
                  display: "flex", alignItems: "center", gap: 3,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3A8E68", flexShrink: 0 }} />
                  VEGAN
                </span>
              </div>
              {/* Name — up to 2 lines */}
              <p style={{
                fontSize: "0.7rem", fontWeight: 600, color: "#173404",
                margin: "0 0 2px", minHeight: 30, lineHeight: 1.35,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as any, overflow: "hidden",
              }}>
                {d.name}
              </p>
              {/* Price */}
              <p style={{
                fontFamily: "var(--font-dm), system-ui, sans-serif",
                fontSize: "12px", fontWeight: 500, color: "#1a1a1a", margin: 0,
              }}>
                ${d.price.toLocaleString("es-CL")}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
