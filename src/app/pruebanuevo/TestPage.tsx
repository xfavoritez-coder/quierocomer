"use client";

import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type DishDimensions = {
  dishType: string;
  cuisine: string[];
  mealSlot: string[];
  mainIngredient: string[];
  flavor: string[];
  format: string;
  diet: "OMNIVORE" | "VEGETARIAN" | "VEGAN";
};

const VALID_CUISINE = [
  "chilena", "peruana", "italiana", "americana", "mexicana", "japonesa",
  "china", "árabe", "mediterránea", "francesa", "asiática", "coreana",
  "tailandesa", "india", "internacional", "fusión",
];
const VALID_MEAL_SLOT = ["desayuno", "almuerzo", "cena", "snack"];
const VALID_INGREDIENT = [
  "carne", "pollo", "cerdo", "cordero", "pescado", "mariscos", "huevo",
  "pasta", "arroz", "papa", "verduras", "legumbres", "queso", "pan", "fruta", "tofu",
];
const VALID_FLAVOR = [
  "dulce", "salado", "picante", "ácido", "cremoso", "frito",
  "ahumado", "fresco", "crujiente", "umami",
];
const VALID_FORMAT = ["comida_rapida", "saludable", "comfort", "gourmet", "antojo", "tradicional"];

// ── Types from Prisma (minimal, for what we need) ─────────────────────────────

type Category = {
  id: string;
  name: string;
};

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

