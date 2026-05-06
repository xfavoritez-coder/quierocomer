"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { Dish, Category } from "@prisma/client";

interface Props {
  dishes: Dish[];
  categories: Category[];
  onDishClick?: (dishId: string) => void;
  diet: string;
  restrictions: string[];
}

const NUT_ALIASES = ["maní", "mani", "nueces", "almendras", "frutos secos", "nuez", "almendra"];
const isNutRestriction = (r: string) => NUT_ALIASES.includes(r.toLowerCase());

function checkFree(d: any, allergenName: string): boolean {
  // Estricto: exige flag explicito. No inferimos por ausencia de alergeno en ingredientes.
  const name = allergenName.toLowerCase();
  if (name === "gluten") return d.isGlutenFree === true;
  if (name === "lactosa") return d.isLactoseFree === true;
  if (name === "soja" || name === "soya") return d.isSoyFree === true;
  // Frutos secos: containsNuts === false explicito + sin alergeno en ingredientes
  if (isNutRestriction(name)) {
    if (d.containsNuts !== false) return false;
    const ings = d.dishIngredients || [];
    if (ings.length === 0) return true;
    return !ings.some((di: any) => di.ingredient?.allergens?.some((a: any) => NUT_ALIASES.includes((a.name || "").toLowerCase())));
  }
  // Otros alergenos (mariscos, huevo, cerdo, pescado): sin flag, no podemos asegurar
  return false;
}

const RESTRICTION_LABELS: Record<string, string> = {
  gluten: "sin gluten", lactosa: "sin lactosa", soya: "sin soya", soja: "sin soya",
  mariscos: "sin mariscos", cerdo: "sin cerdo", pescado: "sin pescado",
  huevo: "sin huevo", "frutos secos": "sin frutos secos",
};
const DIET_LABELS: Record<string, string> = { vegan: "Vegano", vegetarian: "Vegetariano" };

function pickEmoji(diet: string, restrictions: string[]): string {
  if (diet === "vegan") return "🌿";
  if (diet === "vegetarian") return "🥗";
  if (restrictions.some(isNutRestriction)) return "🥜";
  if (restrictions.includes("gluten")) return "🌾";
  if (restrictions.includes("lactosa")) return "🥛";
  if (restrictions.includes("soya") || restrictions.includes("soja")) return "🫘";
  if (restrictions.includes("_spicy")) return "🌶️";
  return "🧞";
}

export default function GenioSmartCarousel({ dishes, categories, onDishClick, diet, restrictions }: Props) {
  const smartDishes = useMemo(() => {
    const noDrinkIds = new Set(categories.filter(c => (c as any).dishType !== "drink").map(c => c.id));
    return dishes.filter(d => {
      if (!d.isActive || !noDrinkIds.has(d.categoryId)) return false;
      // Diet filter
      if (diet === "vegan" && (d as any).dishDiet !== "VEGAN") return false;
      if (diet === "vegetarian" && !["VEGAN", "VEGETARIAN"].includes((d as any).dishDiet)) return false;
      // Spicy filter
      if (restrictions.includes("_spicy") && (d as any).isSpicy) return false;
      // Allergen filters
      for (const r of restrictions) {
        if (r === "_spicy" || r === "ninguna") continue;
        if (!checkFree(d, r)) return false;
      }
      return true;
    });
  }, [dishes, categories, diet, restrictions]);

  if (smartDishes.length === 0) return null;

  const n = smartDishes.length;
  const titleEmoji = pickEmoji(diet, restrictions);
  const title = `${n} ${n === 1 ? "opción" : "opciones"} para ti ${titleEmoji}`;
  const parts: string[] = [];
  if (diet !== "omnivore" && DIET_LABELS[diet]) parts.push(DIET_LABELS[diet]);
  // Colapsa nuts legacy (mani/nueces/almendras) en un solo "sin frutos secos"
  let nutAdded = false;
  for (const r of restrictions) {
    if (r === "ninguna" || r === "_spicy") continue;
    if (isNutRestriction(r)) {
      if (!nutAdded) { parts.push("sin frutos secos"); nutAdded = true; }
      continue;
    }
    parts.push(RESTRICTION_LABELS[r] || `sin ${r}`);
  }
  if (restrictions.includes("_spicy")) parts.push("sin picante");
  const subtitle = parts.join(" · ");

  // Badge: prioriza dieta, sino primer restriccion
  const badgeLabel = diet === "vegan" ? "VEGAN" : diet === "vegetarian" ? "VEG" : (parts[0]?.toUpperCase() || "DIETA");

  return (
    <div
      id="genio-smart-carousel"
      className="font-[family-name:var(--font-dm)]"
      style={{ margin: "0 12px 10px", padding: "14px 12px 12px", background: "linear-gradient(135deg, #F3EEFF 0%, #EDE8FC 100%)", border: "0.5px solid rgba(128,90,213,0.2)", borderRadius: 16 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", border: "0.5px solid rgba(128,90,213,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>🧞</div>
        <div>
          <p style={{ fontSize: "0.94rem", fontWeight: 600, color: "#3B1F6E", margin: 0 }}>{title}</p>
          <p style={{ fontSize: "0.73rem", color: "#6B4FA0", margin: "1px 0 0" }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" as any }}>
          {smartDishes.slice(0, 20).map(d => {
            const photo = d.photos?.[0];
            return (
              <button key={d.id} onClick={() => onDishClick?.(d.id)} className="active:scale-[0.97] transition-transform"
                style={{ flexShrink: 0, width: 130, background: "#fff", border: "0.5px solid rgba(128,90,213,0.15)", borderRadius: 12, padding: 6, cursor: "pointer", textAlign: "left", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ position: "relative", width: "100%", height: 72, borderRadius: 8, overflow: "hidden", background: "#f0f0f0", marginBottom: 5 }}>
                  {photo ? <Image src={photo} alt={d.name} fill className="object-cover" sizes="130px" /> : <div style={{ width: "100%", height: "100%", background: "#e8e8e8", display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: "1.2rem" }}>🍽</div>}
                  <span style={{ position: "absolute", top: 6, left: 6, maxWidth: "calc(100% - 12px)", background: "rgba(255,255,255,0.95)", color: "#7C3AED", fontSize: "8.5px", fontWeight: 600, padding: "2px 5px", borderRadius: 4, letterSpacing: "0.2px", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#7C3AED", flexShrink: 0 }} />{badgeLabel}
                  </span>
                </div>
                <p style={{ fontSize: "0.80rem", fontWeight: 600, color: "#3B1F6E", margin: "0 0 1px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                {d.description && <p style={{ fontSize: "0.63rem", color: "#6B4FA0", margin: "0 0 2px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description}</p>}
                <p style={{ fontFamily: "var(--font-dm), system-ui, sans-serif", fontSize: "12px", fontWeight: 500, color: "#7C3AED", margin: 0 }}>${d.price.toLocaleString("es-CL")}</p>
              </button>
            );
          })}
        </div>
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 4, width: 32, background: "linear-gradient(to right, transparent, #EDE8FC)", pointerEvents: "none", borderRadius: "0 12px 12px 0" }} />
      </div>
      <p style={{ fontSize: "0.65rem", color: "rgba(0,0,0,0.3)", textAlign: "center", margin: "8px 0 0", lineHeight: 1.3 }}>Confirma ingredientes y alérgenos con el personal del local</p>
    </div>
  );
}
