"use client";

import { useState, useEffect } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Dish { id: string; name: string; photos: string[]; price: number; position: number; }
interface Category { id: string; name: string; position: number; isActive: boolean; dishType?: string; _count?: { dishes: number }; }
const DISH_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  food: { label: "Plato", emoji: "🍽️", color: GOLD },
  drink: { label: "Bebestible", emoji: "🥤", color: "#7fbfdc" },
  dessert: { label: "Postre", emoji: "🍰", color: "#c084fc" },
};

interface Props {
  restaurantId: string;
  allDishes: any[];
  onDishesChange: (dishes: any[]) => void;
}

function SortableDish({ dish, onMove, categories, currentCatId }: { dish: Dish; onMove: (dishId: string, toCatId: string) => void; categories: Category[]; currentCatId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dish.id });
  const [moving, setMoving] = useState(false);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 8, marginBottom: 4 }}>
        <div {...attributes} {...listeners} style={{ cursor: "grab", padding: "4px 2px", color: "var(--adm-text3)", fontSize: "0.8rem", touchAction: "none" }}>⠿</div>
        {dish.photos?.[0] ? (
          <img src={dish.photos[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--adm-card-border)", flexShrink: 0 }} />
        )}
        <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dish.name}</span>
        <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", flexShrink: 0 }}>${dish.price?.toLocaleString("es-CL")}</span>
        <button onClick={() => setMoving(!moving)} style={{ padding: "3px 8px", background: "rgba(127,191,220,0.08)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.62rem", color: "#7fbfdc", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>Cambiar categoría</button>
      </div>
      {moving && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "4px 0 8px 42px" }}>
          {categories.filter(c => c.id !== currentCatId).map(c => (
            <button key={c.id} onClick={() => { onMove(dish.id, c.id); setMoving(false); }} style={{ padding: "3px 10px", borderRadius: 50, border: "1px solid var(--adm-card-border)", background: "transparent", fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text2)", cursor: "pointer" }}>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortableCategory({ category, allCategories, dishes, onReorder, onMove, onRename, onToggle, onDelete, onTypeChange }: {
  category: Category;
  allCategories: Category[];
  dishes: Dish[];
  onReorder: (catId: string, dishIds: string[]) => void;
  onMove: (dishId: string, toCatId: string) => void;
  onRename: (id: string, name: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  onTypeChange: (id: string, dishType: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDishDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = dishes.findIndex(d => d.id === active.id);
    const newIndex = dishes.findIndex(d => d.id === over.id);
    const reordered = arrayMove(dishes, oldIndex, newIndex);
    onReorder(category.id, reordered.map(d => d.id));
  };

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, marginBottom: 8 }}>
      <div style={{ background: expanded ? "var(--adm-card)" : "transparent", border: "1px solid var(--adm-card-border)", borderRadius: expanded ? 14 : 10, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px" }}>
          <div {...attributes} {...listeners} style={{ cursor: "grab", padding: "2px", color: "var(--adm-text3)", fontSize: "0.8rem", touchAction: "none", flexShrink: 0 }}>⠿</div>
          {editing ? (
            <>
              <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { onRename(category.id, editName); setEditing(false); } }} style={{ flex: 1, padding: "4px 8px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", outline: "none" }} autoFocus />
              <button onClick={() => { onRename(category.id, editName); setEditing(false); }} style={{ padding: "4px 10px", background: GOLD, color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", fontWeight: 700, cursor: "pointer" }}>OK</button>
              <button onClick={() => setEditing(false)} style={{ padding: "4px 8px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", cursor: "pointer" }}>X</button>
            </>
          ) : (
            <>
              <button onClick={() => setExpanded(!expanded)} style={{ flex: 1, background: "none", border: "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
                <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: category.isActive ? "var(--adm-text)" : "var(--adm-text3)" }}>{category.name}</span>
                <span onClick={(e) => { e.stopPropagation(); setEditing(true); setEditName(category.name); }} style={{ fontSize: "0.6rem", cursor: "pointer", opacity: 0.4 }}>✏️</span>
                {(() => {
                  const t = DISH_TYPE_LABELS[category.dishType || "food"];
                  const types = ["food", "drink", "dessert"] as const;
                  return <select
                    value={category.dishType || "food"}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); onTypeChange(category.id, e.target.value); }}
                    style={{ padding: "2px 4px", borderRadius: 4, border: "none", fontFamily: F, fontSize: "0.62rem", fontWeight: 600, cursor: "pointer", background: `${t.color}15`, color: t.color, outline: "none", appearance: "none", WebkitAppearance: "none", textAlign: "center", minWidth: 70 }}
                  >
                    {types.map(k => <option key={k} value={k}>{DISH_TYPE_LABELS[k].emoji} {DISH_TYPE_LABELS[k].label}</option>)}
                  </select>;
                })()}
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{dishes.length}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--adm-text3)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", marginLeft: "auto" }}>▾</span>
              </button>
              <button onClick={() => onToggle(category.id, !category.isActive)} style={{ padding: "3px 10px", borderRadius: 6, border: "none", fontFamily: F, fontSize: "0.65rem", fontWeight: 600, cursor: "pointer", background: category.isActive ? "rgba(255,100,100,0.06)" : "rgba(74,222,128,0.06)", color: category.isActive ? "#ff6b6b" : "#4ade80" }}>
                {category.isActive ? "Ocultar" : "Mostrar"}
              </button>
              <button onClick={() => {
                if (dishes.length > 0) {
                  if (confirm(`"${category.name}" tiene ${dishes.length} plato(s). ¿Quieres moverlos a otra categoría y eliminarla?`)) {
                    onDelete(category.id);
                  }
                } else {
                  onDelete(category.id);
                }
              }} style={{ padding: "3px 8px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", fontWeight: 600, color: "#ef4444", cursor: "pointer" }}>Eliminar</button>
            </>
          )}
        </div>

        {/* Expanded: dish list with drag */}
        {expanded && (
          <div style={{ padding: "0 14px 14px" }}>
            {dishes.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDishDragEnd}>
                <SortableContext items={dishes.map(d => d.id)} strategy={verticalListSortingStrategy}>
                  {dishes.map(d => (
                    <SortableDish key={d.id} dish={d} onMove={onMove} categories={allCategories} currentCatId={category.id} />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text3)", textAlign: "center", padding: 12 }}>Sin platos en esta categoría</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CategoriesManager({ restaurantId, allDishes, onDishesChange }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    fetch(`/api/admin/categories?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setCategories(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const getDishesForCategory = (catId: string): Dish[] => {
    return allDishes.filter(d => d.categoryId === catId).sort((a, b) => a.position - b.position);
  };

  const createCategory = async () => {
    if (!newCatName.trim()) return;
    const res = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, name: newCatName.trim() }) });
    const cat = await res.json();
    if (res.ok) { setCategories(prev => [...prev, { ...cat, _count: { dishes: 0 } }]); setNewCatName(""); }
  };

  const renameCategory = async (id: string, name: string) => {
    await fetch("/api/admin/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name }) });
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    onDishesChange(allDishes.map(d => d.categoryId === id ? { ...d, category: { ...d.category, name } } : d));
  };

  const toggleCategory = async (id: string, isActive: boolean) => {
    await fetch("/api/admin/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isActive }) });
    setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive } : c));
  };

  const changeDishType = async (id: string, dishType: string) => {
    await fetch("/api/admin/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, dishType }) });
    setCategories(prev => prev.map(c => c.id === id ? { ...c, dishType } : c));
  };

  const deleteCategory = async (id: string) => {
    const catDishes = allDishes.filter(d => d.categoryId === id);
    const otherCats = categories.filter(c => c.id !== id);

    // If has dishes, move them to the first other category
    if (catDishes.length > 0 && otherCats.length > 0) {
      const targetCat = otherCats[0];
      for (const d of catDishes) {
        await fetch("/api/admin/dishes/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moveDishId: d.id, toCategoryId: targetCat.id }),
        });
      }
      // Update local dishes state
      onDishesChange(allDishes.map(d =>
        d.categoryId === id ? { ...d, categoryId: targetCat.id, category: { id: targetCat.id, name: targetCat.name } } : d
      ));
    }

    const res = await fetch("/api/admin/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) setCategories(prev => prev.filter(c => c.id !== id));
  };

  const reorderDishes = async (catId: string, dishIds: string[]) => {
    // Update local state
    const updated = allDishes.map(d => {
      const idx = dishIds.indexOf(d.id);
      return idx >= 0 ? { ...d, position: idx } : d;
    });
    onDishesChange(updated);
    // Save to API
    await fetch("/api/admin/dishes/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, categoryId: catId, dishIds }) });
  };

  const moveDish = async (dishId: string, toCatId: string) => {
    const toCat = categories.find(c => c.id === toCatId);
    const updated = allDishes.map(d => d.id === dishId ? { ...d, categoryId: toCatId, category: { id: toCatId, name: toCat?.name || "" } } : d);
    onDishesChange(updated);
    await fetch("/api/admin/dishes/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moveDishId: dishId, toCategoryId: toCatId }) });
  };

  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    setCategories(reordered);
    await fetch("/api/admin/categories/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, categoryIds: reordered.map(c => c.id) }) });
  };

  if (loading) return <SkeletonLoading type="cards" />;

  return (
    <div>
      <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Arrastra para reordenar categorías y platos. El orden se refleja en la carta QR.
      </p>

      {/* Create */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === "Enter" && createCategory()} placeholder="Nueva categoría..."
          style={{ flex: 1, padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }} />
        <button onClick={createCategory} disabled={!newCatName.trim()} style={{ padding: "10px 18px", background: GOLD, color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: !newCatName.trim() ? 0.5 : 1 }}>+ Crear</button>
      </div>

      {/* Sortable categories */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
        <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {categories.map(cat => (
            <SortableCategory
              key={cat.id}
              category={cat}
              allCategories={categories}
              dishes={getDishesForCategory(cat.id)}
              onReorder={reorderDishes}
              onMove={moveDish}
              onRename={renameCategory}
              onToggle={toggleCategory}
              onDelete={deleteCategory}
              onTypeChange={changeDishType}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Orphan dishes */}
      {(() => {
        const catIds = new Set(categories.map(c => c.id));
        const orphans = allDishes.filter(d => !catIds.has(d.categoryId));
        if (orphans.length === 0) return null;
        return (
          <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: 10 }}>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#ef4444", fontWeight: 600, margin: "0 0 8px" }}>Platos sin categoría ({orphans.length})</p>
            {orphans.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(239,68,68,0.08)" }}>
                <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", flex: 1 }}>{d.name}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
