"use client";
import { useState, useEffect, useMemo } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import RestaurantPicker from "@/lib/admin/RestaurantPicker";

interface Category { id: string; name: string; position: number; isActive: boolean; }
interface Dish {
  id: string; name: string; description: string | null; price: number; discountPrice: number | null;
  photos: string[]; tags: string[]; isHero: boolean; isActive: boolean; ingredients: string | null;
  allergens: string | null; position: number; categoryId: string;
  category: { id: string; name: string };
}
interface Restaurant { id: string; name: string; slug: string; }

const F = "var(--font-display)";
const TAG_COLORS: Record<string, string> = { RECOMMENDED: "#F4A623", NEW: "#4ade80", MOST_ORDERED: "#7fbfdc", PROMOTION: "#e85530" };

export default function AdminMenus() {
  const { selectedRestaurantId, restaurants, isSuper, loading: sessionLoading } = useAdminSession();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const activeRestaurant = restaurants.find(r => r.id === selectedRestaurantId);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoading(true);
    setSelectedDish(null);
    fetch(`/api/admin/dishes?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDishes(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedRestaurantId]);

  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    dishes.forEach(d => { if (d.category) cats.set(d.category.id, d.category.name); });
    return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
  }, [dishes]);

  const filtered = useMemo(() => {
    let list = dishes;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.ingredients?.toLowerCase().includes(q));
    }
    if (catFilter !== "all") list = list.filter(d => d.categoryId === catFilter);
    return list;
  }, [dishes, search, catFilter]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, catFilter, selectedRestaurantId]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleDishActive = async (dish: Dish) => {
    await fetch(`/api/admin/dishes/${dish.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !dish.isActive }) });
    setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, isActive: !d.isActive } : d));
  };

  if (sessionLoading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando...</p>;

  if (!selectedRestaurantId) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ color: "#888", fontFamily: F, fontSize: "0.92rem" }}>Selecciona un local en el sidebar para ver su menu</p>
    </div>
  );

  // Edit state (must be at top level, not inside conditional)
  const [editMode, setEditMode] = useState(false);
  const [eName, setEName] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eDiscountPrice, setEDiscountPrice] = useState("");
  const [eIngredients, setEIngredients] = useState("");
  const [eAllergens, setEAllergens] = useState<string[]>([]);
  const [eTags, setETags] = useState<string[]>([]);
  const [eIsHero, setEIsHero] = useState(false);
  const [eDiet, setEDiet] = useState("OMNIVORE");
  const [eSpicy, setESpicy] = useState(false);
  const [saving, setSaving] = useState(false);

  const ALLERGEN_OPTIONS = ["gluten", "lactosa", "frutos secos", "maní", "mariscos", "soja", "huevo", "sésamo", "apio", "mostaza"];
  const TAG_OPTIONS: { value: string; label: string }[] = [
    { value: "RECOMMENDED", label: "Recomendado" },
    { value: "NEW", label: "Nuevo" },
    { value: "MOST_ORDERED", label: "Más pedido" },
    { value: "PROMOTION", label: "Promoción" },
  ];
  const DIET_OPTIONS: { value: string; label: string; icon: string }[] = [
    { value: "VEGAN", label: "Vegano", icon: "🌿" },
    { value: "VEGETARIAN", label: "Vegetariano", icon: "🌱" },
    { value: "PESCETARIAN", label: "Pescetariano", icon: "🐟" },
    { value: "OMNIVORE", label: "Omnívoro", icon: "🍖" },
  ];

  const startEditDish = (d: Dish) => {
    setEditMode(true);
    setEName(d.name);
    setEDesc(d.description || "");
    setEPrice(String(d.price));
    setEDiscountPrice(d.discountPrice ? String(d.discountPrice) : "");
    setEIngredients(d.ingredients || "");
    setEAllergens((d.allergens || "").split(",").map(a => a.trim().toLowerCase()).filter(Boolean));
    setETags([...d.tags]);
    setEIsHero(d.isHero);
    setEDiet((d as any).dishDiet || "OMNIVORE");
    setESpicy((d as any).isSpicy || false);
  };

  const saveDishEdit = async () => {
    if (!selectedDish) return;
    setSaving(true);
    const updates = {
      name: eName,
      description: eDesc || null,
      price: Number(ePrice),
      discountPrice: eDiscountPrice ? Number(eDiscountPrice) : null,
      ingredients: eIngredients || null,
      allergens: eAllergens.filter(a => a !== "ninguno").join(", ") || null,
      tags: eTags,
      isHero: eTags.includes("RECOMMENDED"),
      dishDiet: eDiet,
      isSpicy: eSpicy,
    };
    await fetch(`/api/admin/dishes/${selectedDish.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const updated = { ...selectedDish, ...updates, allergens: updates.allergens, tags: eTags as any };
    setDishes(prev => prev.map(d => d.id === selectedDish.id ? updated : d));
    setSelectedDish(updated);
    setEditMode(false);
    setSaving(false);
  };

  const toggleAllergen = (a: string) => setEAllergens(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  const toggleTag = (t: string) => setETags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  if (selectedDish) return (
    <div style={{ maxWidth: 500 }}>
      <button onClick={() => { setSelectedDish(null); setEditMode(false); }} style={{ background: "none", border: "none", color: "#F4A623", fontFamily: F, fontSize: "0.85rem", cursor: "pointer", marginBottom: 20 }}>&larr; Volver</button>
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, overflow: "hidden" }}>
        {selectedDish.photos?.[0] && (
          <div style={{ height: 200, position: "relative", overflow: "hidden" }}>
            <img src={selectedDish.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {selectedDish.isHero && <span style={{ position: "absolute", top: 10, right: 10, background: "#F4A623", color: "#0a0a0a", fontSize: "0.65rem", fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>HERO</span>}
          </div>
        )}
        <div style={{ padding: 24 }}>
          {!editMode ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h2 style={{ fontFamily: F, fontSize: "1.2rem", color: "white", margin: 0 }}>{selectedDish.name}</h2>
                  <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", margin: "4px 0 0" }}>{selectedDish.category.name}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: F, fontSize: "1.1rem", color: "#F4A623", margin: 0, fontWeight: 700 }}>${selectedDish.price.toLocaleString("es-CL")}</p>
                  {selectedDish.discountPrice && <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#4ade80", margin: 0 }}>${selectedDish.discountPrice.toLocaleString("es-CL")}</p>}
                </div>
              </div>
              {selectedDish.description && <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#aaa", lineHeight: 1.5, margin: "0 0 12px" }}>{selectedDish.description}</p>}

              {/* Badges */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {selectedDish.tags.map(t => <span key={t} style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${TAG_COLORS[t] || "#888"}20`, color: TAG_COLORS[t] || "#888" }}>{t}</span>)}
                {(selectedDish as any).dishDiet && (selectedDish as any).dishDiet !== "OMNIVORE" && <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>{DIET_OPTIONS.find(d => d.value === (selectedDish as any).dishDiet)?.icon} {DIET_OPTIONS.find(d => d.value === (selectedDish as any).dishDiet)?.label}</span>}
                {(selectedDish as any).isSpicy && <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(232,85,48,0.1)", color: "#e85530" }}>🌶️ Picante</span>}
              </div>

              {selectedDish.ingredients && <p style={{ fontFamily: F, fontSize: "0.8rem", color: "#888", margin: "0 0 8px" }}>🥘 {selectedDish.ingredients}</p>}
              {selectedDish.allergens && selectedDish.allergens !== "ninguno" && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                  {selectedDish.allergens.split(",").map(a => a.trim()).filter(a => a && a !== "ninguno").map(a => (
                    <span key={a} style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 4, background: "rgba(232,85,48,0.1)", color: "#e85530" }}>🚫 {a}</span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => startEditDish(selectedDish)} style={{ flex: 1, padding: "10px", background: "rgba(127,191,220,0.1)", border: "1px solid rgba(127,191,220,0.2)", borderRadius: 10, color: "#7fbfdc", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>Editar</button>
                <button onClick={() => { toggleDishActive(selectedDish); setSelectedDish({ ...selectedDish, isActive: !selectedDish.isActive }); }} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, background: selectedDish.isActive ? "rgba(255,100,100,0.1)" : "rgba(74,222,128,0.1)", color: selectedDish.isActive ? "#ff6b6b" : "#4ade80" }}>
                  {selectedDish.isActive ? "Desactivar" : "Activar"}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Full edit mode */}
              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Nombre</label>
                <input value={eName} onChange={e => setEName(e.target.value)} style={INP} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Descripción</label>
                <textarea value={eDesc} onChange={e => setEDesc(e.target.value)} rows={2} style={{ ...INP, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={LBL}>Precio</label>
                  <input type="number" value={ePrice} onChange={e => setEPrice(e.target.value)} style={INP} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={LBL}>Precio descuento</label>
                  <input type="number" value={eDiscountPrice} onChange={e => setEDiscountPrice(e.target.value)} placeholder="Opcional" style={INP} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Tipo de dieta</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DIET_OPTIONS.map(d => (
                    <button key={d.value} onClick={() => setEDiet(d.value)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: eDiet === d.value ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)", color: eDiet === d.value ? "#4ade80" : "#666" }}>
                      {d.icon} {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Características</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setESpicy(!eSpicy)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: eSpicy ? "rgba(232,85,48,0.15)" : "rgba(255,255,255,0.05)", color: eSpicy ? "#e85530" : "#999" }}>
                    🌶️ Picante
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Ingredientes</label>
                <textarea value={eIngredients} onChange={e => setEIngredients(e.target.value)} rows={2} style={{ ...INP, resize: "vertical" }} placeholder="arroz, palta, salmón..." />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Alérgenos</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ALLERGEN_OPTIONS.map(a => (
                    <button key={a} onClick={() => toggleAllergen(a)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, background: eAllergens.includes(a) ? "rgba(232,85,48,0.15)" : "rgba(255,255,255,0.05)", color: eAllergens.includes(a) ? "#e85530" : "#666" }}>
                      {eAllergens.includes(a) ? "🚫 " : ""}{a}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Tags</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TAG_OPTIONS.map(t => {
                    const disabled = t.value === "MOST_ORDERED" || t.value === "PROMOTION";
                    return (
                      <button key={t.value} onClick={() => !disabled && toggleTag(t.value)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, background: eTags.includes(t.value) ? `${TAG_COLORS[t.value]}20` : "rgba(255,255,255,0.05)", color: disabled ? "#444" : eTags.includes(t.value) ? TAG_COLORS[t.value] : "#666", opacity: disabled ? 0.5 : 1 }}>
                        {t.label}{disabled ? " (pronto)" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveDishEdit} disabled={saving || !eName || !ePrice} style={{ flex: 1, padding: "10px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.5 : 1 }}>{saving ? "Guardando..." : "Guardar"}</button>
                <button onClick={() => setEditMode(false)} style={{ flex: 1, padding: "10px", background: "none", border: "1px solid #2A2A2A", borderRadius: 10, color: "#888", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Platos</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", margin: "4px 0 0" }}>{activeRestaurant?.name} · {filtered.length} platos</p>
        </div>
        <RestaurantPicker />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar plato..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.85rem", outline: "none" }}
        />
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{ padding: "10px 14px", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none" }}
        >
          <option value="all">Todas las categorias</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "#F4A623", fontFamily: F, padding: 40, textAlign: "center" }}>Cargando platos...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {paginated.map(d => (
            <button key={d.id} onClick={() => setSelectedDish(d)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12,
              cursor: "pointer", width: "100%", textAlign: "left", opacity: d.isActive ? 1 : 0.5,
              transition: "border-color 0.2s",
            }}
              onMouseOver={e => (e.currentTarget.style.borderColor = "rgba(244,166,35,0.3)")}
              onMouseOut={e => (e.currentTarget.style.borderColor = "#2A2A2A")}
            >
              {d.photos?.[0] ? (
                <img src={d.photos[0]} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#2A2A2A", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={{ fontFamily: F, fontSize: "0.88rem", color: "white", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                  {d.tags.map(t => (
                    <span key={t} style={{ width: 6, height: 6, borderRadius: "50%", background: TAG_COLORS[t] || "#888", flexShrink: 0 }} />
                  ))}
                </div>
                <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", margin: 0 }}>{d.category.name}</p>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <p style={{ fontFamily: F, fontSize: "0.88rem", color: "#F4A623", margin: 0, fontWeight: 600 }}>${d.price.toLocaleString("es-CL")}</p>
                {!d.isActive && <p style={{ fontFamily: F, fontSize: "0.65rem", color: "#ff6b6b", margin: 0 }}>Inactivo</p>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#666", textAlign: "center", padding: 40 }}>
              {dishes.length === 0 ? "Este local no tiene platos" : "No hay platos que coincidan"}
            </p>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2A2A2A", background: page <= 1 ? "transparent" : "rgba(255,255,255,0.04)", color: page <= 1 ? "#555" : "white", fontFamily: F, fontSize: "0.8rem", cursor: page <= 1 ? "default" : "pointer" }}>Anterior</button>
          <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#888", padding: "8px 12px" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2A2A2A", background: page >= totalPages ? "transparent" : "rgba(255,255,255,0.04)", color: page >= totalPages ? "#555" : "white", fontFamily: F, fontSize: "0.8rem", cursor: page >= totalPages ? "default" : "pointer" }}>Siguiente</button>
        </div>
      )}
    </div>
  );
}

const LBL: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 };
const INP: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: "var(--font-display)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" };
