"use client";

import { useState } from "react";

const F = "var(--font-display)";
const B = "var(--font-body)";
const BRAND = "#F4A623";

interface Dish {
  name: string;
  price: number;
  photo: string;
  diet: "VEGAN" | "VEGETARIAN" | "OMNIVORE";
}

interface Category {
  name: string;
  dishes: Dish[];
}

const MENU: Category[] = [
  {
    name: "Para compartir",
    dishes: [
      { name: "Gyozas de cerdo", price: 6900, photo: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=200&h=200&fit=crop", diet: "OMNIVORE" },
      { name: "Edamame con sal de mar", price: 3500, photo: "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=200&h=200&fit=crop", diet: "VEGAN" },
      { name: "Tempura de langostinos", price: 8900, photo: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=200&h=200&fit=crop", diet: "OMNIVORE" },
      { name: "Rollitos primavera veganos", price: 5200, photo: "https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop", diet: "VEGAN" },
    ],
  },
  {
    name: "Ceviches y tiraditos",
    dishes: [
      { name: "Ceviche clásico", price: 12900, photo: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=200&h=200&fit=crop", diet: "OMNIVORE" },
      { name: "Tiradito de salmón", price: 14500, photo: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&h=200&fit=crop", diet: "OMNIVORE" },
      { name: "Ceviche de mango", price: 11900, photo: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop", diet: "OMNIVORE" },
    ],
  },
  {
    name: "Rolls clásicos",
    dishes: [
      { name: "California roll", price: 9900, photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=200&h=200&fit=crop", diet: "OMNIVORE" },
      { name: "Avocado roll", price: 7500, photo: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=200&h=200&fit=crop", diet: "VEGAN" },
      { name: "Spicy tuna roll", price: 11900, photo: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=200&h=200&fit=crop", diet: "OMNIVORE" },
      { name: "Veggie dragon roll", price: 8900, photo: "https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?w=200&h=200&fit=crop", diet: "VEGAN" },
    ],
  },
  {
    name: "Fondos",
    dishes: [
      { name: "Ramen de cerdo", price: 15900, photo: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&h=200&fit=crop", diet: "OMNIVORE" },
      { name: "Pad thai de tofu", price: 12500, photo: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=200&h=200&fit=crop", diet: "VEGAN" },
      { name: "Teriyaki de pollo", price: 13900, photo: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop", diet: "OMNIVORE" },
      { name: "Bowl de quinoa y verduras", price: 11500, photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop", diet: "VEGAN" },
      { name: "Curry verde vegano", price: 12900, photo: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=200&h=200&fit=crop", diet: "VEGAN" },
    ],
  },
  {
    name: "Postres",
    dishes: [
      { name: "Mochi de matcha", price: 4500, photo: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=200&h=200&fit=crop", diet: "VEGAN" },
      { name: "Cheesecake yuzu", price: 5900, photo: "https://images.unsplash.com/photo-1567171466295-4afa63d45416?w=200&h=200&fit=crop", diet: "VEGETARIAN" },
      { name: "Tempura de helado", price: 6500, photo: "https://images.unsplash.com/photo-1488900128323-21503983a07e?w=200&h=200&fit=crop", diet: "OMNIVORE" },
    ],
  },
];

function DishCard({ dish, highlight }: { dish: Dish; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", opacity: highlight === false ? 0.3 : 1, transition: "opacity 0.3s" }}>
      <img src={dish.photo} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 600, color: "white", margin: "2px 0 2px" }}>
          {dish.name}{" "}
          {dish.diet === "VEGAN" && <span style={{ fontSize: "12px", verticalAlign: "middle" }}>🌿</span>}
          {dish.diet === "VEGETARIAN" && <span style={{ fontSize: "12px", verticalAlign: "middle" }}>🥗</span>}
        </p>
        <p style={{ fontFamily: F, fontSize: "0.85rem", color: BRAND, margin: 0 }}>${dish.price.toLocaleString("es-CL")}</p>
      </div>
    </div>
  );
}

/* ── OPCIÓN 1: Badge en header ── */
function Option1() {
  return (
    <div>
      {MENU.map(cat => {
        const veganCount = cat.dishes.filter(d => d.diet === "VEGAN").length;
        // Reorder: vegans first
        const sorted = [...cat.dishes].sort((a, b) => {
          if (a.diet === "VEGAN" && b.diet !== "VEGAN") return -1;
          if (a.diet !== "VEGAN" && b.diet === "VEGAN") return 1;
          return 0;
        });
        return (
          <div key={cat.name} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "white", margin: 0 }}>{cat.name}</h3>
              {veganCount > 0 && (
                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#4ade80", background: "rgba(74,222,128,0.12)", padding: "2px 8px", borderRadius: 50 }}>
                  🌿 {veganCount} vegano{veganCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {sorted.map(d => <DishCard key={d.name} dish={d} />)}
          </div>
        );
      })}
    </div>
  );
}

/* ── OPCIÓN 2: Categorías sin match colapsadas ── */
function Option2() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  return (
    <div>
      {MENU.map(cat => {
        const veganCount = cat.dishes.filter(d => d.diet === "VEGAN").length;
        const isCollapsed = veganCount === 0 && !expanded.has(cat.name);
        const sorted = [...cat.dishes].sort((a, b) => {
          if (a.diet === "VEGAN" && b.diet !== "VEGAN") return -1;
          if (a.diet !== "VEGAN" && b.diet === "VEGAN") return 1;
          return 0;
        });
        return (
          <div key={cat.name} style={{ marginBottom: isCollapsed ? 8 : 24 }}>
            <button
              onClick={() => {
                if (veganCount === 0) {
                  setExpanded(prev => {
                    const n = new Set(prev);
                    n.has(cat.name) ? n.delete(cat.name) : n.add(cat.name);
                    return n;
                  });
                }
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isCollapsed ? 0 : 8, background: "none", border: "none", padding: 0, cursor: veganCount === 0 ? "pointer" : "default", width: "100%" }}
            >
              <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: veganCount > 0 ? "white" : "#555", margin: 0 }}>{cat.name}</h3>
              {veganCount > 0 ? (
                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#4ade80", background: "rgba(74,222,128,0.12)", padding: "2px 8px", borderRadius: 50 }}>
                  🌿 {veganCount}
                </span>
              ) : (
                <span style={{ fontSize: "0.68rem", color: "#555" }}>Sin opciones veganas</span>
              )}
              {veganCount === 0 && (
                <span style={{ marginLeft: "auto", fontSize: "0.85rem", color: "#555", transform: expanded.has(cat.name) ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
              )}
            </button>
            {!isCollapsed && sorted.map(d => <DishCard key={d.name} dish={d} />)}
          </div>
        );
      })}
    </div>
  );
}

/* ── OPCIÓN 3: Banner "Ir a opciones veganas" ── */
function Option3() {
  const firstVeganCat = MENU.find(c => c.dishes.some(d => d.diet === "VEGAN"));
  return (
    <div>
      {/* Sticky banner */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, padding: "10px 0", marginBottom: 16 }}>
        <button
          onClick={() => {
            const el = document.getElementById("opt3-" + firstVeganCat?.name);
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          style={{ width: "100%", padding: "10px 16px", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <span style={{ fontSize: "14px" }}>🌿</span>
          <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "#4ade80" }}>Ir a opciones veganas ↓</span>
        </button>
      </div>
      {MENU.map(cat => {
        const sorted = [...cat.dishes].sort((a, b) => {
          if (a.diet === "VEGAN" && b.diet !== "VEGAN") return -1;
          if (a.diet !== "VEGAN" && b.diet === "VEGAN") return 1;
          return 0;
        });
        return (
          <div key={cat.name} id={`opt3-${cat.name}`} style={{ marginBottom: 24 }}>
            <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "white", margin: "0 0 8px" }}>{cat.name}</h3>
            {sorted.map(d => <DishCard key={d.name} dish={d} />)}
          </div>
        );
      })}
    </div>
  );
}

/* ── OPCIÓN 4: Filtro automático del Genio ── */
function Option4() {
  const [filterOn, setFilterOn] = useState(true);
  return (
    <div>
      {/* Toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: filterOn ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${filterOn ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "16px" }}>🧞</span>
          <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: filterOn ? "#4ade80" : "#888" }}>
            {filterOn ? "Mostrando opciones veganas" : "Mostrando carta completa"}
          </span>
        </div>
        <button
          onClick={() => setFilterOn(!filterOn)}
          style={{ position: "relative", width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: filterOn ? "#4ade80" : "rgba(255,255,255,0.15)", transition: "background 0.2s", padding: 0 }}
        >
          <div style={{ position: "absolute", top: 2, left: filterOn ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
        </button>
      </div>

      {MENU.map(cat => {
        const visibleDishes = filterOn
          ? cat.dishes.filter(d => d.diet === "VEGAN")
          : [...cat.dishes].sort((a, b) => {
              if (a.diet === "VEGAN" && b.diet !== "VEGAN") return -1;
              if (a.diet !== "VEGAN" && b.diet === "VEGAN") return 1;
              return 0;
            });

        if (filterOn && visibleDishes.length === 0) return null;

        return (
          <div key={cat.name} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "white", margin: 0 }}>{cat.name}</h3>
              {filterOn && (
                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#4ade80", background: "rgba(74,222,128,0.12)", padding: "2px 8px", borderRadius: 50 }}>
                  {visibleDishes.length} plato{visibleDishes.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {visibleDishes.map(d => <DishCard key={d.name} dish={d} />)}
          </div>
        );
      })}

      {filterOn && (
        <button onClick={() => setFilterOn(false)} style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, cursor: "pointer", marginTop: 8 }}>
          <span style={{ fontFamily: F, fontSize: "0.82rem", color: "#888" }}>Ver carta completa →</span>
        </button>
      )}
    </div>
  );
}

/* ── OPCIÓN 5: Selección del Genio arriba ── */
function Option5() {
  const allVegan = MENU.flatMap(cat => cat.dishes.filter(d => d.diet === "VEGAN").map(d => ({ ...d, category: cat.name })));
  const [dismissed, setDismissed] = useState(false);

  return (
    <div>
      {/* Genio selection */}
      {!dismissed && (
        <div style={{ marginBottom: 24, background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.15)", borderRadius: 16, padding: "16px 14px", position: "relative" }}>
          <button onClick={() => setDismissed(true)} style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "0.85rem", padding: 0 }}>✕</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: "18px" }}>🧞</span>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "white", margin: 0 }}>Encontré {allVegan.length} platos veganos para ti</p>
              <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>Repartidos en {new Set(allVegan.map(d => d.category)).size} secciones de la carta</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
            {allVegan.map(d => (
              <button key={d.name} onClick={() => {
                const el = document.getElementById("opt5-dish-" + d.name.replace(/\s/g, "-"));
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                el?.animate([{ background: "rgba(74,222,128,0.15)" }, { background: "transparent" }], { duration: 1500 });
              }} style={{ flexShrink: 0, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 8, cursor: "pointer", width: 110, textAlign: "left" }}>
                <img src={d.photo} alt="" style={{ width: "100%", height: 64, borderRadius: 8, objectFit: "cover", marginBottom: 6 }} />
                <p style={{ fontFamily: F, fontSize: "0.7rem", fontWeight: 600, color: "white", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                <p style={{ fontFamily: F, fontSize: "0.68rem", color: BRAND, margin: 0 }}>${d.price.toLocaleString("es-CL")}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Normal menu — untouched order, vegans reordered within each category */}
      {MENU.map(cat => {
        const sorted = [...cat.dishes].sort((a, b) => {
          if (a.diet === "VEGAN" && b.diet !== "VEGAN") return -1;
          if (a.diet !== "VEGAN" && b.diet === "VEGAN") return 1;
          return 0;
        });
        return (
          <div key={cat.name} style={{ marginBottom: 24 }}>
            <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "white", margin: "0 0 8px" }}>{cat.name}</h3>
            {sorted.map(d => (
              <div key={d.name} id={`opt5-dish-${d.name.replace(/\s/g, "-")}`} style={{ borderRadius: 10, transition: "background 0.3s" }}>
                <DishCard dish={d} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ── PAGE ── */
export default function PreviewDietPage() {
  const [active, setActive] = useState(5);

  const descriptions = [
    "Badge en el header de cada categoría mostrando cuántas opciones veganas tiene. Las categorías no se mueven.",
    "Las categorías sin opciones veganas se colapsan automáticamente. Se pueden expandir tocándolas.",
    "Un banner sticky arriba que lleva directo a la primera categoría con opciones veganas.",
    "Filtro automático del Genio: solo muestra platos veganos. Las categorías sin opciones desaparecen. Toggle para ver la carta completa.",
    "El Genio muestra un resumen con todos los platos veganos en un carrusel horizontal arriba. Al tocar uno, baja al plato en la carta. La carta no se modifica.",
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#0e0e0e", color: "white", fontFamily: B }}>
      {/* Tab bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0e0e0e", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "12px 16px 0" }}>
        <p style={{ fontFamily: F, fontSize: "0.75rem", color: BRAND, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 10px" }}>Preview: cliente vegano</p>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setActive(n)}
              style={{
                flex: 1, padding: "8px 0 10px", background: "none", border: "none", cursor: "pointer",
                fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
                color: active === n ? BRAND : "#666",
                borderBottom: active === n ? `2px solid ${BRAND}` : "2px solid transparent",
              }}
            >
              {n === 5 ? "⭐ 5" : n}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: "14px 16px", background: "rgba(244,166,35,0.06)", borderBottom: "1px solid rgba(244,166,35,0.1)" }}>
        <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#ccc", margin: 0, lineHeight: 1.5 }}>
          {descriptions[active - 1]}
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
        {active === 1 && <Option1 />}
        {active === 2 && <Option2 />}
        {active === 3 && <Option3 />}
        {active === 4 && <Option4 />}
        {active === 5 && <Option5 />}
      </div>
    </div>
  );
}
