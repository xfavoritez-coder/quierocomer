"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import DishPlaceholder from "@/components/DishPlaceholder";
import { useAuth } from "@/contexts/AuthContext";

type Dish = { id: string; nombre: string; categoria: string; precio: number; imagenUrl: string | null; dietType: string; avgRating: number | null; totalLoved: number; local: { nombre: string } };

const CATEGORIES = [
  { v: "", l: "Todos" },
  { v: "SUSHI", l: "🍣 Sushi" },
  { v: "PIZZA", l: "🍕 Pizza" },
  { v: "BURGER", l: "🍔 Burger" },
  { v: "PASTA", l: "🍝 Pasta" },
  { v: "SANDWICH", l: "🥪 Sándwich" },
  { v: "STARTER", l: "🥢 Entrada" },
  { v: "MAIN_COURSE", l: "🍽 Fondo" },
  { v: "DESSERT", l: "🍮 Postre" },
  { v: "ICE_CREAM", l: "🍦 Helado" },
  { v: "SALAD", l: "🥗 Ensalada" },
  { v: "SEAFOOD", l: "🦐 Mariscos" },
  { v: "COFFEE", l: "☕ Café" },
  { v: "DRINK", l: "🥤 Bebida" },
];

const CATEGORY_BADGE: Record<string, { emoji: string; label: string }> = {
  SUSHI: { emoji: "🍣", label: "Sushi" },
  MAIN_COURSE: { emoji: "🍽", label: "Fondo" },
  SALAD: { emoji: "🥗", label: "Ensalada" },
  SOUP: { emoji: "🍲", label: "Sopa" },
  BREAKFAST: { emoji: "🍳", label: "Desayuno" },
  BRUNCH: { emoji: "🥑", label: "Brunch" },
  PASTA: { emoji: "🍝", label: "Pasta" },
  PIZZA: { emoji: "🍕", label: "Pizza" },
  BURGER: { emoji: "🍔", label: "Burger" },
  SANDWICH: { emoji: "🥪", label: "Sándwich" },
  SEAFOOD: { emoji: "🦐", label: "Mariscos" },
  DESSERT: { emoji: "🍮", label: "Postre" },
  ICE_CREAM: { emoji: "🍦", label: "Helado" },
  STARTER: { emoji: "🥢", label: "Entrada" },
  VEGETARIAN: { emoji: "🥦", label: "Veggie" },
  VEGAN: { emoji: "🌱", label: "Vegano" },
  COFFEE: { emoji: "☕", label: "Café" },
  JUICE: { emoji: "🧃", label: "Jugo" },
  DRINK: { emoji: "🥤", label: "Bebida" },
  SMOOTHIE: { emoji: "🥤", label: "Smoothie" },
  COCKTAIL: { emoji: "🍹", label: "Cóctel" },
  BEER: { emoji: "🍺", label: "Cerveza" },
  WINE: { emoji: "🍷", label: "Vino" },
  OTHER: { emoji: "🍴", label: "Plato" },
};

function getUserDiet(): string | null {
  try {
    const raw = localStorage.getItem("genieOnboardingData");
    if (raw) {
      const data = JSON.parse(raw);
      if (data.dietType && data.dietType !== "como de todo") return data.dietType;
    }
  } catch {}
  return null;
}

function getDietLabel(diet: string): string {
  return map[diet] ?? diet;
}