// ── Helper components ────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        border: `1px solid ${active ? "#a78bfa" : "#333"}`,
        background: active ? "rgba(167,139,250,0.15)" : "transparent",
        color: active ? "#c4b5fd" : "#666",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toggleArr(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TestPage({ restaurant }: { restaurant: Restaurant }) {
  const [classifications, setClassifications] = useState<Record<string, DishDimensions>>({});
  const [loading, setLoading] = useState(false);
  const [editingDishType, setEditingDishType] = useState<string | null>(null);

  const classified = Object.keys(classifications).length;
  const total = restaurant.dishes.length;

  async function classify() {
    setLoading(true);
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
      setClassifications(data);
    } catch (e) {
      console.error("[TestPage classify]", e);
    } finally {
      setLoading(false);
    }
  }

  function updateDim(dishId: string, key: keyof DishDimensions, value: DishDimensions[keyof DishDimensions]) {
    setClassifications((prev) => ({
      ...prev,
      [dishId]: { ...prev[dishId], [key]: value },
    }));
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0d0d0d",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "24px 20px 60px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
              {restaurant.name}
            </h1>
            {restaurant.address && (
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>{restaurant.address}</p>
            )}
            <span
              style={{
                display: "inline-block",
                marginTop: 6,
                padding: "2px 8px",
                background: "#1e1e1e",
                border: "1px solid #2a2a2a",
                borderRadius: 6,
                fontSize: 11,
                color: "#888",
                fontFamily: "monospace",
              }}
            >
              {restaurant.slug}
            </span>
          </div>
          <a
            href={`/pruebanuevo?r=${Date.now()}`}
            style={{
              padding: "8px 16px",
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#bbb",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Otro restaurante →
          </a>
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 16,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={classify}
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: loading ? "#1a1a1a" : "#7c3aed",
              border: loading ? "1px solid #333" : "1px solid #7c3aed",
              borderRadius: 8,
              color: loading ? "#666" : "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {loading && (
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  border: "2px solid #555",
                  borderTopColor: "#a78bfa",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            )}
            {loading ? "Clasificando…" : "Clasificar con AI"}
          </button>

          {classified > 0 && (
            <span style={{ fontSize: 13, color: "#888" }}>
              <span style={{ color: "#a78bfa", fontWeight: 700 }}>{classified}</span>/{total} clasificados
            </span>
          )}
        </div>

        {/* Dish grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {restaurant.dishes.map((dish) => {
            const dims = classifications[dish.id];
            const photo = dish.photos[0] ?? null;

            return (
              <div
                key={dish.id}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 12,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Photo */}
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={dish.name}
                    style={{
                      width: "100%",
                      aspectRatio: "4/3",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "4/3",
                      background: "linear-gradient(135deg, #1e1e24, #2a2a30)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: 32, opacity: 0.3 }}>🍽</span>
                  </div>
                )}

                {/* Content */}
                <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>{dish.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#888" }}>{dish.category.name}</p>
                  {dish.description && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "#666",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {dish.description}
                    </p>
                  )}

                  {/* Dimensions */}
                  {dims && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #2a2a2a", paddingTop: 10 }}>
                      {/* dishType */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, minWidth: 90 }}>Tipo</span>
                        {editingDishType === dish.id ? (
                          <input
                            autoFocus
                            defaultValue={dims.dishType}
                            onBlur={(e) => {
                              updateDim(dish.id, "dishType", e.target.value.trim() || dims.dishType);
                              setEditingDishType(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateDim(dish.id, "dishType", (e.target as HTMLInputElement).value.trim() || dims.dishType);
                                setEditingDishType(null);
                              }
                              if (e.key === "Escape") setEditingDishType(null);
                            }}
                            style={{
                              background: "#262626",
                              border: "1px solid #f59e0b",
                              borderRadius: 6,
                              color: "#fbbf24",
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "2px 8px",
                              outline: "none",
                              width: 140,
                            }}
                          />
                        ) : (
                          <button
                            onClick={() => setEditingDishType(dish.id)}
                            title="Click para editar"
                            style={{
                              padding: "2px 10px",
                              borderRadius: 6,
                              background: "rgba(251,191,36,0.12)",
                              border: "1px solid rgba(251,191,36,0.3)",
                              color: "#fbbf24",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {dims.dishType}
                          </button>
                        )}
                      </div>

                      {/* cuisine */}
                      <DimRow label="Cocina">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_CUISINE.map((v) => (
                            <Pill
                              key={v}
                              label={v}
                              active={dims.cuisine.includes(v)}
                              onClick={() => updateDim(dish.id, "cuisine", toggleArr(dims.cuisine, v))}
                            />
                          ))}
                        </div>
                      </DimRow>

                      {/* mealSlot */}
                      <DimRow label="Momento">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_MEAL_SLOT.map((v) => (
                            <Pill
                              key={v}
                              label={v}
                              active={dims.mealSlot.includes(v)}
                              onClick={() => updateDim(dish.id, "mealSlot", toggleArr(dims.mealSlot, v))}
                            />
                          ))}
                        </div>
                      </DimRow>

                      {/* mainIngredient */}
                      <DimRow label="Ingrediente">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_INGREDIENT.map((v) => (
                            <Pill
                              key={v}
                              label={v}
                              active={dims.mainIngredient.includes(v)}
                              onClick={() => updateDim(dish.id, "mainIngredient", toggleArr(dims.mainIngredient, v))}
                            />
                          ))}
                        </div>
                      </DimRow>

                      {/* flavor */}
                      <DimRow label="Sabor">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_FLAVOR.map((v) => (
                            <Pill
                              key={v}
                              label={v}
                              active={dims.flavor.includes(v)}
                              onClick={() => updateDim(dish.id, "flavor", toggleArr(dims.flavor, v))}
                            />
                          ))}
                        </div>
                      </DimRow>

                      {/* format — single select */}
                      <DimRow label="Formato">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {VALID_FORMAT.map((v) => (
                            <button
                              key={v}
                              onClick={() => updateDim(dish.id, "format", v)}
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 500,
                                border: `1px solid ${dims.format === v ? "#6ee7b7" : "#333"}`,
                                background: dims.format === v ? "rgba(110,231,183,0.12)" : "transparent",
                                color: dims.format === v ? "#6ee7b7" : "#666",
                                cursor: "pointer",
                              }}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </DimRow>

                      {/* diet */}
                      <DimRow label="Dieta">
                        <div style={{ display: "flex", gap: 4 }}>
                          {(["OMNIVORE", "VEGETARIAN", "VEGAN"] as const).map((v) => {
                            const active = dims.diet === v;
                            const colors: Record<string, { bg: string; border: string; text: string }> = {
                              OMNIVORE: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)", text: "#fca5a5" },
                              VEGETARIAN: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.4)", text: "#86efac" },
                              VEGAN: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.4)", text: "#6ee7b7" },
                            };
                            const c = colors[v];
                            const labels: Record<string, string> = {
                              OMNIVORE: "Omnívoro",
                              VEGETARIAN: "Veg.",
                              VEGAN: "Vegano",
                            };
                            return (
                              <button
                                key={v}
                                onClick={() => updateDim(dish.id, "diet", v)}
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  border: `1px solid ${active ? c.border : "#2a2a2a"}`,
                                  background: active ? c.bg : "transparent",
                                  color: active ? c.text : "#555",
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function DimRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span
        style={{
          fontSize: 10,
          color: "#555",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          minWidth: 70,
          paddingTop: 4,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
