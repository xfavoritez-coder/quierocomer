"use client";

import { useState } from "react";

// ── Taxonomy ──────────────────────────────────────────────────────────────────

const VALID_DISH_TYPE = [
  "combo","extra",
  "hamburguesa","completo","sándwich","wrap","croissant","bagel","tostada",
  "churrasco","milanesa","asado","costillas","pernil","anticucho","kebab",
  "pollo asado","pollo frito","tenders","alitas","nuggets",
  "ceviche","tiradito",
  "pasta","lasagna","risotto","arroz","fideos",
  "pizza","calzone","quiche","empanada",
  "sopa","cazuela","ramen",
  "ensalada","bowl",
  "sushi","hand roll","curry","pad thai","gyoza","wantan",
  "taco","burrito","quesadilla","arepa","salchipapa",
  "sopaipilla","pastel de choclo",
  "huevos","pancake","waffle","crepe","avena","omelet",
  "papas fritas","nachos","aros de cebolla","croquetas","arrollado de primavera","spring roll",
  "helado","torta","brownie","galleta","muffin","cheesecake","churros","donut","flan",
  "café","café con leche","té","jugo","batido","bebida","alcohol","mocktail",
];

const VALID_CUISINE = [
  "chilena","peruana","nikkei","venezolana","italiana","americana","mexicana","japonesa",
  "china","árabe","mediterránea","francesa","asiática","coreana","india","thai","griega","española","brasileña","fusión",
];
const VALID_MEAL_SLOT = ["desayuno","almuerzo","cena","snack"];
const VALID_INGREDIENT = [
  "carne","pollo","cerdo","cordero","pescado","salmón","camarones","pulpo","mariscos","huevo",
  "pasta","arroz","papa","verduras","legumbres","queso","queso crema","pan","fruta","tofu",
  "tomate","lechuga","palta","cebolla","cebollín","jamón","salame","choclo","nutella",
];
const VALID_FLAVOR = ["dulce","salado","picante","frito","grillado","asado"];
const VALID_ESTILO = ["comida rapida","saludable"];

// ── Types ─────────────────────────────────────────────────────────────────────

type DishDimensions = {
  dishType: string[];
  cuisine: string[];
  mealSlot: string[];
  mainIngredient: string[];
  flavor: string[];
  estilo: string[];
  diet: "OMNIVORE" | "VEGETARIAN" | "VEGAN";
};

