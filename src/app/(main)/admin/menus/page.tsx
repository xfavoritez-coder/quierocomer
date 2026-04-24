"use client";
import { useState, useEffect, useMemo } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import RestaurantPicker from "@/lib/admin/RestaurantPicker";
import { norm } from "@/lib/normalize";

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
      const q = norm(search);
      list = list.filter(d => norm(d.name).includes(q) || norm(d.description || "").includes(q) || norm(d.ingredients || "").includes(q));
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
      <p style={{ color: "var(--adm-text2)", fontFamily: F, fontSize: "0.92rem" }}>Selecciona un local en el sidebar para ver su menu</p>
    </div>
  );

  const [photoModal, setPhotoModal] = useState<string | null>(null);

  // Edit state (must be at top level, not inside conditional)
  const [editMode, setEditMode] = useState(false);
  const [eName, setEName] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eDiscountPrice, setEDiscountPrice] = useState("");
  const [eIngredients, setEIngredients] = useState("");
  const [eIngredientIds, setEIngredientIds] = useState<string[]>([]);
  const [allIngredients, setAllIngredients] = useState<{ id: string; name: string; category: string }[]>([]);
  const [ingSearch, setIngSearch] = useState("");
  const [eAllergens, setEAllergens] = useState<string[]>([]);
  const [eTags, setETags] = useState<string[]>([]);
  const [eIsHero, setEIsHero] = useState(false);
  const [eDiet, setEDiet] = useState("OMNIVORE");
  const [eSpicy, setESpicy] = useState(false);
  const [eHighMargin, setEHighMargin] = useState(false);
  const [eFeaturedAuto, setEFeaturedAuto] = useState(false);
  const [saving, setSaving] = useState(false);

  const TAG_OPTIONS: { value: string; label: string }[] = [
    { value: "RECOMMENDED", label: "Destacado" },
    { value: "NEW", label: "Nuevo" },
    { value: "MOST_ORDERED", label: "Más pedido" },
    { value: "PROMOTION", label: "Promoción" },
  ];
  const DIET_OPTIONS: { value: string; label: string; icon: string }[] = [
    { value: "VEGAN", label: "Vegano", icon: "🌿" },
    { value: "VEGETARIAN", label: "Vegetariano", icon: "🌱" },
    { value: "OMNIVORE", label: "Omnívoro", icon: "🍖" },
  ];

  const startEditDish = async (d: Dish) => {
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
    setEHighMargin((d as any).isHighMargin || false);
    setEFeaturedAuto((d as any).isFeaturedAuto || false);
    setIngSearch("");
    // Load ingredients master list + linked
    fetch(`/api/admin/ingredients?dishId=${d.id}`)
      .then(r => r.json())
      .then(data => {
        setAllIngredients(data.ingredients || []);
        setEIngredientIds(data.linkedIds || []);
      }).catch(() => {});
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
      tags: eTags,
      isHero: eTags.includes("RECOMMENDED"),
      dishDiet: eDiet,
      isSpicy: eSpicy,
      isHighMargin: eHighMargin,
      isFeaturedAuto: eFeaturedAuto,
      ingredientIds: eIngredientIds,
    };
    const res = await fetch(`/api/admin/dishes/${selectedDish.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const serverDish = await res.json();
    const updated = { ...selectedDish, ...updates, ...serverDish, tags: eTags as any };
    setDishes(prev => prev.map(d => d.id === selectedDish.id ? updated : d));
    setSelectedDish(updated);
    setEditMode(false);
    setSaving(false);
  };

  const MAX_RECOMMENDED = 5;
  const recCount = dishes.filter(d => d.tags?.includes("RECOMMENDED") && d.isActive && d.id !== selectedDish?.id).length;
  const toggleTag = (t: string) => {
    if (t === "RECOMMENDED" && !eTags.includes(t) && recCount >= MAX_RECOMMENDED) return;
    setETags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  if (selectedDish) return (
    <div style={{ maxWidth: 500 }}>
      <button onClick={() => { setSelectedDish(null); setEditMode(false); }} style={{ background: "none", border: "none", color: "#F4A623", fontFamily: F, fontSize: "0.85rem", cursor: "pointer", marginBottom: 20 }}>&larr; Volver</button>
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, overflow: "hidden" }}>
        {selectedDish.photos?.[0] && (
          <div style={{ height: 200, position: "relative", overflow: "hidden" }}>
            <img src={selectedDish.photos[0]} alt="" onClick={() => setPhotoModal(selectedDish.photos[0])} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
            {selectedDish.isHero && <span style={{ position: "absolute", top: 10, right: 10, background: "#F4A623", color: "#0a0a0a", fontSize: "0.65rem", fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>HERO</span>}
          </div>
        )}
        <div style={{ padding: 24 }}>
          {!editMode ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h2 style={{ fontFamily: F, fontSize: "1.2rem", color: "var(--adm-text)", margin: 0 }}>{selectedDish.name}</h2>
                  <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>{selectedDish.category.name}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: F, fontSize: "1.1rem", color: "#F4A623", margin: 0, fontWeight: 700 }}>${selectedDish.price.toLocaleString("es-CL")}</p>
                  {selectedDish.discountPrice && <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#4ade80", margin: 0 }}>${selectedDish.discountPrice.toLocaleString("es-CL")}</p>}
                </div>
              </div>
              {selectedDish.description && <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text2)", lineHeight: 1.5, margin: "0 0 12px" }}>{selectedDish.description}</p>}

              {/* Badges */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {selectedDish.tags.map(t => <span key={t} style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${TAG_COLORS[t] || "#888"}20`, color: TAG_COLORS[t] || "#888" }}>{t}</span>)}
                {(selectedDish as any).dishDiet && (selectedDish as any).dishDiet !== "OMNIVORE" && <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>{DIET_OPTIONS.find(d => d.value === (selectedDish as any).dishDiet)?.icon} {DIET_OPTIONS.find(d => d.value === (selectedDish as any).dishDiet)?.label}</span>}
                {(selectedDish as any).isSpicy && <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(232,85,48,0.1)", color: "#e85530" }}>🌶️ Picante</span>}
              </div>

              {selectedDish.ingredients && <p style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "0 0 8px" }}>🥘 {selectedDish.ingredients}</p>}
              {selectedDish.allergens && selectedDish.allergens !== "ninguno" && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                  {selectedDish.allergens.split(",").map(a => a.trim()).filter(a => a && a !== "ninguno").map(a => (
                    <span key={a} style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 4, background: "rgba(232,85,48,0.1)", color: "#e85530" }}>⚠️ {a}</span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={async () => {
                    const isRec = selectedDish.tags?.includes("RECOMMENDED");
                    if (!isRec && recCount >= MAX_RECOMMENDED) return;
                    const newTags = isRec ? selectedDish.tags.filter((t: string) => t !== "RECOMMENDED") : [...(selectedDish.tags || []), "RECOMMENDED"];
                    await fetch(`/api/admin/dishes/${selectedDish.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: newTags, isHero: newTags.includes("RECOMMENDED") }) });
                    const updated = { ...selectedDish, tags: newTags };
                    setDishes(prev => prev.map(d => d.id === selectedDish.id ? updated : d));
                    setSelectedDish(updated);
                  }} style={{ flex: 1, padding: "14px", borderRadius: 10, border: "none", cursor: (!selectedDish.tags?.includes("RECOMMENDED") && recCount >= MAX_RECOMMENDED) ? "not-allowed" : "pointer", fontFamily: F, fontSize: "0.88rem", fontWeight: 600, background: selectedDish.tags?.includes("RECOMMENDED") ? "rgba(244,166,35,0.15)" : "var(--adm-hover)", color: selectedDish.tags?.includes("RECOMMENDED") ? "#F4A623" : "var(--adm-text2)", opacity: (!selectedDish.tags?.includes("RECOMMENDED") && recCount >= MAX_RECOMMENDED) ? 0.5 : 1 }}>
                    ⭐ {selectedDish.tags?.includes("RECOMMENDED") ? "Destacado" : "Destacar"}
                  </button>
                  <button onClick={() => startEditDish(selectedDish)} style={{ flex: 1, padding: "14px", background: "#DBEAFE", border: "none", borderRadius: 10, color: "#1E40AF", fontFamily: F, fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>
                    Editar
                  </button>
                </div>
                <button onClick={() => { toggleDishActive(selectedDish); setSelectedDish({ ...selectedDish, isActive: !selectedDish.isActive }); }} style={{ padding: "14px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.88rem", fontWeight: 600, background: selectedDish.isActive ? "rgba(255,100,100,0.1)" : "rgba(74,222,128,0.1)", color: selectedDish.isActive ? "#ff6b6b" : "#4ade80" }}>
                  {selectedDish.isActive ? "🚫 Ocultar" : "👁 Mostrar"}
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
                    <button key={d.value} onClick={() => setEDiet(d.value)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: eDiet === d.value ? "rgba(74,222,128,0.15)" : "var(--adm-hover)", color: eDiet === d.value ? "#4ade80" : "var(--adm-text2)" }}>
                      {d.icon} {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Características</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setESpicy(!eSpicy)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: eSpicy ? "rgba(232,85,48,0.15)" : "var(--adm-hover)", color: eSpicy ? "#e85530" : "var(--adm-text2)" }}>
                    🌶️ Picante
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Recomendación automática</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => setEHighMargin(!eHighMargin)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: eHighMargin ? "rgba(244,166,35,0.15)" : "var(--adm-hover)", color: eHighMargin ? "#F4A623" : "var(--adm-text2)" }}>
                    💰 Margen alto
                  </button>
                  <button onClick={() => setEFeaturedAuto(!eFeaturedAuto)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: eFeaturedAuto ? "rgba(244,166,35,0.15)" : "var(--adm-hover)", color: eFeaturedAuto ? "#F4A623" : "var(--adm-text2)" }}>
                    ⭐ Priorizar en recomendaciones
                  </button>
                </div>
                <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", marginTop: 4, lineHeight: 1.4 }}>
                  Estos platos tendrán mayor peso en las recomendaciones automáticas &ldquo;Para ti&rdquo; que ven tus clientes.
                </p>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Ingredientes ({eIngredientIds.length} seleccionados)</label>
                {/* Selected pills */}
                {eIngredientIds.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    {eIngredientIds.map(id => {
                      const ing = allIngredients.find(i => i.id === id);
                      return ing ? (
                        <span key={id} onClick={() => setEIngredientIds(prev => prev.filter(x => x !== id))} style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: 50, background: "rgba(244,166,35,0.12)", color: "#F4A623", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          {ing.name} <span style={{ fontSize: "10px", opacity: 0.6 }}>×</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                {/* Search */}
                <input
                  value={ingSearch} onChange={e => setIngSearch(e.target.value)}
                  placeholder="Buscar ingrediente..."
                  style={{ ...INP, marginBottom: 4 }}
                />
                {/* Dropdown list */}
                {ingSearch && (
                  <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--adm-card-border)", borderRadius: 8, scrollbarWidth: "none" }}>
                    {allIngredients
                      .filter(i => norm(i.name).includes(norm(ingSearch)) && !eIngredientIds.includes(i.id))
                      .slice(0, 15)
                      .map(i => (
                        <button key={i.id} onClick={() => { setEIngredientIds(prev => [...prev, i.id]); setIngSearch(""); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", width: "100%", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", cursor: "pointer", textAlign: "left" }}>
                          <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)" }}>{i.name}</span>
                          <span style={{ fontFamily: F, fontSize: "0.62rem", color: "var(--adm-text3)" }}>{i.category}</span>
                        </button>
                      ))}
                    {allIngredients.filter(i => norm(i.name).includes(norm(ingSearch)) && !eIngredientIds.includes(i.id)).length === 0 && (
                      <button onClick={async () => {
                        const res = await fetch("/api/admin/ingredients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: ingSearch }) });
                        const data = await res.json();
                        if (data.ingredient) {
                          setAllIngredients(prev => [...prev, data.ingredient]);
                          setEIngredientIds(prev => [...prev, data.ingredient.id]);
                          setIngSearch("");
                        }
                      }} style={{ padding: "8px 10px", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                        <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#F4A623" }}>+ Crear "{ingSearch}"</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Alérgenos</label>
                <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.5 }}>
                  Los alérgenos se detectan automáticamente a partir de los ingredientes del producto.
                </p>
                {eAllergens.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                    {eAllergens.map(a => (
                      <span key={a} style={{ fontSize: "0.7rem", padding: "4px 10px", borderRadius: 50, background: "#faeeda", color: "#854f0b", fontFamily: F, fontWeight: 600 }}>⚠️ {a}</span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Tags <span style={{ fontWeight: 400, color: "var(--adm-text3)", fontSize: "0.68rem" }}>({recCount + (eTags.includes("RECOMMENDED") ? 1 : 0)}/{MAX_RECOMMENDED} destacados)</span></label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TAG_OPTIONS.map(t => {
                    const disabled = t.value === "MOST_ORDERED" || t.value === "PROMOTION";
                    const atLimit = t.value === "RECOMMENDED" && !eTags.includes(t.value) && recCount >= MAX_RECOMMENDED;
                    return (
                      <button key={t.value} onClick={() => !disabled && !atLimit && toggleTag(t.value)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: disabled || atLimit ? "not-allowed" : "pointer", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, background: eTags.includes(t.value) ? `${TAG_COLORS[t.value]}20` : "var(--adm-hover)", color: disabled || atLimit ? "var(--adm-text3)" : eTags.includes(t.value) ? TAG_COLORS[t.value] : "var(--adm-text2)", opacity: disabled || atLimit ? 0.5 : 1 }}>
                        {t.label}{disabled ? " (pronto)" : ""}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", marginTop: 4, lineHeight: 1.4 }}>
                  Los platos destacados tienen mayor peso en el algoritmo que personaliza la carta para cada cliente. Aparecerán con mayor prioridad y con la etiqueta &ldquo;Recomendado por {activeRestaurant?.name || "tu local"}&rdquo; en la carta.
                </p>
                {recCount >= MAX_RECOMMENDED && !eTags.includes("RECOMMENDED") && (
                  <p style={{ fontFamily: F, fontSize: "0.68rem", color: "#e85530", margin: "6px 0 0" }}>Máximo {MAX_RECOMMENDED} destacados. Quita uno de otro plato para agregar aquí.</p>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveDishEdit} disabled={saving || !eName || !ePrice} style={{ flex: 1, padding: "10px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.5 : 1 }}>{saving ? "Guardando..." : "Guardar"}</button>
                <button onClick={() => setEditMode(false)} style={{ flex: 1, padding: "10px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Platos</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>{activeRestaurant?.name} · {filtered.length} platos</p>
        </div>
        <RestaurantPicker />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar plato..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: "10px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }}
        />
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{ padding: "10px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}
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
              background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12,
              cursor: "pointer", width: "100%", textAlign: "left", opacity: d.isActive ? 1 : 0.5,
              transition: "border-color 0.2s",
            }}
              onMouseOver={e => (e.currentTarget.style.borderColor = "rgba(244,166,35,0.3)")}
              onMouseOut={e => (e.currentTarget.style.borderColor = "var(--adm-card-border)")}
            >
              {d.photos?.[0] ? (
                <img src={d.photos[0]} alt="" onClick={(e) => { e.stopPropagation(); setPhotoModal(d.photos[0]); }} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0, cursor: "pointer" }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--adm-card-border)", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                  {d.tags.map(t => (
                    <span key={t} style={{ width: 6, height: 6, borderRadius: "50%", background: TAG_COLORS[t] || "#888", flexShrink: 0 }} />
                  ))}
                </div>
                <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", margin: 0 }}>{d.category.name}</p>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <p style={{ fontFamily: F, fontSize: "0.88rem", color: "#F4A623", margin: 0, fontWeight: 600 }}>${d.price.toLocaleString("es-CL")}</p>
                {!d.isActive && <p style={{ fontFamily: F, fontSize: "0.65rem", color: "#ff6b6b", margin: 0 }}>Inactivo</p>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text2)", textAlign: "center", padding: 40 }}>
              {dishes.length === 0 ? "Este local no tiene platos" : "No hay platos que coincidan"}
            </p>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: page <= 1 ? "transparent" : "var(--adm-hover)", color: page <= 1 ? "var(--adm-text3)" : "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", cursor: page <= 1 ? "default" : "pointer" }}>Anterior</button>
          <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", padding: "8px 12px" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: page >= totalPages ? "transparent" : "var(--adm-hover)", color: page >= totalPages ? "var(--adm-text3)" : "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", cursor: page >= totalPages ? "default" : "pointer" }}>Siguiente</button>
        </div>
      )}
      {/* Photo modal */}
      {photoModal && (
        <div onClick={() => setPhotoModal(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 20 }}>
          <img src={photoModal} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}

const LBL: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 };
const INP: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: "var(--font-display)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" };
