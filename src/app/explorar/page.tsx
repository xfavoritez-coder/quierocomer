"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import DishPlaceholder from "@/components/DishPlaceholder";

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
];

export default function ExplorarPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/explorar?" + new URLSearchParams({ ...(category && { cat: category }), ...(search && { q: search }) }))
      .then(r => r.json())
      .then(d => { setDishes(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [category, search]);

  return (
    <div style={{ padding: "clamp(20px,4vw,40px) clamp(16px,3vw,24px)" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h1 className="font-display" style={{ fontSize: "1.3rem", color: "#0D0D0D", marginBottom: 4 }}>Explorar platos</h1>
        <p className="font-body" style={{ fontSize: "0.82rem", color: "#999", marginBottom: 16 }}>Todos los platos disponibles con valoraciones</p>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar plato..." style={{ width: "100%", padding: "12px 16px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 12, color: "#0D0D0D", fontSize: "0.88rem", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />

        {/* Category filters */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
          {CATEGORIES.map(c => (
            <button key={c.v} onClick={() => setCategory(c.v)} style={{ padding: "6px 14px", background: category === c.v ? "#0D0D0D" : "#F5F5F5", color: category === c.v ? "#FFD600" : "#0D0D0D", border: "none", borderRadius: 99, fontSize: "0.75rem", fontWeight: category === c.v ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              {c.l}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <p className="font-body" style={{ color: "#999", textAlign: "center", padding: 40 }}>Cargando...</p>
        ) : dishes.length === 0 ? (
          <p className="font-body" style={{ color: "#999", textAlign: "center", padding: 40 }}>No se encontraron platos</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dishes.map(d => (
              <div key={d.id} style={{ background: "#FFF", border: "1px solid #E0E0E0", borderRadius: 12, overflow: "hidden", display: "flex" }}>
                <div style={{ width: 80, height: 80, flexShrink: 0, position: "relative" }}>
                  {d.imagenUrl ? (
                    <Image src={d.imagenUrl} alt={d.nombre} fill sizes="80px" style={{ objectFit: "cover" }} />
                  ) : (
                    <DishPlaceholder categoria={d.categoria} />
                  )}
                  {d.dietType === "VEGAN" && (
                    <div style={{ position: "absolute", bottom: 2, left: 2, fontSize: 10, background: "rgba(0,0,0,0.5)", borderRadius: 99, padding: "1px 4px", color: "#fff" }}>🌿</div>
                  )}
                </div>
                <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <p className="font-display" style={{ fontSize: "0.85rem", color: "#0D0D0D", margin: 0 }}>{d.nombre}</p>
                  <p className="font-body" style={{ fontSize: "0.72rem", color: "#999", margin: "2px 0 0" }}>
                    {d.local.nombre}
                    {d.avgRating != null && d.avgRating > 0 && ` · ⭐ ${d.avgRating.toFixed(1)}`}
                    {d.totalLoved > 0 && ` · ❤️ ${d.totalLoved}`}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", paddingRight: 12 }}>
                  <span className="font-body" style={{ fontSize: "0.78rem", color: "#AAAAAA" }}>${d.precio.toLocaleString("es-CL")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
