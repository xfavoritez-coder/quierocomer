"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import RestaurantPicker from "@/lib/admin/RestaurantPicker";
import ModifierTemplatesTab from "@/components/admin/ModifierTemplatesTab";
import CategoriesManager from "@/components/admin/CategoriesManager";
import HappyHoursTab from "@/components/admin/HappyHoursTab";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
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

/* ── Inline modifier preview (read-only, used inside dish editMode) ── */
interface IMEOption { id: string; name: string; priceAdjustment: number; isHidden?: boolean; position: number; }
interface IMEGroup { id: string; name: string; required: boolean; maxSelect: number; position: number; options: IMEOption[]; }

function InlineModifierEditor({ templateId, restaurantId }: { templateId: string; restaurantId: string }) {
  const [groups, setGroups] = useState<IMEGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/modifier-templates?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then((templates: any[]) => {
        const t = templates.find((x: any) => x.id === templateId);
        if (t) setGroups(t.groups || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [templateId, restaurantId]);

  if (loading) return <div style={{ padding: "8px 12px" }}><span style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)" }}>Cargando...</span></div>;

  return (
    <div style={{ padding: "8px 12px 12px", borderTop: "1px solid var(--adm-card-border)" }}>
      {groups.length === 0 && (
        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0 }}>Sin grupos configurados. Configúralo en el tab Modificadores.</p>
      )}
      {groups.map(g => (
        <div key={g.id} style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text)" }}>
            {g.name} <span style={{ fontWeight: 400, color: "var(--adm-text3)", fontSize: "0.62rem" }}>({g.required ? "obligatorio" : "opcional"}, máx {g.maxSelect})</span>
          </span>
          <div style={{ paddingLeft: 10, display: "flex", flexDirection: "column", gap: 2, marginTop: 3 }}>
            {g.options.map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 6, opacity: o.isHidden ? 0.4 : 1 }}>
                <span style={{ fontSize: "0.62rem", color: "var(--adm-text3)" }}>·</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", flex: 1, textDecoration: o.isHidden ? "line-through" : "none" }}>{o.name}</span>
                {o.isHidden && <span style={{ fontSize: "0.55rem", color: "#ef4444", fontFamily: F }}>Oculto</span>}
                {o.priceAdjustment !== 0 && <span style={{ fontFamily: F, fontSize: "0.65rem", color: "#F4A623" }}>+${Math.abs(o.priceAdjustment).toLocaleString("es-CL")}</span>}
              </div>
            ))}
            {g.options.length === 0 && <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)" }}>Sin opciones</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminMenus() {
  const { selectedRestaurantId, restaurants, isSuper, loading: sessionLoading } = useAdminSession();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [expandedDishId, setExpandedDishId] = useState<string | null>(null);
  const [kebabOpenId, setKebabOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [menuTab, setMenuTab] = useState<"productos" | "categorias" | "modificadores" | "horarios">("productos");

  // Reset when clicking same nav link (e.g. "Mi Carta" while viewing a dish)
  useEffect(() => {
    const handler = () => { setSelectedDish(null); setExpandedDishId(null); setEditMode(false); setMenuTab("productos"); };
    window.addEventListener("nav-same-page", handler);
    return () => window.removeEventListener("nav-same-page", handler);
  }, []);

  const handleTabChange = (tab: typeof menuTab) => {
    setMenuTab(tab);
    setSelectedDish(null);
    setExpandedDishId(null);
    setEditMode(false);
  };

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
  const [newDishPhoto, setNewDishPhoto] = useState("");
  const [newDishPhotoUploading, setNewDishPhotoUploading] = useState(false);
  const [newDishDiet, setNewDishDiet] = useState("OMNIVORE");
  const [dishSaving, setDishSaving] = useState(false);
  const [dishCreatedMsg, setDishCreatedMsg] = useState("");
  const [recentlyCreated, setRecentlyCreated] = useState<Set<string>>(new Set());

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
    // Include categories from dishes
    dishes.forEach(d => { if (d.category) cats.set(d.category.id, d.category.name); });
    // Also include empty categories from fullCategories
    fullCategories.forEach(c => { if (!cats.has(c.id)) cats.set(c.id, c.name); });
    return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
  }, [dishes, fullCategories]);

  // Fetch full categories (including empty ones) on load and tab change
  useEffect(() => {
    if (!selectedRestaurantId) return;
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
      const q = norm(search);
      list = list.filter(d => norm(d.name).includes(q) || norm(d.description || "").includes(q) || norm(d.ingredients || "").includes(q));
    }
    if (catFilter !== "all") list = list.filter(d => d.categoryId === catFilter);
    // Recently created first, then recommended, then alphabetical
    return [...list].sort((a, b) => {
      const aNew = recentlyCreated.has(a.id) ? 0 : 1;
      const bNew = recentlyCreated.has(b.id) ? 0 : 1;
      if (aNew !== bNew) return aNew - bNew;
      const aRec = a.tags?.includes("RECOMMENDED") ? 0 : 1;
      const bRec = b.tags?.includes("RECOMMENDED") ? 0 : 1;
      if (aRec !== bRec) return aRec - bRec;
      return a.name.localeCompare(b.name, "es");
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
          photos: newDishPhoto ? [newDishPhoto] : [],
          dishDiet: newDishDiet,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const { aiIngredients, suggestedAllergens, ...dish } = data;
        // Add to top of list and open it
        setDishes(prev => [dish, ...prev]);
        setSelectedDish(dish);
        setNewDishName("");
        setNewDishPrice("");
        setNewDishDesc("");
        setNewDishPhoto("");
        setNewDishDiet("OMNIVORE");
        setCreatingDish(false);
        // Badge "Recién creado" — disappears after 5 min
        setRecentlyCreated(prev => new Set(prev).add(dish.id));
        setTimeout(() => setRecentlyCreated(prev => { const n = new Set(prev); n.delete(dish.id); return n; }), 5 * 60 * 1000);
        // Show AI feedback
        let msg = "Producto creado";
        if (aiIngredients?.matched?.length > 0) {
          msg += ` · ${aiIngredients.matched.length} ingrediente${aiIngredients.matched.length > 1 ? "s" : ""} detectados`;
        }
        if (suggestedAllergens?.length > 0) {
          msg += ` · Sugerimos alérgenos: ${suggestedAllergens.join(", ")}`;
        }
        setDishCreatedMsg(msg);
        setTimeout(() => setDishCreatedMsg(""), 8000);
      }
    } catch {}
    setDishSaving(false);
  };

  const toggleDishActive = async (dish: Dish) => {
    const newActive = !dish.isActive;
    // Optimistic update
    setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, isActive: newActive } : d));
    if (selectedDish?.id === dish.id) setSelectedDish({ ...selectedDish, isActive: newActive });
    try {
      const res = await fetch(`/api/admin/dishes/${dish.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: newActive }) });
      if (!res.ok) {
        // Revert on error
        setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, isActive: dish.isActive } : d));
        console.error("Toggle failed:", await res.text());
      }
    } catch (e) {
      setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, isActive: dish.isActive } : d));
      console.error("Toggle error:", e);
    }
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
  const [allIngredients, setAllIngredients] = useState<{ id: string; name: string; category: string }[]>([]);
  const [ingSearch, setIngSearch] = useState("");
  const [eAllergens, setEAllergens] = useState<string[]>([]);
  const [eTags, setETags] = useState<string[]>([]);
  const [eIsHero, setEIsHero] = useState(false);
  const [eDiet, setEDiet] = useState("OMNIVORE");
  const [eSpicy, setESpicy] = useState(false);
  const [eFlavorTags, setEFlavorTags] = useState<string[]>([]);
  const [eCategoryId, setECategoryId] = useState("");
  const [ingListOpen, setIngListOpen] = useState(false);
  const [ePhotoUrl, setEPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<{ id: string; name: string }[]>([]);
  const [assignedTemplateIds, setAssignedTemplateIds] = useState<string[]>([]);
  const [editModExpanded, setEditModExpanded] = useState<string | null>(null);
  const [editModPickerOpen, setEditModPickerOpen] = useState(false);
  const [editModSearch, setEditModSearch] = useState("");
  const [editModQuickCreating, setEditModQuickCreating] = useState(false);
  const [editModQuickName, setEditModQuickName] = useState("");
  const ingRef = useRef<HTMLDivElement>(null);

  // Load templates when a dish is selected (not just in edit mode)
  useEffect(() => {
    if (!selectedDish || !selectedRestaurantId) return;
    setAssignedTemplateIds(((selectedDish as any).modifierTemplates || []).map((t: any) => t.id));
    setEditModPickerOpen(false);
    setEditModExpanded(null);
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

  const TAG_OPTIONS: { value: string; label: string }[] = [
    { value: "RECOMMENDED", label: "Recomendado" },
    { value: "NEW", label: "Nuevo" },
  ];
  const DIET_COLORS: Record<string, { bg: string; color: string }> = {
    OMNIVORE: { bg: "rgba(139,90,43,0.1)", color: "#8b5a2b" },
    VEGAN: { bg: "rgba(74,222,128,0.1)", color: "#4ade80" },
    VEGETARIAN: { bg: "rgba(74,222,128,0.1)", color: "#4ade80" },
  };
  const DIET_OPTIONS: { value: string; label: string; icon: string }[] = [
    { value: "OMNIVORE", label: "Carnívoro", icon: "🍖" },
    { value: "VEGAN", label: "Vegano", icon: "🌿" },
    { value: "VEGETARIAN", label: "Vegetariano", icon: "🌱" },
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
    setEFlavorTags((d as any).flavorTags || []);
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
      tags: eTags,
      isHero: eTags.includes("RECOMMENDED"),
      dishDiet: eDiet,
      isSpicy: eSpicy,
      flavorTags: eFlavorTags,
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
    if (!res.ok) { alert(saved.error || "Error al guardar"); setSaving(false); return; }
    const newCat = categories.find(c => c.id === eCategoryId) || selectedDish.category;
    // Merge server response with local data for immediate update
    const updated = {
      ...selectedDish,
      ...saved,
      categoryId: eCategoryId,
      category: { id: newCat.id, name: newCat.name },
      modifierTemplates: (selectedDish as any).modifierTemplates || [],
    };
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

  if (selectedDish && editMode) return (
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
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <h2 style={{ fontFamily: F, fontSize: "1.2rem", color: "var(--adm-text)", margin: 0 }}>{selectedDish.name}</h2>
                    {selectedDish.tags?.includes("RECOMMENDED") && <span style={{ fontSize: "0.82rem", color: "#F4A623" }}>★</span>}
                    {selectedDish.tags?.includes("NEW") && <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "white", background: "#e85530", padding: "2px 7px", borderRadius: 50 }}>Nuevo</span>}
                  </div>
                  <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>{selectedDish.category.name}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: F, fontSize: "1.1rem", color: "#F4A623", margin: 0, fontWeight: 700 }}>${selectedDish.price.toLocaleString("es-CL")}</p>
                  {selectedDish.discountPrice && <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#4ade80", margin: 0 }}>${selectedDish.discountPrice.toLocaleString("es-CL")}</p>}
                </div>
              </div>
              {/* Diet + Spicy + Flavor badges */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {(selectedDish as any).dishDiet && (() => { const dc = DIET_COLORS[(selectedDish as any).dishDiet] || DIET_COLORS.OMNIVORE; const opt = DIET_OPTIONS.find(d => d.value === (selectedDish as any).dishDiet); return <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: dc.bg, color: dc.color }}>{opt?.icon} {opt?.label}</span>; })()}
                {(selectedDish as any).isSpicy && <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(232,85,48,0.1)", color: "#e85530" }}>🌶️ Picante</span>}
                {((selectedDish as any).flavorTags || []).map((f: string) => {
                  const icons: Record<string, string> = { dulce: "🍯", agridulce: "🍊", "ácido": "🍋", umami: "🍄", ahumado: "🔥" };
                  const colors: Record<string, string> = { dulce: "#f59e0b", agridulce: "#fb923c", "ácido": "#a3e635", umami: "#c084fc", ahumado: "#a78bfa" };
                  return <span key={f} style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${colors[f] || "#888"}1a`, color: colors[f] || "#888" }}>{icons[f] || "•"} {f.charAt(0).toUpperCase() + f.slice(1)}</span>;
                })}
              </div>
              {selectedDish.description && <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text2)", lineHeight: 1.5, margin: "0 0 12px" }}>{selectedDish.description}</p>}

              {selectedDish.ingredients && (
                <div style={{ marginBottom: 9 }}>
                  <div style={{ marginBottom: 5 }}>
                    <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", fontWeight: 600 }}>Ingredientes</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {selectedDish.ingredients.split(",").map(i => i.trim()).filter(Boolean).map(i => (
                      <span key={i} style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 50, background: "#f3f0e8", color: "#5f5e5a", fontFamily: F, fontWeight: 500 }}>{i}</span>
                    ))}
                  </div>
                </div>
              )}
              {(selectedDish as any).allergenDetails && (
                <div style={{ marginBottom: 9 }}>
                  <div style={{ marginBottom: 5 }}>
                    <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", fontWeight: 600 }}>Alérgenos</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {Object.entries((selectedDish as any).allergenDetails as Record<string, string[]>).map(([allergen, ingredients]) => (
                      <div key={allergen} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 50, background: "#faeeda", color: "#854f0b", fontFamily: F, fontWeight: 600 }}>⚠️ {allergen}</span>
                        <span style={{ fontSize: "0.62rem", color: "var(--adm-text3)", fontFamily: F }}>por {ingredients.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => startEditDish(selectedDish)} onMouseOver={e => (e.currentTarget.style.background = "#BFDBFE")} onMouseOut={e => (e.currentTarget.style.background = "#DBEAFE")} style={{ flex: 1, padding: "10px 28px", background: "#DBEAFE", border: "none", borderRadius: 8, color: "#1E40AF", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>Editar</button>
                <button onClick={() => toggleDishActive(selectedDish)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, background: selectedDish.isActive ? "rgba(255,100,100,0.1)" : "rgba(74,222,128,0.1)", color: selectedDish.isActive ? "#ff6b6b" : "#4ade80" }}>
                  {selectedDish.isActive ? "Desactivar" : "Activar"}
                </button>
                <button onClick={async () => {
                  if (!confirm(`¿Eliminar "${selectedDish.name}"? El producto dejará de aparecer en la carta y el panel.`)) return;
                  await fetch(`/api/admin/dishes/${selectedDish.id}`, { method: "DELETE" });
                  setDishes(prev => prev.filter(d => d.id !== selectedDish.id));
                  setSelectedDish(null);
                }} style={{ padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                  Eliminar
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
                <textarea value={eDesc} onChange={e => setEDesc(e.target.value)} rows={4} style={{ ...INP, resize: "vertical", minHeight: 80 }} />
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
                    <button key={d.value} onClick={() => setEDiet(d.value)} style={{ padding: "6px 12px", borderRadius: 8, border: eDiet === d.value ? "1.5px solid rgba(74,222,128,0.3)" : "1.5px solid var(--adm-card-border)", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: eDiet === d.value ? "rgba(74,222,128,0.1)" : "transparent", color: eDiet === d.value ? "#4ade80" : "var(--adm-text3)" }}>
                      {d.icon} {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Características</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => setESpicy(!eSpicy)} style={{ padding: "6px 12px", borderRadius: 8, border: eSpicy ? "1.5px solid rgba(232,85,48,0.3)" : "1.5px solid var(--adm-card-border)", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: eSpicy ? "rgba(232,85,48,0.1)" : "transparent", color: eSpicy ? "#e85530" : "var(--adm-text3)" }}>
                    🌶️ Picante
                  </button>
                  {[
                    { value: "dulce", icon: "🍯", color: "#f59e0b" },
                    { value: "agridulce", icon: "🍊", color: "#fb923c" },
                    { value: "ácido", icon: "🍋", color: "#a3e635" },
                    { value: "umami", icon: "🍄", color: "#c084fc" },
                    { value: "ahumado", icon: "🔥", color: "#a78bfa" },
                  ].map(f => {
                    const active = eFlavorTags.includes(f.value);
                    return (
                      <button key={f.value} onClick={() => setEFlavorTags(prev => active ? prev.filter(t => t !== f.value) : [...prev, f.value])} style={{ padding: "6px 12px", borderRadius: 8, border: active ? `1.5px solid ${f.color}33` : "1.5px solid var(--adm-card-border)", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: active ? `${f.color}1a` : "transparent", color: active ? f.color : "var(--adm-text3)" }}>
                        {f.icon} {f.value.charAt(0).toUpperCase() + f.value.slice(1)}
                      </button>
                    );
                  })}
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
                          {ing.name} <span style={{ fontSize: "10px", opacity: 0.6 }}>×</span>
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
                  placeholder="Agregar ingrediente..."
                  style={{ ...INP, marginBottom: 4 }}
                />
                {/* Filterable ingredient list — always visible when open */}
                {ingListOpen && (
                  <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--adm-card-border)", borderRadius: 8, scrollbarWidth: "thin" }}>
                    {(() => {
                      const filteredIngs = allIngredients
                        .filter(i => (!ingSearch || norm(i.name).includes(norm(ingSearch))) && !eIngredientIds.includes(i.id));
                      return (
                        <>
                          {filteredIngs.slice(0, 30).map(i => (
                            <button key={i.id} onClick={() => { setEIngredientIds(prev => [...prev, i.id]); setIngListOpen(false); setIngSearch(""); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", width: "100%", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", cursor: "pointer", textAlign: "left" }}>
                              <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)" }}>{i.name}</span>
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
                <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.5 }}>
                  Los alérgenos se detectan automáticamente a partir de los ingredientes del producto.
                </p>
                {(selectedDish as any)?.allergenDetails && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                    {Object.entries((selectedDish as any).allergenDetails as Record<string, string[]>).map(([allergen, ingredients]) => (
                      <div key={allergen} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "0.7rem", padding: "4px 10px", borderRadius: 50, background: "#faeeda", color: "#854f0b", fontFamily: F, fontWeight: 600 }}>⚠️ {allergen}</span>
                        <span style={{ fontSize: "0.62rem", color: "var(--adm-text3)", fontFamily: F }}>por {ingredients.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modificadores — inline management */}
              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Modificadores</label>

                {/* Assigned list with expandable preview */}
                {assignedTemplateIds.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                    {assignedTemplateIds.map(id => {
                      const t = availableTemplates.find(at => at.id === id);
                      if (!t) return null;
                      const isExpanded = editModExpanded === id;
                      return (
                        <div key={id} style={{ background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", gap: 8 }}>
                            <button onClick={() => setEditModExpanded(isExpanded ? null : id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: "#F4A623" }}>{t.name}</span>
                              <span style={{ fontSize: "0.6rem", color: "var(--adm-text3)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
                            </button>
                            <span onClick={async () => {
                              await fetch("/api/admin/modifier-templates", {
                                method: "PUT", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ templateId: id, unassignDishId: selectedDish!.id }),
                              });
                              setAssignedTemplateIds(prev => prev.filter(x => x !== id));
                              if (editModExpanded === id) setEditModExpanded(null);
                            }} style={{ cursor: "pointer", fontSize: "0.6rem", color: "#ef4444", padding: "2px 6px", background: "rgba(239,68,68,0.06)", borderRadius: 4 }}>×</span>
                          </div>
                          {isExpanded && <InlineModifierEditor templateId={id} restaurantId={selectedRestaurantId!} />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add + Create row */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {availableTemplates.length > 0 && (
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setEditModPickerOpen(!editModPickerOpen)} style={{ padding: "7px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)", cursor: "pointer" }}>
                        + Agregar
                      </button>
                      {editModPickerOpen && (
                        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 100, width: 240, overflow: "hidden" }}>
                          <input
                            value={editModSearch} onChange={e => setEditModSearch(e.target.value)}
                            placeholder="Buscar..."
                            style={{ width: "100%", padding: "8px 12px", border: "none", borderBottom: "1px solid var(--adm-card-border)", background: "transparent", fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box" }}
                            autoFocus
                          />
                          <div style={{ maxHeight: 160, overflowY: "auto" }}>
                            {availableTemplates
                              .filter(t => !assignedTemplateIds.includes(t.id) && (!editModSearch || norm(t.name).includes(norm(editModSearch))))
                              .map(t => (
                                <button key={t.id} onClick={async () => {
                                  await fetch("/api/admin/modifier-templates", {
                                    method: "PUT", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ templateId: t.id, assignDishId: selectedDish!.id }),
                                  });
                                  setAssignedTemplateIds(prev => [...prev, t.id]);
                                  setEditModPickerOpen(false);
                                  setEditModSearch("");
                                }} style={{ display: "block", width: "100%", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", textAlign: "left", cursor: "pointer", fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)" }}>
                                  {t.name}
                                </button>
                              ))}
                            {availableTemplates.filter(t => !assignedTemplateIds.includes(t.id) && (!editModSearch || norm(t.name).includes(norm(editModSearch)))).length === 0 && (
                              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", textAlign: "center", padding: 10, margin: 0 }}>Sin resultados</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {editModQuickCreating ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input value={editModQuickName} onChange={e => setEditModQuickName(e.target.value)} placeholder="Ej: Extras, Acompañamiento..." onKeyDown={async (e) => {
                        if (e.key !== "Enter" || !editModQuickName.trim() || !selectedRestaurantId || !selectedDish) return;
                        const res = await fetch("/api/admin/modifier-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: selectedRestaurantId, name: editModQuickName.trim() }) });
                        const t = await res.json();
                        if (res.ok) {
                          setAvailableTemplates(prev => [...prev, { id: t.id, name: t.name }]);
                          await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: t.id, assignDishId: selectedDish.id }) });
                          setAssignedTemplateIds(prev => [...prev, t.id]);
                          setEditModQuickName(""); setEditModQuickCreating(false);
                          setEditModExpanded(t.id);
                        }
                      }} style={{ padding: "7px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)", outline: "none", width: 170 }} autoFocus />
                      <button onClick={async () => {
                        if (!editModQuickName.trim() || !selectedRestaurantId || !selectedDish) return;
                        const res = await fetch("/api/admin/modifier-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: selectedRestaurantId, name: editModQuickName.trim() }) });
                        const t = await res.json();
                        if (res.ok) {
                          setAvailableTemplates(prev => [...prev, { id: t.id, name: t.name }]);
                          await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: t.id, assignDishId: selectedDish.id }) });
                          setAssignedTemplateIds(prev => [...prev, t.id]);
                          setEditModQuickName(""); setEditModQuickCreating(false);
                          setEditModExpanded(t.id);
                        }
                      }} disabled={!editModQuickName.trim()} style={{ padding: "7px 12px", background: "#F4A623", color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", opacity: !editModQuickName.trim() ? 0.5 : 1 }}>Crear</button>
                      <button onClick={() => { setEditModQuickCreating(false); setEditModQuickName(""); }} style={{ padding: "5px 8px", background: "none", border: "none", color: "var(--adm-text3)", cursor: "pointer", fontSize: "0.7rem" }}>×</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditModQuickCreating(true)} style={{ padding: "7px 14px", background: "#F4A623", color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                      + Crear nuevo
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Tags <span style={{ fontWeight: 400, color: "var(--adm-text3)", fontSize: "0.68rem" }}>({recCount + (eTags.includes("RECOMMENDED") ? 1 : 0)}/{MAX_RECOMMENDED} recomendados)</span></label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TAG_OPTIONS.map(t => {
                    const active = eTags.includes(t.value);
                    const atLimit = t.value === "RECOMMENDED" && !active && recCount >= MAX_RECOMMENDED;
                    return (
                      <button key={t.value} onClick={() => toggleTag(t.value)} disabled={atLimit} style={{ padding: "5px 10px", borderRadius: 6, border: active ? `1.5px solid ${TAG_COLORS[t.value]}40` : "1.5px solid var(--adm-card-border)", cursor: atLimit ? "not-allowed" : "pointer", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, background: active ? `${TAG_COLORS[t.value]}15` : "transparent", color: active ? TAG_COLORS[t.value] : "var(--adm-text3)", display: "inline-flex", alignItems: "center", gap: 4, opacity: atLimit ? 0.4 : 1 }}>
                        {t.value === "RECOMMENDED" && <span style={{ fontSize: "0.7rem", opacity: active ? 1 : 0.4 }}>★</span>}
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {recCount >= MAX_RECOMMENDED && !eTags.includes("RECOMMENDED") && (
                  <p style={{ fontFamily: F, fontSize: "0.68rem", color: "#e85530", margin: "6px 0 0" }}>Máximo {MAX_RECOMMENDED} recomendados. Quita uno de otro plato para agregar aquí.</p>
                )}
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
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>Administra los productos y categorías de {activeRestaurant?.name} · {filtered.length} productos</p>
        </div>
        <RestaurantPicker />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--adm-hover)", borderRadius: 10, padding: 3 }}>
        {([
          { key: "productos" as const, label: "Productos" },
          { key: "modificadores" as const, label: "Modificadores" },
          { key: "categorias" as const, label: "Categorías" },
          { key: "horarios" as const, label: "Horarios" },
        ]).map(tab => (
          <button key={tab.key} onClick={() => handleTabChange(tab.key)} style={{
            flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600,
            background: menuTab === tab.key ? "white" : "transparent",
            color: menuTab === tab.key ? "#F4A623" : "var(--adm-text3)",
            boxShadow: menuTab === tab.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>{tab.label}</button>
        ))}
      </div>

      {menuTab === "productos" && (<>
      {!creatingDish && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={() => { setCreatingDish(true); setNewDishCatId(categories[0]?.id || ""); }} style={{ padding: "10px 18px", background: "#F4A623", color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Nuevo producto</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: creatingDish ? 10 : 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
          <input
            placeholder="Buscar producto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", paddingRight: search ? 36 : 14, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)", fontSize: "0.85rem", padding: 2 }}>✕</button>
          )}
        </div>
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
          <h3 style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 12px" }}>Nuevo producto</h3>
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
              <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Tipo de dieta</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DIET_OPTIONS.map(d => (
                  <button key={d.value} type="button" onClick={() => setNewDishDiet(d.value)} style={{ padding: "6px 12px", borderRadius: 8, border: newDishDiet === d.value ? "1.5px solid rgba(74,222,128,0.3)" : "1.5px solid var(--adm-card-border)", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: newDishDiet === d.value ? "rgba(74,222,128,0.1)" : "transparent", color: newDishDiet === d.value ? "#4ade80" : "var(--adm-text3)" }}>
                    {d.icon} {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Descripción</label>
              <textarea value={newDishDesc} onChange={e => setNewDishDesc(e.target.value)} placeholder="Opcional" rows={2} style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const, resize: "vertical" }} />
            </div>
            <div>
              <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Foto</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {newDishPhoto && <img src={newDishPhoto} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />}
                <label style={{ padding: "8px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", cursor: "pointer" }}>
                  {newDishPhotoUploading ? "Subiendo..." : newDishPhoto ? "Cambiar" : "Subir foto"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setNewDishPhotoUploading(true);
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("localId", selectedRestaurantId || "");
                    fd.append("dishName", newDishName || "plato");
                    const res = await fetch("/api/admin/upload-dish-image", { method: "POST", body: fd });
                    const data = await res.json();
                    if (data.url) setNewDishPhoto(data.url);
                    setNewDishPhotoUploading(false);
                  }} />
                </label>
                {newDishPhoto && <button onClick={() => setNewDishPhoto("")} style={{ padding: "4px 8px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "#ef4444", cursor: "pointer" }}>×</button>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createDish} disabled={dishSaving || newDishPhotoUploading || !newDishName.trim() || !newDishPrice || !newDishCatId} style={{ flex: 1, padding: "10px", background: "#F4A623", color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: (dishSaving || newDishPhotoUploading || !newDishName.trim() || !newDishPrice) ? 0.5 : 1 }}>{newDishPhotoUploading ? "Subiendo foto..." : dishSaving ? "Creando..." : "Crear plato"}</button>
              <button onClick={() => { setCreatingDish(false); setNewDishName(""); setNewDishPrice(""); setNewDishDesc(""); setNewDishPhoto(""); }} style={{ padding: "10px 16px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {dishCreatedMsg && (
        <div style={{ padding: "10px 14px", background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)", borderRadius: 10, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.85rem" }}>✓</span>
          <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#16a34a" }}>{dishCreatedMsg}</span>
        </div>
      )}

      {loading ? (
        <SkeletonLoading type="list" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {paginated.map(d => {
            const isRec = d.tags?.includes("RECOMMENDED");
            const isExpanded = expandedDishId === d.id;
            return (
            <div key={d.id} style={{
              background: isRec ? "rgba(244,166,35,0.03)" : "var(--adm-card)",
              border: isRec ? "1.5px solid rgba(244,166,35,0.3)" : "1px solid var(--adm-card-border)",
              borderRadius: 12, overflow: "hidden", opacity: d.isActive ? 1 : 0.5,
            }}>
              {/* Header — clickeable */}
              <button onClick={() => setExpandedDishId(isExpanded ? null : d.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                background: "transparent", border: "none",
                cursor: "pointer", width: "100%", textAlign: "left",
              }}>
                {d.photos?.[0] ? (
                  <img src={d.photos[0]} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--adm-card-border)", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isRec && <span style={{ fontSize: "0.8rem", color: "#F4A623", flexShrink: 0 }}>★</span>}
                    <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                    {recentlyCreated.has(d.id) && <span style={{ fontSize: "0.59rem", fontWeight: 700, color: "#7fbfdc", background: "rgba(127,191,220,0.1)", padding: "1px 6px", borderRadius: 50, flexShrink: 0 }}>Recién agregado</span>}
                    {d.tags?.includes("NEW") && <span style={{ fontSize: "0.56rem", fontWeight: 700, color: "white", background: "#e85530", padding: "0px 6px", borderRadius: 50, flexShrink: 0 }}>Nuevo</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <p style={{ fontFamily: F, fontSize: "0.71rem", color: "var(--adm-text2)", margin: 0 }}>{d.category.name}</p>
                    {(d as any).dishDiet && <span style={{ fontSize: "0.58rem", color: (DIET_COLORS[(d as any).dishDiet] || DIET_COLORS.OMNIVORE).color }}>{DIET_OPTIONS.find(o => o.value === (d as any).dishDiet)?.icon}</span>}
                    {(d as any).isSpicy && <span style={{ fontSize: "0.58rem" }}>🌶️</span>}
                    {((d as any).flavorTags || []).map((f: string) => {
                      const icons: Record<string, string> = { dulce: "🍯", agridulce: "🍊", "ácido": "🍋", umami: "🍄", ahumado: "🔥" };
                      return <span key={f} style={{ fontSize: "0.58rem" }}>{icons[f] || "•"}</span>;
                    })}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <p style={{ fontFamily: F, fontSize: "0.88rem", color: "#F4A623", margin: 0, fontWeight: 600 }}>${d.price.toLocaleString("es-CL")}</p>
                  {!d.isActive && <p style={{ fontFamily: F, fontSize: "0.65rem", color: "#ff6b6b", margin: 0 }}>Inactivo</p>}
                </div>
                <span style={{ fontSize: "1rem", color: "var(--adm-text3)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>▾</span>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--adm-card-border)" }}>
                  {/* Description */}
                  {/* Diet + Spicy */}
                  {((d as any).dishDiet || (d as any).isSpicy || ((d as any).flavorTags || []).length > 0) && (
                    <div style={{ display: "flex", gap: 6, margin: "10px 0 8px", flexWrap: "wrap" }}>
                      {(d as any).dishDiet && (() => { const dc = DIET_COLORS[(d as any).dishDiet] || DIET_COLORS.OMNIVORE; const opt = DIET_OPTIONS.find(o => o.value === (d as any).dishDiet); return <span style={{ fontSize: "0.62rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: dc.bg, color: dc.color }}>{opt?.icon} {opt?.label}</span>; })()}
                      {(d as any).isSpicy && <span style={{ fontSize: "0.62rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(232,85,48,0.1)", color: "#e85530" }}>🌶️ Picante</span>}
                      {((d as any).flavorTags || []).map((f: string) => {
                        const icons: Record<string, string> = { dulce: "🍯", agridulce: "🍊", "ácido": "🍋", umami: "🍄", ahumado: "🔥" };
                        const colors: Record<string, string> = { dulce: "#f59e0b", agridulce: "#fb923c", "ácido": "#a3e635", umami: "#c084fc", ahumado: "#a78bfa" };
                        return <span key={f} style={{ fontSize: "0.62rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${colors[f] || "#888"}1a`, color: colors[f] || "#888" }}>{icons[f] || "•"} {f.charAt(0).toUpperCase() + f.slice(1)}</span>;
                      })}
                    </div>
                  )}

                  {d.description && <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", lineHeight: 1.5, margin: "6px 0 10px" }}>{d.description}</p>}

                  {/* Ingredients */}
                  {d.ingredients && (
                    <div style={{ marginBottom: 7 }}>
                      <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Ingredientes</span>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {d.ingredients.split(",").map(i => i.trim()).filter(Boolean).map(i => (
                          <span key={i} style={{ fontSize: "0.63rem", padding: "2px 8px", borderRadius: 50, background: "#f3f0e8", color: "#5f5e5a", fontFamily: F }}>{i}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Allergens */}
                  {d.allergens && d.allergens !== "ninguno" && (
                    <div style={{ marginBottom: 7 }}>
                      <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Alérgenos</span>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {d.allergens.split(",").map(a => a.trim()).filter(a => a && a !== "ninguno").map(a => (
                          <span key={a} style={{ fontSize: "0.62rem", padding: "2px 8px", borderRadius: 50, background: "#faeeda", color: "#854f0b", fontFamily: F }}>⚠️ {a}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modifiers */}
                  {(d as any).modifierTemplates?.length > 0 && (
                    <div style={{ marginBottom: 7 }}>
                      <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Modificadores</span>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {(d as any).modifierTemplates.map((t: any) => (
                          <span key={t.id} style={{ fontSize: "0.62rem", padding: "2px 8px", borderRadius: 50, background: "rgba(244,166,35,0.08)", color: "#F4A623", fontFamily: F }}>{t.name}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "stretch" }}>
                    <button onClick={() => { setSelectedDish(d); startEditDish(d); }} onMouseOver={e => (e.currentTarget.style.background = "#BFDBFE")} onMouseOut={e => (e.currentTarget.style.background = "#DBEAFE")} style={{ padding: "10px 28px", background: "#DBEAFE", border: "none", borderRadius: 8, color: "#1E40AF", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>Editar</button>
                    <button onClick={() => toggleDishActive(d)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e0d3", cursor: "pointer", fontFamily: F, fontSize: "0.78rem", fontWeight: 500, background: "transparent", color: "#6b6b65", display: "flex", alignItems: "center", gap: 4 }}>
                      {d.isActive ? (
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Ocultar</>
                      ) : (
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Mostrar</>
                      )}
                    </button>
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setKebabOpenId(kebabOpenId === d.id ? null : d.id)} style={{ width: 38, borderRadius: 8, border: "1px solid #e5e0d3", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", color: "#6b6b65" }}>⋯</button>
                      {kebabOpenId === d.id && (
                        <div style={{ position: "absolute", bottom: "100%", right: 0, marginBottom: 4, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 10, overflow: "hidden", minWidth: 120 }}>
                          <button onClick={async () => {
                            if (!confirm(`¿Eliminar "${d.name}"? El producto dejará de aparecer en la carta y el panel.`)) { setKebabOpenId(null); return; }
                            await fetch(`/api/admin/dishes/${d.id}`, { method: "DELETE" });
                            setDishes(prev => prev.filter(x => x.id !== d.id));
                            setExpandedDishId(null);
                            setKebabOpenId(null);
                          }} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.78rem", color: "#ef4444", textAlign: "left" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            );
          })}
          {filtered.length === 0 && (
            <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text2)", textAlign: "center", padding: 40 }}>
              {dishes.length === 0 ? "Este local no tiene productos" : "No hay productos que coincidan"}
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
      {menuTab === "categorias" && selectedRestaurantId && (
        <CategoriesManager restaurantId={selectedRestaurantId} allDishes={dishes} onDishesChange={setDishes} />
      )}

      {/* ── Modificadores tab ── */}
      {menuTab === "modificadores" && selectedRestaurantId && (
        <ModifierTemplatesTab restaurantId={selectedRestaurantId} />
      )}

      {/* ── Horarios tab ── */}
      {menuTab === "horarios" && selectedRestaurantId && (
        <HappyHoursTab restaurantId={selectedRestaurantId} categories={categories} />
      )}
    </div>
  );
}

const LBL: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 };
const INP: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: "var(--font-display)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" };
