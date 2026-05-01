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

export default function GenioVeganCarousel({ dishes, categories, onDishClick, alsoGlutenFree }: Props) {
  const lang = useLang();

  const veganDishes = useMemo(() => {
    const noDrinkIds = new Set(categories.filter(c => (c as any).dishType !== "drink").map(c => c.id));
    return dishes.filter(d => {
      if ((d as any).dishDiet !== "VEGAN" || !d.isActive) return false;
      if (!noDrinkIds.has(d.categoryId)) return false;
      if (alsoGlutenFree && !isGlutenFree(d)) return false;
      return true;
    });
  }, [dishes, categories, alsoGlutenFree]);

  if (veganDishes.length === 0) return null;

  const n = veganDishes.length;
  const countText = String(n);
  const title = alsoGlutenFree
    ? `${countText} ${n === 1 ? "opción vegana" : "opciones veganas"} sin gluten 🌿`
    : t(lang, "gVeganDishesForYou").replace("{n}", countText).replace("opciones", n === 1 ? "opción" : "opciones").replace("options", n === 1 ? "option" : "options").replace("opções", n === 1 ? "opção" : "opções").replace("opzioni", n === 1 ? "opzione" : "opzioni");
  const subtitle = t(lang, "gVeganSubtitle");

  return (
    <div
      id="genio-vegan-carousel"
      className="font-[family-name:var(--font-dm)]"
      style={{ margin: "0 12px 10px", padding: "14px 12px 12px", background: "#EAF3DE", border: "0.5px solid rgba(99, 153, 34, 0.2)", borderRadius: 16 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", border: "0.5px solid rgba(99, 153, 34, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>🧞</div>
        <div>
          <p style={{ fontSize: "0.94rem", fontWeight: 600, color: "#173404", margin: 0 }}>{title}</p>
          <p style={{ fontSize: "0.73rem", color: "#3B6D11", margin: "1px 0 0" }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" as any }}>
          {veganDishes.slice(0, 20).map(d => {
            const photo = d.photos?.[0];
            return (
              <button key={d.id} onClick={() => onDishClick?.(d.id)} className="active:scale-[0.97] transition-transform"
                style={{ flexShrink: 0, width: 130, background: "#fff", border: "0.5px solid rgba(99, 153, 34, 0.15)", borderRadius: 12, padding: 6, cursor: "pointer", textAlign: "left", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ position: "relative", width: "100%", height: 72, borderRadius: 8, overflow: "hidden", background: "#f0f0f0", marginBottom: 5 }}>
                  {photo ? <Image src={photo} alt={d.name} fill className="object-cover" sizes="130px" /> : <div style={{ width: "100%", height: "100%", background: "#e8e8e8", display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: "1.2rem" }}>🍽</div>}
                  <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(255,255,255,0.95)", color: "#3A8E68", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.3px", display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3A8E68", flexShrink: 0 }} />VEGAN
                  </span>
                </div>
                <p style={{ fontSize: "0.80rem", fontWeight: 600, color: "#173404", margin: "0 0 1px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                {d.description && <p style={{ fontSize: "0.63rem", color: "#5a7d3a", margin: "0 0 2px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description}</p>}
                <p style={{ fontFamily: "var(--font-dm), system-ui, sans-serif", fontSize: "12px", fontWeight: 500, color: "#3B6D11", margin: 0 }}>${d.price.toLocaleString("es-CL")}</p>
              </button>
            );
          })}
        </div>
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 4, width: 32, background: "linear-gradient(to right, transparent, #EAF3DE)", pointerEvents: "none", borderRadius: "0 12px 12px 0" }} />
      </div>
    </div>
  );
}
