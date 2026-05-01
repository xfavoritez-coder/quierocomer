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
  alsoGlutenFree?: boolean;
}

function isGlutenFree(d: any): boolean {
  if (d.isGlutenFree === true) return true;
  const ings = d.dishIngredients || [];
  if (ings.length === 0) return false;
  return !ings.some((di: any) => di.ingredient?.allergens?.some((a: any) => a.name.toLowerCase() === "gluten"));
}

export default function GenioVegetarianCarousel({ dishes, categories, onDishClick, alsoGlutenFree }: Props) {
  const lang = useLang();

  const vegDishes = useMemo(() => {
    const noDrinkIds = new Set(categories.filter(c => (c as any).dishType !== "drink").map(c => c.id));
    return dishes.filter(d => {
      const diet = (d as any).dishDiet;
      if (diet !== "VEGETARIAN" && diet !== "VEGAN") return false;
      if (!d.isActive || !noDrinkIds.has(d.categoryId)) return false;
      if (alsoGlutenFree && !isGlutenFree(d)) return false;
      return true;
    });
  }, [dishes, categories, alsoGlutenFree]);

  if (vegDishes.length === 0) return null;

  const countText = String(vegDishes.length);
  const title = alsoGlutenFree
    ? `${countText} opciones vegetarianas sin gluten 🥗`
    : (t(lang, "gVegetarianDishesForYou" as any) || `${countText} opciones vegetarianas para ti 🥗`).replace("{n}", countText);
  const subtitle = t(lang, "gVegetarianSubtitle" as any) || "Incluye opciones veganas y vegetarianas";

  return (
    <div
      id="genio-vegetarian-carousel"
      className="font-[family-name:var(--font-dm)]"
      style={{ margin: "0 12px 10px", padding: "14px 12px 12px", background: "#F0F5E6", border: "0.5px solid rgba(107,142,35,0.2)", borderRadius: 16 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", border: "0.5px solid rgba(107,142,35,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>🧞</div>
        <div>
          <p style={{ fontSize: "0.88rem", fontWeight: 600, color: "#2D4A0E", margin: 0 }}>{title}</p>
          <p style={{ fontSize: "0.72rem", color: "#5A7D2B", margin: "2px 0 0" }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" as any }}>
          {vegDishes.slice(0, 20).map(d => {
            const photo = d.photos?.[0];
            const isVegan = (d as any).dishDiet === "VEGAN";
            return (
              <button key={d.id} onClick={() => onDishClick?.(d.id)} className="active:scale-[0.97] transition-transform"
                style={{ flexShrink: 0, width: 130, background: "#fff", border: "0.5px solid rgba(107,142,35,0.15)", borderRadius: 12, padding: 6, cursor: "pointer", textAlign: "left", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ position: "relative", width: "100%", height: 72, borderRadius: 8, overflow: "hidden", background: "#f0f0f0", marginBottom: 5 }}>
                  {photo ? <Image src={photo} alt={d.name} fill className="object-cover" sizes="130px" /> : <div style={{ width: "100%", height: "100%", background: "#e8e8e8", display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: "1.2rem" }}>🍽</div>}
                  <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(255,255,255,0.95)", color: isVegan ? "#3A8E68" : "#6B8E23", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.3px", display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: isVegan ? "#3A8E68" : "#6B8E23", flexShrink: 0 }} />{isVegan ? "VEGAN" : "VEG"}
                  </span>
                </div>
                <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "#2D4A0E", margin: "0 0 1px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                {d.description && <p style={{ fontSize: "0.62rem", color: "#5a7d3a", margin: "0 0 2px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description}</p>}
                <p style={{ fontFamily: "var(--font-dm), system-ui, sans-serif", fontSize: "12px", fontWeight: 500, color: "#5A7D2B", margin: 0 }}>${d.price.toLocaleString("es-CL")}</p>
              </button>
            );
          })}
        </div>
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 4, width: 32, background: "linear-gradient(to right, transparent, #F0F5E6)", pointerEvents: "none", borderRadius: "0 12px 12px 0" }} />
      </div>
    </div>
  );
}
