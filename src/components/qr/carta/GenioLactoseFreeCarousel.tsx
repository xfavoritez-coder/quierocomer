"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { Dish, Category } from "@prisma/client";

interface Props {
  dishes: Dish[];
  categories: Category[];
  onDishClick?: (dishId: string) => void;
}

function isLactoseFree(d: any): boolean {
  // Estricto: solo platos marcados explicitamente como sin lactosa
  return d.isLactoseFree === true;
}

export default function GenioLactoseFreeCarousel({ dishes, categories, onDishClick }: Props) {
  const lfDishes = useMemo(() => {
    const noDrinkIds = new Set(categories.filter(c => (c as any).dishType !== "drink").map(c => c.id));
    return dishes.filter(d => d.isActive && noDrinkIds.has(d.categoryId) && isLactoseFree(d));
  }, [dishes, categories]);

  if (lfDishes.length === 0) return null;

  const n = lfDishes.length;
  const title = `${n} ${n === 1 ? "opción" : "opciones"} sin lactosa para ti 🥛`;
  const subtitle = "Platos libres de lactosa en esta carta";

  return (
    <div
      id="genio-lactosefree-carousel"
      className="font-[family-name:var(--font-dm)]"
      style={{ margin: "0 12px 10px", padding: "14px 12px 12px", background: "var(--carta-genio-lf-bg)", border: "0.5px solid var(--carta-genio-lf-border)", borderRadius: 16 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--carta-surface)", border: "0.5px solid var(--carta-genio-lf-border2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>🧞</div>
        <div>
          <p style={{ fontSize: "0.94rem", fontWeight: 600, color: "var(--carta-genio-lf-title)", margin: 0 }}>{title}</p>
          <p style={{ fontSize: "0.73rem", color: "var(--carta-genio-lf-sub)", margin: "1px 0 0" }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" as any }}>
          {lfDishes.slice(0, 20).map(d => {
            const photo = d.photos?.[0];
            return (
              <button key={d.id} onClick={() => onDishClick?.(d.id)} className="active:scale-[0.97] transition-transform"
                style={{ flexShrink: 0, width: 130, background: "var(--carta-surface)", border: "0.5px solid var(--carta-genio-lf-border3)", borderRadius: 12, padding: 6, cursor: "pointer", textAlign: "left", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ position: "relative", width: "100%", height: 118, borderRadius: 8, overflow: "hidden", background: "var(--carta-img-placeholder)", marginBottom: 5 }}>
                  {photo ? <Image src={photo} alt={d.name} fill className="object-cover" sizes="130px" /> : <div style={{ width: "100%", height: "100%", background: "var(--carta-img-placeholder)", display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: "1.2rem" }}>🍽</div>}
                  <span style={{ position: "absolute", top: 6, left: 6, background: "var(--carta-genio-lf-tag-bg)", color: "var(--carta-genio-lf-tag)", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.3px", display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--carta-genio-lf-tag)", flexShrink: 0 }} />SIN LACTOSA
                  </span>
                </div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--carta-genio-lf-title)", margin: "0 0 1px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                {d.description && <p style={{ fontSize: "0.63rem", color: "var(--carta-genio-lf-desc)", margin: "0 0 2px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description}</p>}
                <p style={{ fontFamily: "var(--font-dm), system-ui, sans-serif", fontSize: "13px", fontWeight: 500, color: "var(--carta-genio-lf-sub)", margin: 0 }}>${d.price.toLocaleString("es-CL")}</p>
              </button>
            );
          })}
        </div>
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 4, width: 32, background: "linear-gradient(to right, transparent, var(--carta-genio-lf-bg))", pointerEvents: "none", borderRadius: "0 12px 12px 0" }} />
      </div>
    </div>
  );
}
