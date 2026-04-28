"use client";

import { useState, useMemo, useRef } from "react";
import Image from "next/image";
import type { Restaurant, Category, Dish } from "@prisma/client";
import { norm } from "@/lib/normalize";
import { getDishPhoto, groupDishesByCategory } from "./utils/dishHelpers";

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  popularDishIds?: Set<string>;
}

export default function CartaDesktop({ restaurant, categories, dishes, popularDishIds }: Props) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const [query, setQuery] = useState("");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query) return dishes;
    const q = norm(query.trim());
    return dishes.filter(d => norm(d.name || "").includes(q) || norm(d.description || "").includes(q));
  }, [dishes, query]);

  const grouped = useMemo(() => groupDishesByCategory(filtered, categories), [filtered, categories]);

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const el = document.getElementById(`desktop-cat-${catId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ef", fontFamily: "var(--font-dm)" }}>
      {/* Header */}
      <header style={{ background: "white", borderBottom: "1px solid #e8e4dc", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
          {/* Top row: logo + name + search */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0" }}>
            {restaurant.logoUrl ? (
              <Image src={restaurant.logoUrl} alt="" width={40} height={40} className="rounded-full" style={{ border: "1px solid #e8e4dc" }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontWeight: 700, color: "white" }}>
                {restaurant.name.charAt(0)}
              </div>
            )}
            <h1 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a", flex: 1 }}>
              {restaurant.name}
            </h1>
            {/* Search */}
            <div style={{ position: "relative", width: 260 }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar en el menú..."
                style={{
                  width: "100%", padding: "10px 14px 10px 38px", borderRadius: 10,
                  border: "1px solid #e0dcd4", background: "#faf9f6", fontSize: "0.88rem",
                  color: "#333", outline: "none",
                }}
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
          </div>

          {/* Category tabs */}
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
            {categories.map(cat => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  style={{
                    padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap",
                    background: isActive ? "#1a1a1a" : "transparent",
                    color: isActive ? "white" : "#888",
                    transition: "all 0.15s",
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <div ref={contentRef} style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 40px 80px" }}>
        {grouped.map(group => {
          if (group.dishes.length === 0) return null;
          return (
            <section key={group.category.id} id={`desktop-cat-${group.category.id}`} style={{ marginBottom: 48 }}>
              <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1a1a1a", marginBottom: 20, paddingBottom: 10, borderBottom: "2px solid #e8e4dc" }}>
                {group.category.name}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
                {group.dishes.map(dish => (
                  <DesktopDishCard
                    key={dish.id}
                    dish={dish}
                    isPopular={popularDishIds?.has(dish.id)}
                    onClick={() => setSelectedDish(dish)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && query && (
          <p style={{ textAlign: "center", color: "#999", fontSize: "1rem", padding: 60 }}>
            No se encontraron resultados para "{query}"
          </p>
        )}
      </div>

      {/* Dish detail modal */}
      {selectedDish && (
        <div
          onClick={() => setSelectedDish(null)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: 20, maxWidth: 520, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
          >
            {selectedDish.photos?.[0] && (
              <div style={{ height: 300, position: "relative", overflow: "hidden", borderRadius: "20px 20px 0 0" }}>
                <Image src={selectedDish.photos[0]} alt={selectedDish.name} fill className="object-cover" sizes="520px" />
              </div>
            )}
            <div style={{ padding: "24px 28px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1a1a1a", flex: 1 }}>
                  {selectedDish.name}
                </h3>
                <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.3rem", fontWeight: 600, color: "#F4A623", flexShrink: 0, marginLeft: 16 }}>
                  ${(selectedDish.discountPrice || selectedDish.price)?.toLocaleString("es-CL")}
                </span>
              </div>
              {selectedDish.description && (
                <p style={{ fontSize: "1rem", color: "#666", lineHeight: 1.6, marginBottom: 16 }}>
                  {selectedDish.description}
                </p>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(selectedDish as any).dishDiet === "VEGAN" && <span style={{ fontSize: "0.82rem", padding: "4px 12px", borderRadius: 50, background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>🌿 Vegano</span>}
                {(selectedDish as any).dishDiet === "VEGETARIAN" && <span style={{ fontSize: "0.82rem", padding: "4px 12px", borderRadius: 50, background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>🌱 Vegetariano</span>}
                {(selectedDish as any).isSpicy && <span style={{ fontSize: "0.82rem", padding: "4px 12px", borderRadius: 50, background: "rgba(232,85,48,0.1)", color: "#e85530" }}>🌶️ Picante</span>}
              </div>
              <button
                onClick={() => setSelectedDish(null)}
                style={{ marginTop: 20, width: "100%", padding: "12px", borderRadius: 12, border: "1px solid #e0dcd4", background: "transparent", cursor: "pointer", fontSize: "0.9rem", color: "#666", fontWeight: 500 }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "20px 0 30px" }}>
        <span style={{ fontSize: "0.78rem", color: "#bbb" }}>Powered by </span>
        <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "0.85rem", color: "#999", fontWeight: 700 }}>
          QuieroComer<span style={{ color: "#F4A623" }}>.cl</span>
        </span>
      </footer>
    </div>
  );
}

function DesktopDishCard({ dish, isPopular, onClick }: { dish: Dish; isPopular?: boolean; onClick: () => void }) {
  const photo = getDishPhoto(dish);
  const isNew = dish.tags?.includes("NEW");
  const isRec = dish.tags?.includes("RECOMMENDED");

  return (
    <button
      onClick={onClick}
      style={{
        background: "white", borderRadius: 14, overflow: "hidden",
        border: isRec ? "2px solid rgba(244,166,35,0.3)" : "1px solid #ebe7df",
        cursor: "pointer", textAlign: "left", transition: "transform 0.15s, box-shadow 0.15s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
    >
      {/* Photo */}
      <div style={{ height: 180, position: "relative", overflow: "hidden", background: photo ? "#f0f0f0" : "linear-gradient(135deg, #f7f7f5, #e8e4d8)" }}>
        {photo ? (
          <Image src={photo} alt={dish.name} fill className="object-cover" sizes="300px" />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>🍽</div>
        )}
        {/* Badges on photo */}
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
          {isNew && <span style={{ fontSize: "10px", fontWeight: 700, color: "white", background: "#e85530", padding: "3px 8px", borderRadius: 50, letterSpacing: "0.05em" }}>NUEVO</span>}
          {isPopular && <span style={{ fontSize: "10px", fontWeight: 600, color: "white", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: 50 }}>🔥 Popular</span>}
          {isRec && <span style={{ fontSize: "10px", fontWeight: 600, color: "white", background: "rgba(244,166,35,0.85)", padding: "3px 8px", borderRadius: 50 }}>⭐ Recomendado</span>}
        </div>
        {/* Diet badges */}
        <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 4 }}>
          {(dish as any).dishDiet === "VEGAN" && <span style={{ fontSize: "11px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "2px 6px", borderRadius: 4, color: "white" }}>🌿</span>}
          {(dish as any).dishDiet === "VEGETARIAN" && <span style={{ fontSize: "11px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "2px 6px", borderRadius: 4, color: "white" }}>🌱</span>}
          {(dish as any).isSpicy && <span style={{ fontSize: "11px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "2px 6px", borderRadius: 4, color: "white" }}>🌶️</span>}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px 16px" }}>
        <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.05rem", fontWeight: 600, color: "#1a1a1a", marginBottom: 4, lineHeight: 1.3 }}>
          {dish.name}
        </h3>
        {dish.description && (
          <p style={{
            fontSize: "0.85rem", color: "#888", lineHeight: 1.4, marginBottom: 8,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {dish.description}
          </p>
        )}
        <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.1rem", fontWeight: 600, color: dish.discountPrice ? "#F4A623" : "#1a1a1a" }}>
          ${(dish.discountPrice || dish.price)?.toLocaleString("es-CL")}
        </span>
        {dish.discountPrice && (
          <span style={{ fontSize: "0.82rem", color: "#bbb", textDecoration: "line-through", marginLeft: 8 }}>
            ${dish.price?.toLocaleString("es-CL")}
          </span>
        )}
      </div>
    </button>
  );
}