type Category = { id: string; name: string };
type Dish = {
  id: string;
  name: string;
  description: string | null;
  photos: string[];
  price: number;
  isHero: boolean;
  category: Category;
};
type Restaurant = {
  id: string;
  name: string;
  address: string | null;
  slug: string;
  dishes: Dish[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function toggleArr(arr: string[], val: string): string[] {
  return arr.some((x) => norm(x) === norm(val)) ? arr.filter((x) => norm(x) !== norm(val)) : [...arr, val];
}

function arrIncludes(arr: string[], val: string): boolean {
  return arr.some((x) => norm(x) === norm(val));
}

function Pill({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: "amber" | "green" }) {
  const amber = { border: "#f59e0b", bg: "rgba(245,158,11,0.15)", text: "#fbbf24" };
  const green = { border: "#22c55e", bg: "rgba(34,197,94,0.12)", text: "#86efac" };
  const purple = { border: "#a78bfa", bg: "rgba(167,139,250,0.15)", text: "#c4b5fd" };
  const c = active ? (color === "amber" ? amber : color === "green" ? green : purple) : null;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 10px", borderRadius: 999, fontSize: 13, fontWeight: 500,
        border: `1px solid ${c ? c.border : "#2a2a2a"}`,
        background: c ? c.bg : "transparent",
        color: c ? c.text : "#555",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function DimRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: 0.5, minWidth: 72, paddingTop: 4, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TestPage({ restaurant }: { restaurant: Restaurant }) {
  const [classifications, setClassifications] = useState<Record<string, DishDimensions>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classified = Object.keys(classifications).length;
  const total = restaurant.dishes.length;

  async function classify() {
    setLoading(true);
    setError(null);
    try {
      const dishes = restaurant.dishes.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        category: d.category.name,
      }));
      const res = await fetch("/api/pruebanuevo/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error"); return; }
      setClassifications(data);
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  function updateDim(dishId: string, key: keyof DishDimensions, value: DishDimensions[keyof DishDimensions]) {
    setClassifications((prev) => ({ ...prev, [dishId]: { ...prev[dishId], [key]: value } }));
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0d0d0d", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{restaurant.name}</h1>
            {restaurant.address && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>{restaurant.address}</p>}
            <span style={{ display: "inline-block", marginTop: 6, padding: "2px 8px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, fontSize: 11, color: "#666", fontFamily: "monospace" }}>
              {restaurant.slug}
            </span>
          </div>
          <a href={`/pruebanuevo?r=${Date.now()}`} style={{ padding: "8px 16px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#888", fontSize: 13, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap" }}>
            Otro restaurante →
          </a>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 24px", flexWrap: "wrap" }}>
          <button
            onClick={classify}
            disabled={loading}
            style={{
              padding: "10px 20px", background: loading ? "#1a1a1a" : "#7c3aed",
              border: `1px solid ${loading ? "#333" : "#7c3aed"}`, borderRadius: 8,
              color: loading ? "#555" : "#fff", fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {loading && <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #555", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
            {loading ? "Clasificando…" : classified > 0 ? "Re-clasificar" : "Clasificar con AI"}
          </button>
          {classified > 0 && <span style={{ fontSize: 13, color: "#555" }}><span style={{ color: "#a78bfa", fontWeight: 700 }}>{classified}</span>/{total} platos</span>}
          {error && <span style={{ fontSize: 13, color: "#ef4444" }}>{error}</span>}
        </div>

        {/* Leyenda dimensiones */}
        {classified > 0 && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, padding: "10px 14px", background: "#111", border: "1px solid #1e1e1e", borderRadius: 8 }}>
            {[
              { label: "Tipo", color: "#fbbf24" },
              { label: "Cocina", color: "#c4b5fd" },
              { label: "Momento", color: "#c4b5fd" },
              { label: "Ingrediente", color: "#c4b5fd" },
              { label: "Sabor", color: "#c4b5fd" },
              { label: "Estilo", color: "#86efac" },
              { label: "Dieta", color: "#888" },
            ].map(({ label, color }) => (
              <span key={label} style={{ fontSize: 11, color, fontWeight: 500 }}>{label}</span>
            ))}
            <span style={{ fontSize: 11, color: "#444", marginLeft: "auto" }}>Click en cualquier tag para editar</span>
          </div>
        )}

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {restaurant.dishes.map((dish) => {
            const dims = classifications[dish.id];
            const photo = dish.photos[0] ?? null;

            return (
              <div key={dish.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>

                {/* Photo */}
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={dish.name} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "4/3", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 28, opacity: 0.2 }}>🍽</span>
                  </div>
                )}

                {/* Content */}
                <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{dish.name}</p>
                    {dish.price > 0 && <span style={{ fontSize: 12, color: "#555", flexShrink: 0 }}>${dish.price.toLocaleString("es-CL")}</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: "#444" }}>{dish.category.name}</p>
                  {dish.description && (
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {dish.description}
                    </p>
                  )}

                  {/* Dimensions */}
                  {dims ? (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7, borderTop: "1px solid #1e1e1e", paddingTop: 10 }}>

                      {/* dishType — multi-select, amber */}
                      <DimRow label="Tipo">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_DISH_TYPE.map((v) => (
                            <Pill key={v} label={v} active={arrIncludes(dims.dishType, v)} color="amber"
                              onClick={() => updateDim(dish.id, "dishType", toggleArr(dims.dishType, v))} />
                          ))}
                        </div>
                      </DimRow>

                      {/* cuisine */}
                      <DimRow label="Cocina">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_CUISINE.map((v) => (
                            <Pill key={v} label={v} active={arrIncludes(dims.cuisine, v)}
                              onClick={() => updateDim(dish.id, "cuisine", toggleArr(dims.cuisine, v))} />
                          ))}
                        </div>
                      </DimRow>

                      {/* mealSlot */}
                      <DimRow label="Momento">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_MEAL_SLOT.map((v) => (
                            <Pill key={v} label={v} active={arrIncludes(dims.mealSlot, v)}
                              onClick={() => updateDim(dish.id, "mealSlot", toggleArr(dims.mealSlot, v))} />
                          ))}
                        </div>
                      </DimRow>

                      {/* mainIngredient */}
                      <DimRow label="Ingrediente">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_INGREDIENT.map((v) => (
                            <Pill key={v} label={v} active={arrIncludes(dims.mainIngredient, v)}
                              onClick={() => updateDim(dish.id, "mainIngredient", toggleArr(dims.mainIngredient, v))} />
                          ))}
                        </div>
                      </DimRow>

                      {/* flavor */}
                      <DimRow label="Sabor">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_FLAVOR.map((v) => (
                            <Pill key={v} label={v} active={arrIncludes(dims.flavor, v)}
                              onClick={() => updateDim(dish.id, "flavor", toggleArr(dims.flavor, v))} />
                          ))}
                        </div>
                      </DimRow>

                      {/* estilo — multi-select, green */}
                      <DimRow label="Estilo">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_ESTILO.map((v) => (
                            <Pill key={v} label={v} active={arrIncludes(dims.estilo, v)} color="green"
                              onClick={() => updateDim(dish.id, "estilo", toggleArr(dims.estilo, v))} />
                          ))}
                        </div>
                      </DimRow>

                      {/* diet */}
                      <DimRow label="Dieta">
                        <div style={{ display: "flex", gap: 4 }}>
                          {(["OMNIVORE", "VEGETARIAN", "VEGAN"] as const).map((v) => {
                            const active = dims.diet === v;
                            const colors = {
                              OMNIVORE: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", text: "#fca5a5" },
                              VEGETARIAN: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)", text: "#86efac" },
                              VEGAN: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", text: "#6ee7b7" },
                            };
                            const labels = { OMNIVORE: "Omnívoro", VEGETARIAN: "Vegetariano", VEGAN: "Vegano" };
                            const c = colors[v];
                            return (
                              <button key={v} onClick={() => updateDim(dish.id, "diet", v)}
                                style={{
                                  padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                  border: `1px solid ${active ? c.border : "#1e1e1e"}`,
                                  background: active ? c.bg : "transparent",
                                  color: active ? c.text : "#444",
                                  cursor: "pointer",
                                }}
                              >
                                {labels[v]}
                              </button>
                            );
                          })}
                        </div>
                      </DimRow>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, height: 2, background: "#1a1a1a", borderRadius: 1 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
