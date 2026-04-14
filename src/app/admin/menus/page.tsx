"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { adminFetch } from "@/lib/adminFetch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dish = any;
type Local = { id: string; nombre: string; comuna: string };
type Ingredient = { id: string; name: string; category: string };

const HUNGER_LABELS: Record<string, string> = { LIGHT: "Liviano", MEDIUM: "Normal", HEAVY: "Abundante" };
const INGREDIENT_CATS = ["PROTEIN", "VEGETABLE", "FRUIT", "DAIRY", "CARB", "SAUCE", "SPICE", "OTHER"];
const CAT_LABELS: Record<string, string> = { PROTEIN: "Proteina", VEGETABLE: "Vegetal", FRUIT: "Fruta", DAIRY: "Lacteo", CARB: "Carbohidrato", SAUCE: "Salsa", SPICE: "Especia", OTHER: "Otro" };

const DISH_CATEGORIES: { v: string; l: string }[] = [
  { v: "BREAKFAST", l: "Desayuno" }, { v: "BRUNCH", l: "Brunch" }, { v: "SALAD", l: "Ensalada" },
  { v: "SOUP", l: "Sopa" }, { v: "STARTER", l: "Entrada" }, { v: "MAIN_COURSE", l: "Plato de fondo" },
  { v: "PASTA", l: "Pasta" }, { v: "PIZZA", l: "Pizza" }, { v: "SUSHI", l: "Sushi" },
  { v: "WOK", l: "Wok" }, { v: "GRILL", l: "Carnes a la parrilla" }, { v: "SEAFOOD", l: "Mariscos" },
  { v: "VEGETARIAN", l: "Vegetariano" }, { v: "VEGAN", l: "Vegano" }, { v: "SANDWICH", l: "Sándwich" },
  { v: "BURGER", l: "Hamburguesa" }, { v: "HOT_DOG", l: "Hot dog" }, { v: "TACOS", l: "Tacos" },
  { v: "EMPANADAS", l: "Empanadas" }, { v: "SNACK", l: "Snack" }, { v: "DESSERT", l: "Postre" },
  { v: "ICE_CREAM", l: "Helado" }, { v: "JUICE", l: "Jugo" }, { v: "DRINK", l: "Bebida" },
  { v: "COFFEE", l: "Café" }, { v: "TEA", l: "Té" }, { v: "SMOOTHIE", l: "Smoothie" },
  { v: "COCKTAIL", l: "Cóctel" }, { v: "BEER", l: "Cerveza" }, { v: "WINE", l: "Vino" },
  { v: "COMBO", l: "Combo" }, { v: "DAILY_MENU", l: "Menú del día" }, { v: "SHARING", l: "Para compartir" },
  { v: "OTHER", l: "Otro" },
];
const DISH_CAT_MAP: Record<string, string> = Object.fromEntries(DISH_CATEGORIES.map(c => [c.v, c.l]));