export default function ExplorarPage() {
  const { user } = useAuth();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [previewDish, setPreviewDish] = useState<Dish | null>(null);
  const [userDiet, setUserDiet] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserDiet(getUserDiet());
  }, []);

  const fetchDishes = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams();
    if (category) params.set("cat", category);
    if (search) params.set("q", search);
    if (userDiet) params.set("diet", userDiet);
    if (cursor) params.set("cursor", cursor);
    const res = await fetch("/api/explorar?" + params);
    const data = await res.json();
    return { dishes: data.dishes ?? [], nextCursor: data.nextCursor ?? null };
  }, [category, search, userDiet]);

  // Initial load + reset on filter/search change
  useEffect(() => {
    setLoading(true);
    setDishes([]);
    setNextCursor(null);
    fetchDishes()
      .then(({ dishes: d, nextCursor: nc }) => { setDishes(d); setNextCursor(nc); setLoading(false); })
      .catch(() => setLoading(false));
  }, [fetchDishes]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore) {
          setLoadingMore(true);
          fetchDishes(nextCursor)
            .then(({ dishes: d, nextCursor: nc }) => {
              setDishes(prev => [...prev, ...d]);
              setNextCursor(nc);
              setLoadingMore(false);
            })
            .catch(() => setLoadingMore(false));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, fetchDishes]);

  const displayName = typeof window !== "undefined" ? (user?.nombre?.split(" ")[0] || localStorage.getItem("genieUserName")) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", padding: "clamp(20px,4vw,40px) clamp(16px,3vw,24px)" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        {/* Header — matching Descubrir style */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 28, lineHeight: 1, marginBottom: 6 }}>🍽</p>
          <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "#0D0D0D" }}>
            {displayName ? `${displayName}, explora la carta` : "Explora la carta"}
          </h1>
          <p className="font-body" style={{ fontSize: 15, color: "#999", marginTop: 4 }}>
            {userDiet
              ? `Platos ${getDietLabel(userDiet)} aparecen primero`
              : "Todos los platos disponibles con valoraciones"}
          </p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#999" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar plato o local..." style={{ width: "100%", padding: "12px 16px 12px 38px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 12, color: "#0D0D0D", fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Category filters */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16, scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {CATEGORIES.map(c => (
            <button key={c.v} onClick={() => setCategory(c.v)} style={{ padding: "8px 16px", background: category === c.v ? "#0D0D0D" : "#F5F5F5", color: category === c.v ? "#FFF" : "#0D0D0D", border: category === c.v ? "1px solid #0D0D0D" : "1px solid #E0E0E0", borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              {c.l}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🧞</p>
            <p className="font-body" style={{ color: "#999", fontSize: "0.85rem" }}>Cargando platos...</p>
          </div>
        ) : dishes.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🤷</p>
            <p className="font-body" style={{ color: "#999", fontSize: "0.85rem" }}>No se encontraron platos</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dishes.map(d => {
              const cat = CATEGORY_BADGE[d.categoria] ?? CATEGORY_BADGE.OTHER;
              return (
                <div key={d.id} onClick={() => setPreviewDish(d)} style={{ background: "#FFF", border: "1px solid #E0E0E0", borderRadius: 14, overflow: "hidden", display: "flex", cursor: "pointer", transition: "border-color 0.15s" }}>
                  <div style={{ width: 80, height: 80, flexShrink: 0, position: "relative" }}>
                    {d.imagenUrl ? (
                      <Image src={d.imagenUrl} alt={d.nombre} fill sizes="80px" style={{ objectFit: "cover" }} />
                    ) : (
                      <DishPlaceholder categoria={d.categoria} />
                    )}
                    {(d.dietType === "VEGAN" || d.dietType === "VEGETARIAN") && (
                      <div style={{ position: "absolute", bottom: 4, left: 4, fontSize: 10, background: "rgba(0,0,0,0.55)", borderRadius: 99, padding: "2px 6px", color: "#fff", display: "flex", alignItems: "center", gap: 2 }}>
                        {d.dietType === "VEGAN" ? "🌿" : "🌱"}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p className="font-display" style={{ fontSize: "0.85rem", color: "#0D0D0D", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</p>
                      <span style={{ background: "#F5F5F5", color: "#0D0D0D", fontSize: 10, padding: "2px 7px", borderRadius: 99, border: "1px solid #E0E0E0", whiteSpace: "nowrap", flexShrink: 0 }}>{cat.emoji}</span>
                    </div>
                    <p className="font-body" style={{ fontSize: "0.72rem", color: "#999", margin: "2px 0 0" }}>
                      {d.local.nombre}
                      {d.avgRating != null && d.avgRating > 0 && ` · ⭐ ${d.avgRating.toFixed(1)}`}
                      {d.totalLoved > 0 && ` · ❤️ ${d.totalLoved}`}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", paddingRight: 14 }}>
                    <span className="font-display" style={{ fontSize: "0.82rem", color: "#0D0D0D", fontWeight: 500 }}>${d.precio.toLocaleString("es-CL")}</span>
                  </div>
                </div>
              );
            })}
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} style={{ height: 1 }} />
            {loadingMore && (
              <p className="font-body" style={{ color: "#999", textAlign: "center", padding: 16, fontSize: "0.82rem" }}>Cargando más...</p>
            )}
            {!nextCursor && dishes.length > 0 && (
              <p className="font-body" style={{ color: "#E0E0E0", textAlign: "center", padding: 16, fontSize: "0.78rem" }}>No hay más platos</p>
            )}
          </div>
        )}

        {/* Preview modal */}
        {previewDish && (
          <>
            <div onClick={() => setPreviewDish(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(90vw, 400px)", zIndex: 101, borderRadius: 20, overflow: "hidden", background: "#FFF", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
              <button onClick={() => setPreviewDish(null)} style={{ position: "absolute", top: 12, right: 12, zIndex: 2, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              {previewDish.imagenUrl ? (
                <div style={{ position: "relative" }}>
                  <Image src={previewDish.imagenUrl} alt={previewDish.nombre} width={400} height={260} sizes="90vw" style={{ width: "100%", height: 260, objectFit: "cover" }} />
                  {(previewDish.dietType === "VEGAN" || previewDish.dietType === "VEGETARIAN") && (
                    <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(0,0,0,0.6)", borderRadius: 99, padding: "3px 10px", fontSize: 11, color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>
                      {previewDish.dietType === "VEGAN" ? "🌿 Vegano" : "🌱 Vegetariano"}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height: 200 }}><DishPlaceholder categoria={previewDish.categoria} /></div>
              )}
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                  <h3 className="font-display" style={{ fontSize: "1.1rem", color: "#0D0D0D", margin: 0 }}>{previewDish.nombre}</h3>
                  {(() => { const cat = CATEGORY_BADGE[previewDish.categoria] ?? CATEGORY_BADGE.OTHER; return (
                    <span style={{ background: "#F5F5F5", color: "#0D0D0D", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 11, padding: "4px 10px", borderRadius: 99, border: "1px solid #E0E0E0", whiteSpace: "nowrap", flexShrink: 0 }}>{cat.emoji} {cat.label}</span>
                  ); })()}
                </div>
                <p className="font-body" style={{ fontSize: "0.82rem", color: "#999", marginBottom: 6 }}>
                  {previewDish.local.nombre}
                  {previewDish.avgRating != null && previewDish.avgRating > 0 && ` · ⭐ ${previewDish.avgRating.toFixed(1)}`}
                </p>
                <p className="font-display" style={{ fontSize: "1rem", color: "#0D0D0D", marginBottom: 8 }}>${previewDish.precio.toLocaleString("es-CL")}</p>
                {previewDish.totalLoved > 0 && (
                  <p className="font-body" style={{ fontSize: "0.78rem", color: "#3db89e" }}>❤️ {previewDish.totalLoved} personas lo recomiendan</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
