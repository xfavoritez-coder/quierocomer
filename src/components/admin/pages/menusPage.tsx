"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import RestaurantPicker from "@/lib/admin/RestaurantPicker";
import ModifierTemplatesTab from "@/components/admin/ModifierTemplatesTab";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

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
  const [menuTab, setMenuTab] = useState<"platos" | "categorias" | "modificadores">("platos");

  // Category management
  const [catMgmtOpen, setCatMgmtOpen] = useState(false);
  const [fullCategories, setFullCategories] = useState<(Category & { _count?: { dishes: number } })[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  // Create new dish
  const [creatingDish, setCreatingDish] = useState(false);
  const [newDishName, setNewDishName] = useState("");
  const [newDishPrice, setNewDishPrice] = useState("");
  const [newDishDesc, setNewDishDesc] = useState("");
  const [newDishCatId, setNewDishCatId] = useState("");
  const [dishSaving, setDishSaving] = useState(false);

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

  // Fetch full categories when tab is active or management panel opens
  useEffect(() => {
    if (menuTab !== "categorias" || !selectedRestaurantId) return;
    fetch(`/api/admin/categories?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setFullCategories(d); })
      .catch(() => {});
  }, [menuTab, selectedRestaurantId]);

  const createCategory = async () => {
    if (!newCatName.trim() || !selectedRestaurantId) return;
    setCatSaving(true);
    const res = await fetch("/api/admin/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: selectedRestaurantId, name: newCatName.trim() }),
    });
    const cat = await res.json();
    if (!res.ok) { setCatSaving(false); return; }
    setFullCategories(prev => [...prev, { ...cat, _count: { dishes: 0 } }]);
    setNewCatName("");
    setCatSaving(false);
  };

  const updateCategory = async (id: string, data: Record<string, any>) => {
    setCatSaving(true);
    await fetch("/api/admin/categories", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    setFullCategories(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    setEditingCat(null);
    setCatSaving(false);
    // Refresh dishes to update category names
    if (data.name) {
      setDishes(prev => prev.map(d => d.categoryId === id ? { ...d, category: { ...d.category, name: data.name } } : d));
    }
  };

  const deleteCategory = async (id: string) => {
    const cat = fullCategories.find(c => c.id === id);
    if (cat?._count?.dishes && cat._count.dishes > 0) return;
    const res = await fetch("/api/admin/categories", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setFullCategories(prev => prev.filter(c => c.id !== id));
  };

  const filtered = useMemo(() => {
    let list = dishes;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.ingredients?.toLowerCase().includes(q));
    }
    if (catFilter !== "all") list = list.filter(d => d.categoryId === catFilter);
    // Recommended first
    return [...list].sort((a, b) => {
      const aRec = a.tags?.includes("RECOMMENDED") ? 0 : 1;
      const bRec = b.tags?.includes("RECOMMENDED") ? 0 : 1;
      return aRec - bRec;
    });
  }, [dishes, search, catFilter]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, catFilter, selectedRestaurantId]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const createDish = async () => {
    if (!newDishName.trim() || !newDishPrice || !newDishCatId || !selectedRestaurantId) return;
    setDishSaving(true);
    try {
      const res = await fetch("/api/admin/dishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurantId,
          categoryId: newDishCatId,
          name: newDishName.trim(),
          price: Number(newDishPrice),
          description: newDishDesc.trim() || null,
        }),
      });
      const dish = await res.json();
      if (res.ok) {
        setDishes(prev => [...prev, dish]);
        setNewDishName("");
        setNewDishPrice("");
        setNewDishDesc("");
        setCreatingDish(false);
      }
    } catch {}
    setDishSaving(false);
  };

  const toggleDishActive = async (dish: Dish) => {
    await fetch(`/api/admin/dishes/${dish.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !dish.isActive }) });
    setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, isActive: !d.isActive } : d));
  };

  if (sessionLoading) return <SkeletonLoading type="list" />;

  if (!selectedRestaurantId) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ color: "var(--adm-text2)", fontFamily: F, fontSize: "0.92rem" }}>Selecciona un local en el sidebar para ver su menu</p>
    </div>
  );

  // Edit state (must be at top level, not inside conditional)
  const [editMode, setEditMode] = useState(false);
  const [eName, setEName] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eDiscountPrice, setEDiscountPrice] = useState("");
  const [eIngredients, setEIngredients] = useState("");
  const [eIngredientIds, setEIngredientIds] = useState<string[]>([]);
  const [allIngredients, setAllIngredients] = useState<{ id: string; name: string; category: string; isAllergen: boolean }[]>([]);
  const [ingSearch, setIngSearch] = useState("");
  const [eAllergens, setEAllergens] = useState<string[]>([]);
  const [eTags, setETags] = useState<string[]>([]);
  const [eIsHero, setEIsHero] = useState(false);
  const [eDiet, setEDiet] = useState("OMNIVORE");
  const [eSpicy, setESpicy] = useState(false);
  const [eCategoryId, setECategoryId] = useState("");
  const [ingListOpen, setIngListOpen] = useState(false);
  const [ePhotoUrl, setEPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<{ id: string; name: string }[]>([]);
  const [assignedTemplateIds, setAssignedTemplateIds] = useState<string[]>([]);
  const [modPickerOpen, setModPickerOpen] = useState(false);
  const [modSearch, setModSearch] = useState("");
  const ingRef = useRef<HTMLDivElement>(null);

  // Load templates when a dish is selected (not just in edit mode)
  useEffect(() => {
    if (!selectedDish || !selectedRestaurantId) return;
    setAssignedTemplateIds(((selectedDish as any).modifierTemplates || []).map((t: any) => t.id));
    setModPickerOpen(false);
    fetch(`/api/admin/modifier-templates?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAvailableTemplates(d.map((t: any) => ({ id: t.id, name: t.name }))); })
      .catch(() => {});
  }, [selectedDish?.id, selectedRestaurantId]);

  // Close ingredient list on click outside
  useEffect(() => {
    if (!ingListOpen) return;
    const handler = (e: MouseEvent) => {
      if (ingRef.current && !ingRef.current.contains(e.target as Node)) {
        setIngListOpen(false);
        setIngSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ingListOpen]);

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
    { value: "OMNIVORE", label: "Carnívoro", icon: "🍖" },
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
    setECategoryId(d.categoryId);
    setEPhotoUrl(d.photos?.[0] || "");
    setIngSearch("");
    setIngListOpen(false);
    setAssignedTemplateIds(((d as any).modifierTemplates || []).map((t: any) => t.id));
    // Load templates + ingredients
    if (selectedRestaurantId) {
      fetch(`/api/admin/modifier-templates?restaurantId=${selectedRestaurantId}`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setAvailableTemplates(d.map((t: any) => ({ id: t.id, name: t.name }))); })
        .catch(() => {});
    }
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
    const updates: Record<string, any> = {
      name: eName,
      description: eDesc || null,
      price: Number(ePrice),
      discountPrice: eDiscountPrice ? Number(eDiscountPrice) : null,
      photos: ePhotoUrl ? [ePhotoUrl] : [],
      ingredients: eIngredients || null,
      allergens: eAllergens.filter(a => a !== "ninguno").join(", ") || null,
      tags: eTags,
      isHero: eTags.includes("RECOMMENDED"),
      dishDiet: eDiet,
      isSpicy: eSpicy,
      ingredientIds: eIngredientIds,
    };
    if (eCategoryId !== selectedDish.categoryId) {
      updates.categoryId = eCategoryId;
    }
    const res = await fetch(`/api/admin/dishes/${selectedDish.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const saved = await res.json();
    const newCat = categories.find(c => c.id === eCategoryId) || selectedDish.category;
    const updated = { ...selectedDish, ...updates, allergens: updates.allergens, tags: eTags as any, categoryId: eCategoryId, category: { id: newCat.id, name: newCat.name } };
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
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, overflow: "hidden" }}>
        {selectedDish.photos?.[0] && (
          <div style={{ height: 200, position: "relative", overflow: "hidden" }}>
            <img src={selectedDish.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {selectedDish.isHero && <span style={{ position: "absolute", top: 10, right: 10, background: "#F4A623", color: "white", fontSize: "0.65rem", fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>HERO</span>}
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

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => startEditDish(selectedDish)} style={{ flex: 1, padding: "10px", background: "rgba(127,191,220,0.1)", border: "1px solid rgba(127,191,220,0.2)", borderRadius: 10, color: "#7fbfdc", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>Editar</button>
                <button onClick={() => { toggleDishActive(selectedDish); setSelectedDish({ ...selectedDish, isActive: !selectedDish.isActive }); }} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, background: selectedDish.isActive ? "rgba(255,100,100,0.1)" : "rgba(74,222,128,0.1)", color: selectedDish.isActive ? "#ff6b6b" : "#4ade80" }}>
                  {selectedDish.isActive ? "Desactivar" : "Activar"}
                </button>
              </div>

              {/* Modifier templates — pills + assign button */}
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 8px" }}>Modificadores</h3>
                {/* Assigned pills with remove */}
                {assignedTemplateIds.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {assignedTemplateIds.map(id => {
                      const t = availableTemplates.find(at => at.id === id);
                      if (!t) return null;
                      return (
                        <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 50, background: "rgba(244,166,35,0.12)", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: "#F4A623" }}>
                          {t.name}
                          <span onClick={async () => {
                            await fetch("/api/admin/modifier-templates", {
                              method: "PUT", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ templateId: id, unassignDishId: selectedDish.id }),
                            });
                            const newIds = assignedTemplateIds.filter(x => x !== id);
                            setAssignedTemplateIds(newIds);
                            const newTemplates = newIds.map(x => availableTemplates.find(at => at.id === x)).filter(Boolean);
                            const updatedDish = { ...selectedDish, modifierTemplates: newTemplates } as any;
                            setSelectedDish(updatedDish);
                            setDishes(prev => prev.map(d => d.id === selectedDish.id ? updatedDish : d));
                          }} style={{ cursor: "pointer", fontSize: "0.68rem", opacity: 0.6, marginLeft: 2 }}>×</span>
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* Assign button + dropdown */}
                {availableTemplates.length > 0 ? (
                  <div style={{ position: "relative" }}>
                    <button onClick={() => { setModPickerOpen(!modPickerOpen); setModSearch(""); }} style={{ padding: "7px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", cursor: "pointer" }}>
                      + Asignar modificador
                    </button>
                    {modPickerOpen && (
                      <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 10, width: 260, overflow: "hidden" }}>
                        <input
                          value={modSearch} onChange={e => setModSearch(e.target.value)}
                          placeholder="Buscar plantilla..."
                          style={{ width: "100%", padding: "10px 12px", border: "none", borderBottom: "1px solid var(--adm-card-border)", background: "transparent", fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box" }}
                          autoFocus
                        />
                        <div style={{ maxHeight: 180, overflowY: "auto" }}>
                          {availableTemplates
                            .filter(t => !assignedTemplateIds.includes(t.id) && (!modSearch || t.name.toLowerCase().includes(modSearch.toLowerCase())))
                            .map(t => (
                              <button key={t.id} onClick={async () => {
                                await fetch("/api/admin/modifier-templates", {
                                  method: "PUT", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ templateId: t.id, assignDishId: selectedDish.id }),
                                });
                                const newIds = [...assignedTemplateIds, t.id];
                                setAssignedTemplateIds(newIds);
                                const newTemplates = newIds.map(x => availableTemplates.find(at => at.id === x)).filter(Boolean);
                                const updatedDish = { ...selectedDish, modifierTemplates: newTemplates } as any;
                                setSelectedDish(updatedDish);
                                setDishes(prev => prev.map(d => d.id === selectedDish.id ? updatedDish : d));
                                setModPickerOpen(false);
                              }} style={{ display: "block", width: "100%", padding: "10px 12px", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", textAlign: "left", cursor: "pointer", fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)" }}>
                                {t.name}
                              </button>
                            ))}
                          {availableTemplates.filter(t => !assignedTemplateIds.includes(t.id) && (!modSearch || t.name.toLowerCase().includes(modSearch.toLowerCase()))).length === 0 && (
                            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text3)", textAlign: "center", padding: 14, margin: 0 }}>
                              {assignedTemplateIds.length === availableTemplates.length ? "Todas asignadas" : "Sin resultados"}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0 }}>
                    Crea plantillas en <button onClick={() => { setSelectedDish(null); setMenuTab("modificadores"); }} style={{ background: "none", border: "none", color: "#F4A623", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", padding: 0 }}>Modificadores</button>
                  </p>
                )}
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
                <label style={LBL}>Foto</label>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {ePhotoUrl && <img src={ePhotoUrl} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
                  <label style={{ flex: 1, padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, textAlign: "center", cursor: "pointer", fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)" }}>
                    {photoUploading ? "Subiendo..." : ePhotoUrl ? "Cambiar foto" : "Subir foto"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPhotoUploading(true);
                      const fd = new FormData();
                      fd.append("file", file);
                      fd.append("localId", selectedRestaurantId || "");
                      fd.append("dishName", eName);
                      const res = await fetch("/api/admin/upload-dish-image", { method: "POST", body: fd });
                      const data = await res.json();
                      if (data.url) setEPhotoUrl(data.url);
                      setPhotoUploading(false);
                    }} />
                  </label>
                  {ePhotoUrl && <button onClick={() => setEPhotoUrl("")} style={{ padding: "6px 10px", background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.72rem", color: "#ef4444", cursor: "pointer" }}>Quitar</button>}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Categoría</label>
                <select value={eCategoryId} onChange={e => setECategoryId(e.target.value)} style={{ ...INP, cursor: "pointer" }}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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

              <div ref={ingRef} style={{ marginBottom: 14 }}>
                <label style={LBL}>Ingredientes ({eIngredientIds.length} seleccionados)</label>
                {/* Selected pills */}
                {eIngredientIds.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    {eIngredientIds.map(id => {
                      const ing = allIngredients.find(i => i.id === id);
                      return ing ? (
                        <span key={id} onClick={() => setEIngredientIds(prev => prev.filter(x => x !== id))} style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: 50, background: "rgba(244,166,35,0.12)", color: "#F4A623", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          {ing.isAllergen ? "⚠️ " : ""}{ing.name} <span style={{ fontSize: "10px", opacity: 0.6 }}>×</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                {/* Filter input */}
                <input
                  value={ingSearch}
                  onChange={e => { setIngSearch(e.target.value); setIngListOpen(true); }}
                  onFocus={() => setIngListOpen(true)}
                  placeholder="Filtrar ingredientes..."
                  style={{ ...INP, marginBottom: 4 }}
                />
                {/* Filterable ingredient list — always visible when open */}
                {ingListOpen && (
                  <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--adm-card-border)", borderRadius: 8, scrollbarWidth: "thin" }}>
                    {(() => {
                      const filteredIngs = allIngredients
                        .filter(i => (!ingSearch || i.name.toLowerCase().includes(ingSearch.toLowerCase())) && !eIngredientIds.includes(i.id));
                      return (
                        <>
                          {filteredIngs.slice(0, 30).map(i => (
                            <button key={i.id} onClick={() => { setEIngredientIds(prev => [...prev, i.id]); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", width: "100%", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", cursor: "pointer", textAlign: "left" }}>
                              <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)" }}>{i.name}</span>
                              <span style={{ fontFamily: F, fontSize: "0.62rem", color: "var(--adm-text3)" }}>{i.category}</span>
                              {i.isAllergen && <span style={{ fontSize: "0.6rem", color: "#e85530" }}>⚠️</span>}
                            </button>
                          ))}
                          {filteredIngs.length === 0 && ingSearch && (
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
                          {filteredIngs.length === 0 && !ingSearch && (
                            <p style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text3)", textAlign: "center", padding: 12, margin: 0 }}>Todos los ingredientes ya están seleccionados</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Alérgenos</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ALLERGEN_OPTIONS.map(a => (
                    <button key={a} onClick={() => toggleAllergen(a)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, background: eAllergens.includes(a) ? "rgba(232,85,48,0.15)" : "var(--adm-hover)", color: eAllergens.includes(a) ? "#e85530" : "var(--adm-text2)" }}>
                      {eAllergens.includes(a) ? "⚠️ " : ""}{a}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Modificadores</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {availableTemplates.map(t => {
                    const assigned = assignedTemplateIds.includes(t.id);
                    return (
                      <button key={t.id} onClick={async () => {
                        const action = assigned ? "unassignDishId" : "assignDishId";
                        await fetch("/api/admin/modifier-templates", {
                          method: "PUT", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ templateId: t.id, [action]: selectedDish!.id }),
                        });
                        setAssignedTemplateIds(prev => assigned ? prev.filter(id => id !== t.id) : [...prev, t.id]);
                      }} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: assigned ? "rgba(244,166,35,0.15)" : "var(--adm-hover)", color: assigned ? "#F4A623" : "var(--adm-text2)" }}>
                        {assigned ? "✓ " : ""}{t.name}
                      </button>
                    );
                  })}
                  {availableTemplates.length === 0 && (
                    <p style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text3)", margin: 0 }}>Crea plantillas en la pestaña "Modificadores"</p>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Tags</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TAG_OPTIONS.map(t => {
                    const disabled = t.value === "MOST_ORDERED" || t.value === "PROMOTION";
                    const active = eTags.includes(t.value);
                    return (
                      <button key={t.value} onClick={() => !disabled && toggleTag(t.value)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, background: active ? `${TAG_COLORS[t.value]}20` : "var(--adm-hover)", color: disabled ? "var(--adm-text3)" : active ? TAG_COLORS[t.value] : "var(--adm-text2)", opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {t.value === "RECOMMENDED" && <span style={{ fontSize: "0.7rem", opacity: active ? 1 : 0.4 }}>★</span>}
                        {t.label}{disabled ? " (pronto)" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveDishEdit} disabled={saving || !eName || !ePrice} style={{ flex: 1, padding: "10px", background: "#F4A623", color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.5 : 1 }}>{saving ? "Guardando..." : "Guardar"}</button>
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
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Mi Carta</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>Administra los platos y categorías de {activeRestaurant?.name} · {filtered.length} platos</p>
        </div>
        <RestaurantPicker />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--adm-hover)", borderRadius: 10, padding: 3 }}>
        {([
          { key: "platos" as const, label: "Platos" },
          { key: "categorias" as const, label: "Categorías" },
          { key: "modificadores" as const, label: "Modificadores" },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setMenuTab(tab.key)} style={{
            flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600,
            background: menuTab === tab.key ? "white" : "transparent",
            color: menuTab === tab.key ? "#F4A623" : "var(--adm-text3)",
            boxShadow: menuTab === tab.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>{tab.label}</button>
        ))}
      </div>

      {menuTab === "platos" && (<>
      {!creatingDish && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={() => { setCreatingDish(true); setNewDishCatId(categories[0]?.id || ""); }} style={{ padding: "10px 18px", background: "#F4A623", color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Nuevo plato</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: creatingDish ? 10 : 20, flexWrap: "wrap" }}>
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

      {/* Create dish form */}
      {creatingDish && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 12px" }}>Nuevo plato</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Nombre *</label>
              <input value={newDishName} onChange={e => setNewDishName(e.target.value)} placeholder="Ej: Roll de Salmón" style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} autoFocus />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Precio *</label>
                <input type="number" value={newDishPrice} onChange={e => setNewDishPrice(e.target.value)} placeholder="5990" style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Categoría *</label>
                <select value={newDishCatId} onChange={e => setNewDishCatId(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Descripción</label>
              <textarea value={newDishDesc} onChange={e => setNewDishDesc(e.target.value)} placeholder="Opcional" rows={2} style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none", boxSizing: "border-box", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createDish} disabled={dishSaving || !newDishName.trim() || !newDishPrice || !newDishCatId} style={{ flex: 1, padding: "10px", background: "#F4A623", color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: (!newDishName.trim() || !newDishPrice) ? 0.5 : 1 }}>{dishSaving ? "Creando..." : "Crear plato"}</button>
              <button onClick={() => { setCreatingDish(false); setNewDishName(""); setNewDishPrice(""); setNewDishDesc(""); }} style={{ padding: "10px 16px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonLoading type="list" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {paginated.map(d => {
            const isRec = d.tags?.includes("RECOMMENDED");
            return (
            <button key={d.id} onClick={() => setSelectedDish(d)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              background: isRec ? "rgba(244,166,35,0.03)" : "var(--adm-card)",
              border: isRec ? "1.5px solid rgba(244,166,35,0.3)" : "1px solid var(--adm-card-border)",
              borderRadius: 12,
              cursor: "pointer", width: "100%", textAlign: "left", opacity: d.isActive ? 1 : 0.5,
              transition: "border-color 0.2s",
            }}
              onMouseOver={e => (e.currentTarget.style.borderColor = "rgba(244,166,35,0.4)")}
              onMouseOut={e => (e.currentTarget.style.borderColor = isRec ? "rgba(244,166,35,0.3)" : "var(--adm-card-border)")}
            >
              {d.photos?.[0] ? (
                <img src={d.photos[0]} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--adm-card-border)", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                  {isRec && <span style={{ fontSize: "0.7rem", color: "#F4A623", flexShrink: 0 }}>★</span>}
                  {d.tags.filter(t => t !== "RECOMMENDED").map(t => (
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
            );
          })}
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
      </>)}

      {/* ── Categorías tab ── */}
      {menuTab === "categorias" && (
        <div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 16px", lineHeight: 1.5 }}>
            Crea, edita o elimina las secciones de tu carta. Los platos se organizan dentro de estas categorías.
          </p>

          {/* Inline create */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Nombre de la nueva categoría..."
              onKeyDown={e => e.key === "Enter" && createCategory()}
              style={{ flex: 1, padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }}
            />
            <button onClick={createCategory} disabled={catSaving || !newCatName.trim()} style={{ padding: "10px 18px", background: "#F4A623", color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: !newCatName.trim() ? 0.5 : 1 }}>
              + Crear
            </button>
          </div>

          {/* Categories list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fullCategories.map(cat => (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: cat.isActive ? "var(--adm-card)" : "rgba(0,0,0,0.02)", borderRadius: 12, border: "1px solid var(--adm-card-border)" }}>
                {editingCat === cat.id ? (
                  <>
                    <input
                      value={editCatName}
                      onChange={e => setEditCatName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && updateCategory(cat.id, { name: editCatName })}
                      style={{ flex: 1, padding: "8px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }}
                      autoFocus
                    />
                    <button onClick={() => updateCategory(cat.id, { name: editCatName })} disabled={catSaving} style={{ padding: "6px 14px", background: "#F4A623", color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
                    <button onClick={() => setEditingCat(null)} style={{ padding: "6px 14px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", cursor: "pointer" }}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontFamily: F, fontSize: "0.88rem", color: cat.isActive ? "var(--adm-text)" : "var(--adm-text3)", fontWeight: 600 }}>
                      {cat.name}
                      <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--adm-text3)", marginLeft: 10 }}>
                        {cat._count?.dishes ?? 0} plato{(cat._count?.dishes ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </span>
                    <button onClick={() => { setEditingCat(cat.id); setEditCatName(cat.name); }} style={{ padding: "6px 12px", background: "rgba(127,191,220,0.1)", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", color: "#7fbfdc", cursor: "pointer", fontWeight: 600 }}>Editar</button>
                    <button onClick={() => updateCategory(cat.id, { isActive: !cat.isActive })} style={{ padding: "6px 12px", background: cat.isActive ? "rgba(255,100,100,0.08)" : "rgba(74,222,128,0.08)", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", color: cat.isActive ? "#ff6b6b" : "#4ade80", cursor: "pointer", fontWeight: 600 }}>
                      {cat.isActive ? "Ocultar" : "Mostrar"}
                    </button>
                    {(cat._count?.dishes ?? 0) === 0 && (
                      <button onClick={() => deleteCategory(cat.id)} style={{ padding: "6px 12px", background: "rgba(255,100,100,0.08)", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", color: "#ff6b6b", cursor: "pointer", fontWeight: 600 }}>Eliminar</button>
                    )}
                  </>
                )}
              </div>
            ))}
            {fullCategories.length === 0 && (
              <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text3)", textAlign: "center", padding: 32 }}>No hay categorías. Crea la primera arriba.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Modificadores tab ── */}
      {menuTab === "modificadores" && selectedRestaurantId && (
        <ModifierTemplatesTab restaurantId={selectedRestaurantId} />
      )}
    </div>
  );
}

const LBL: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 };
const INP: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: "var(--font-display)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" };