const S = {
  card: { background: "rgba(45,26,8,0.7)", border: "1px solid rgba(232,168,76,0.15)", borderRadius: 14, padding: "16px 20px", marginBottom: 12 } as React.CSSProperties,
  input: { width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(232,168,76,0.2)", borderRadius: 8, color: "#FFFFFF", fontFamily: var(--font-display), fontSize: "0.88rem", outline: "none", boxSizing: "border-box" as const },
  label: { fontFamily: var(--font-display), fontSize: "0.75rem", color: "rgba(240,234,214,0.5)", marginBottom: 6, display: "block" as const, letterSpacing: "0.08em" },
  btn: { padding: "10px 20px", background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 10, fontFamily: var(--font-display), fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
  btnOutline: { padding: "10px 20px", background: "transparent", border: "1px solid rgba(232,168,76,0.3)", borderRadius: 10, fontFamily: var(--font-display), fontSize: "0.82rem", color: "#FFD600", cursor: "pointer" } as React.CSSProperties,
  chip: { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 12, background: "rgba(232,168,76,0.1)", border: "1px solid rgba(232,168,76,0.2)", fontFamily: var(--font-display), fontSize: "0.75rem", color: "#FFD600" } as React.CSSProperties,
};

function formatBytes(b: number) { return b < 1024 ? b + "B" : b < 1048576 ? (b / 1024).toFixed(1) + "KB" : (b / 1048576).toFixed(1) + "MB"; }

export default function AdminMenus() {
  const [busqLocal, setBusqLocal] = useState("");
  const [locales, setLocales] = useState<Local[]>([]);
  const [selLocal, setSelLocal] = useState<Local | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editDish, setEditDish] = useState<Dish | null>(null);
  const [filtroCat, setFiltroCat] = useState("");
  const allLocalesRef = useRef<Local[]>([]);

  // Load all locals once
  useEffect(() => {
    adminFetch("/api/admin/locales")
      .then(r => r.json())
      .then(d => { allLocalesRef.current = Array.isArray(d) ? d : d.locales ?? []; })
      .catch(() => {});
  }, []);

  // Filter locals client-side
  useEffect(() => {
    if (busqLocal.length < 2) { setLocales([]); return; }
    const q = busqLocal.toLowerCase();
    setLocales(allLocalesRef.current.filter(l => l.nombre.toLowerCase().includes(q)).slice(0, 8));
  }, [busqLocal]);

  const selectLocal = (l: Local) => {
    setSelLocal(l);
    setBusqLocal("");
    setLocales([]);
    loadDishes(l.id);
  };

  const loadDishes = (localId: string) => {
    setLoading(true);
    adminFetch(`/api/admin/dishes?localId=${localId}`)
      .then(r => r.json())
      .then(d => setDishes(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const toggleAvailability = async (dish: Dish) => {
    const newVal = !dish.isAvailable;
    setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, isAvailable: newVal } : d));
    await adminFetch(`/api/admin/dishes/${dish.id}/availability`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: newVal }),
    });
  };

  const deleteDish = async (id: string) => {
    if (!confirm("Eliminar este plato?")) return;
    const res = await adminFetch(`/api/admin/dishes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDishes(prev => prev.filter(d => d.id !== id));
      showToast("Plato eliminado");
    }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const onSaved = (dish: Dish) => {
    if (editDish) {
      setDishes(prev => prev.map(d => d.id === dish.id ? dish : d));
    } else {
      setDishes(prev => [dish, ...prev]);
    }
    setFormOpen(false);
    setEditDish(null);
    showToast(editDish ? "Plato actualizado" : "Plato creado");
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: var(--font-display), fontSize: "1.4rem", color: "#FFD600", marginBottom: 20 }}>Menús</h1>

      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "#3db89e", color: "#fff", padding: "10px 20px", borderRadius: 10, fontFamily: var(--font-display), fontSize: "0.85rem", zIndex: 1000 }}>{toast}</div>}

      {/* Local selector */}
      {!selLocal ? (
        <div style={S.card}>
          <label style={S.label}>Buscar local</label>
          <input style={S.input} value={busqLocal} onChange={e => setBusqLocal(e.target.value)} placeholder="Nombre del local..." />
          {locales.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {locales.map(l => (
                <div key={l.id} onClick={() => selectLocal(l)} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid rgba(232,168,76,0.08)", fontFamily: var(--font-display), fontSize: "0.88rem", color: "#FFFFFF" }}>
                  {l.nombre} <span style={{ color: "rgba(240,234,214,0.35)", fontSize: "0.78rem" }}>{l.comuna}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontFamily: var(--font-display), fontSize: "0.95rem", color: "#FFD600" }}>{selLocal.nombre}</span>
            <span style={{ color: "rgba(240,234,214,0.35)", fontSize: "0.78rem", marginLeft: 8 }}>{selLocal.comuna}</span>
          </div>
          <button onClick={() => { setSelLocal(null); setDishes([]); setFormOpen(false); setEditDish(null); }} style={S.btnOutline}>Cambiar</button>
        </div>
      )}

      {/* Dishes list */}
      {selLocal && !formOpen && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: var(--font-display), fontSize: "0.82rem", color: "rgba(240,234,214,0.4)" }}>{dishes.length} plato{dishes.length !== 1 ? "s" : ""}</span>
            <button onClick={() => { setEditDish(null); setFormOpen(true); }} style={S.btn}>+ Agregar plato</button>
          </div>

          {dishes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ ...S.input, maxWidth: 220, fontSize: "0.8rem", padding: "6px 10px" }}>
                <option value="">Todas las categorias</option>
                {DISH_CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
          )}

          {loading ? (
            <p style={{ fontFamily: var(--font-display), color: "rgba(240,234,214,0.4)", textAlign: "center", padding: 40 }}>Cargando...</p>
          ) : dishes.length === 0 ? (
            <p style={{ fontFamily: var(--font-display), color: "rgba(240,234,214,0.3)", textAlign: "center", padding: 40 }}>Sin platos. Agrega el primero.</p>
          ) : (
            dishes.filter(d => !filtroCat || d.categoria === filtroCat).map(d => (
              <div key={d.id} style={{ ...S.card, display: "flex", gap: 14, alignItems: "center" }}>
                {d.imagenUrl ? (
                  <img src={d.imagenUrl} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 10, background: "rgba(232,168,76,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🍽️</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: var(--font-display), fontSize: "0.92rem", color: "#FFD600", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</p>
                  <p style={{ fontFamily: var(--font-display), fontSize: "0.78rem", color: "rgba(240,234,214,0.4)", margin: "2px 0 0" }}>
                    {DISH_CAT_MAP[d.categoria] ?? d.categoria} · ${Number(d.precio).toLocaleString("es-CL")}
                    {d.hungerLevel && ` · ${HUNGER_LABELS[d.hungerLevel] ?? d.hungerLevel}`}
                  </p>
                  {d.ingredientTags?.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                      {d.ingredientTags.slice(0, 5).map((t: any) => (
                        <span key={t.id} style={{ ...S.chip, padding: "2px 6px", fontSize: "0.68rem" }}>{t.ingredient.name}</span>
                      ))}
                      {d.ingredientTags.length > 5 && <span style={{ ...S.chip, padding: "2px 6px", fontSize: "0.68rem", color: "rgba(240,234,214,0.3)" }}>+{d.ingredientTags.length - 5}</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  {/* Availability toggle */}
                  <button onClick={() => toggleAvailability(d)} title={d.isAvailable ? "Disponible" : "No disponible"} style={{ width: 36, height: 20, borderRadius: 10, border: "none", background: d.isAvailable ? "#3db89e" : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: d.isAvailable ? 18 : 2, transition: "left 0.15s" }} />
                  </button>
                  <button onClick={() => { setEditDish(d); setFormOpen(true); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✏️</button>
                  <button onClick={() => deleteDish(d.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>🗑️</button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Form */}
      {selLocal && formOpen && (
        <DishForm
          localId={selLocal.id}
          dish={editDish}
          onSaved={onSaved}
          onCancel={() => { setFormOpen(false); setEditDish(null); }}
        />
      )}
    </div>
  );
}

// ─── DishForm ───────────────────────────────────────────────────────────────

function DishForm({ localId, dish, onSaved, onCancel }: { localId: string; dish: Dish | null; onSaved: (d: Dish) => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState(dish?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(dish?.descripcion ?? "");
  const [precio, setPrecio] = useState(dish?.precio?.toString() ?? "");
  const [destacado, setDestacado] = useState(dish?.destacado ?? false);
  const [hungerLevel, setHungerLevel] = useState(dish?.hungerLevel ?? "");
  const [availableFrom, setAvailableFrom] = useState(dish?.availableFrom ?? "");
  const [availableTo, setAvailableTo] = useState(dish?.availableTo ?? "");
  const [imagenUrl, setImagenUrl] = useState(dish?.imagenUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [inferredCat, setInferredCat] = useState(dish?.categoria ?? "MAIN_COURSE");

  // Image upload
  const [uploading, setUploading] = useState(false);
  const [imgSizes, setImgSizes] = useState<{ original: number; optimized: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Ingredients
  const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>(
    dish?.ingredientTags?.map((t: any) => t.ingredient) ?? []
  );
  const [ingQuery, setIngQuery] = useState("");
  const [ingResults, setIngResults] = useState<Ingredient[]>([]);
  const [newIngName, setNewIngName] = useState("");
  const [newIngCat, setNewIngCat] = useState("OTHER");
  const [showNewIng, setShowNewIng] = useState(false);

  // Infer category when ingredients change
  useEffect(() => {
    if (selectedIngredients.length === 0) { setInferredCat("MAIN_COURSE"); return; }
    const names = selectedIngredients.map(i => i.name);
    const { inferCategory } = require("@/lib/dish-utils");
    setInferredCat(inferCategory(names, Number(precio) || undefined));
  }, [selectedIngredients, precio]);

  // Search ingredients
  useEffect(() => {
    if (ingQuery.length < 2) { setIngResults([]); return; }
    const t = setTimeout(() => {
      adminFetch(`/api/admin/ingredients?q=${encodeURIComponent(ingQuery)}`)
        .then(r => r.json())
        .then(d => setIngResults(Array.isArray(d) ? d.filter(i => !selectedIngredients.some(s => s.id === i.id)) : []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [ingQuery, selectedIngredients]);

  const addIngredient = (ing: Ingredient) => {
    setSelectedIngredients(prev => [...prev, ing]);
    setIngQuery("");
    setIngResults([]);
  };

  const removeIngredient = (id: string) => {
    setSelectedIngredients(prev => prev.filter(i => i.id !== id));
  };

  const createIngredient = async () => {
    if (!newIngName.trim()) return;
    const res = await adminFetch("/api/admin/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newIngName.trim(), category: newIngCat }),
    });
    if (res.ok) {
      const ing = await res.json();
      addIngredient(ing);
      setNewIngName("");
      setShowNewIng(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImgSizes(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("localId", localId);
    fd.append("dishName", nombre || "plato");

    try {
      const res = await adminFetch("/api/admin/upload-dish-image", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setImagenUrl(data.url);
        setImgSizes({ original: data.originalSize, optimized: data.optimizedSize });
      } else {
        const err = await res.json();
        setError(err.error ?? "Error al subir imagen");
      }
    } catch { setError("Error de conexion al subir imagen"); }
    setUploading(false);
  };

  const canSave = imagenUrl && nombre.trim() && precio && selectedIngredients.length > 0 && hungerLevel;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");

    const body = {
      localId,
      nombre: nombre.trim(),
      categoria: inferredCat,
      descripcion: descripcion.trim(),
      precio: Number(precio),
      imagenUrl,
      destacado,
      hungerLevel: hungerLevel || null,
      isAvailable: true,
      availableFrom: availableFrom || null,
      availableTo: availableTo || null,
      ingredients: selectedIngredients.map(i => i.name),
      ingredientIds: selectedIngredients.map(i => i.id),
    };

    try {
      const url = dish ? `/api/admin/dishes/${dish.id}` : "/api/admin/dishes";
      const method = dish ? "PUT" : "POST";
      const res = await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const saved = await res.json();
        onSaved(saved);
      } else {
        const err = await res.json();
        setError(err.error ?? "Error al guardar");
      }
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  const hungerBtn = (val: string, emoji: string, label: string) => {
    const active = hungerLevel === val;
    return (
      <button key={val} onClick={() => setHungerLevel(val)} style={{ flex: 1, padding: "12px 8px", background: active ? "rgba(232,168,76,0.15)" : "rgba(255,255,255,0.03)", border: active ? "1px solid #FFD600" : "1px solid rgba(255,255,255,0.08)", borderRadius: 10, cursor: "pointer", textAlign: "center" }}>
        <span style={{ fontSize: 20, display: "block", marginBottom: 2 }}>{emoji}</span>
        <span style={{ fontFamily: var(--font-display), fontSize: "0.72rem", color: active ? "#FFD600" : "rgba(240,234,214,0.5)" }}>{label}</span>
      </button>
    );
  };

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: var(--font-display), fontSize: "1rem", color: "#FFD600", margin: 0 }}>{dish ? "Editar plato" : "Nuevo plato"}</h2>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "rgba(240,234,214,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      {error && <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}><p style={{ fontFamily: var(--font-display), fontSize: "0.82rem", color: "#ff6b6b", margin: 0 }}>{error}</p></div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* 1. Foto */}
        <div>
          <label style={S.label}>Foto *</label>
          {imagenUrl ? (
            <div style={{ position: "relative", marginBottom: 8 }}>
              <img src={imagenUrl} alt="" style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 12 }} />
              <button onClick={() => fileRef.current?.click()} style={{ position: "absolute", bottom: 8, right: 8, ...S.btnOutline, padding: "6px 12px", fontSize: "0.72rem", background: "rgba(0,0,0,0.6)" }}>Cambiar</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: "100%", height: 140, background: "rgba(232,168,76,0.04)", border: "2px dashed rgba(232,168,76,0.2)", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 28 }}>{uploading ? "⏳" : "📷"}</span>
              <span style={{ fontFamily: var(--font-display), fontSize: "0.82rem", color: "rgba(240,234,214,0.4)" }}>{uploading ? "Subiendo..." : "Subir foto del plato"}</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} style={{ display: "none" }} />
          {imgSizes && (
            <p style={{ fontFamily: var(--font-display), fontSize: "0.72rem", color: "#3db89e", marginTop: 4 }}>
              {formatBytes(imgSizes.original)} → {formatBytes(imgSizes.optimized)}
            </p>
          )}
        </div>

        {/* 2. Nombre */}
        <div>
          <label style={S.label}>Nombre *</label>
          <input style={S.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Pad Thai de camarones" />
        </div>

        {/* 3. Precio */}
        <div>
          <label style={S.label}>Precio (CLP) *</label>
          <input style={S.input} type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="8990" />
        </div>

        {/* 4. Ingredientes + categoria inferida */}
        <div>
          <label style={S.label}>Ingredientes *</label>
          {selectedIngredients.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {selectedIngredients.map(ing => (
                <span key={ing.id} style={S.chip}>
                  {ing.name}
                  <button onClick={() => removeIngredient(ing.id)} style={{ background: "none", border: "none", color: "#ff6b6b", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
          )}
          <input style={S.input} value={ingQuery} onChange={e => setIngQuery(e.target.value)} placeholder="Buscar ingrediente..." />
          {ingResults.length > 0 && (
            <div style={{ border: "1px solid rgba(232,168,76,0.15)", borderRadius: 8, marginTop: 4, maxHeight: 150, overflowY: "auto" }}>
              {ingResults.map(i => (
                <div key={i.id} onClick={() => addIngredient(i)} style={{ padding: "8px 12px", cursor: "pointer", fontFamily: var(--font-display), fontSize: "0.82rem", color: "#FFFFFF", borderBottom: "1px solid rgba(232,168,76,0.06)" }}>
                  {i.name} <span style={{ color: "rgba(240,234,214,0.3)", fontSize: "0.72rem" }}>{CAT_LABELS[i.category] ?? i.category}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <button onClick={() => setShowNewIng(!showNewIng)} style={{ ...S.btnOutline, fontSize: "0.72rem", padding: "5px 10px" }}>+ Nuevo</button>
            {selectedIngredients.length > 0 && (
              <span style={{ padding: "4px 10px", borderRadius: 10, background: "rgba(61,184,158,0.08)", border: "1px solid rgba(61,184,158,0.2)", fontFamily: var(--font-display), fontSize: "0.7rem", color: "#3db89e" }}>
                Categoria: {DISH_CAT_MAP[inferredCat] ?? inferredCat}
              </span>
            )}
          </div>
          {showNewIng && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input style={{ ...S.input, flex: 2 }} value={newIngName} onChange={e => setNewIngName(e.target.value)} placeholder="Nombre" />
              <select style={{ ...S.input, flex: 1 }} value={newIngCat} onChange={e => setNewIngCat(e.target.value)}>
                {INGREDIENT_CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
              <button onClick={createIngredient} style={{ ...S.btn, padding: "8px 14px" }}>Crear</button>
            </div>
          )}
        </div>

        {/* 5. Hunger level - 3 big buttons */}
        <div>
          <label style={S.label}>Porcion *</label>
          <div style={{ display: "flex", gap: 8 }}>
            {hungerBtn("LIGHT", "🥗", "Liviano")}
            {hungerBtn("MEDIUM", "🍽️", "Normal")}
            {hungerBtn("HEAVY", "🍖", "Abundante")}
          </div>
        </div>

        {/* 6. More details (collapsed) */}
        <button onClick={() => setShowMore(!showMore)} style={{ background: "none", border: "none", fontFamily: var(--font-display), fontSize: "0.78rem", color: "rgba(240,234,214,0.35)", cursor: "pointer", textAlign: "left", padding: 0 }}>
          {showMore ? "Menos detalles −" : "Mas detalles +"}
        </button>
        {showMore && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
            <div>
              <label style={S.label}>Descripcion</label>
              <textarea style={{ ...S.input, resize: "vertical", minHeight: 60 }} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripcion del plato (opcional)" />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Disponible desde</label>
                <input style={S.input} type="time" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Hasta</label>
                <input style={S.input} type="time" value={availableTo} onChange={e => setAvailableTo(e.target.value)} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: var(--font-display), fontSize: "0.82rem", color: "#FFFFFF", cursor: "pointer" }}>
              <input type="checkbox" checked={destacado} onChange={e => setDestacado(e.target.checked)} /> Destacado
            </label>
          </div>
        )}

        {/* Save */}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={{ ...S.btnOutline, flex: 1 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !canSave} style={{ ...S.btn, flex: 2, opacity: (saving || !canSave) ? 0.4 : 1 }}>
            {saving ? "Guardando..." : dish ? "Guardar cambios" : "Crear plato"}
          </button>
        </div>
      </div>
    </div>
  );
}
