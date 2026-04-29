"use client";

import { useState, useEffect, useRef } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, MoreVertical, GripVertical } from "lucide-react";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";

interface Dish { id: string; name: string; photos: string[]; price: number; position: number; isActive?: boolean; }
interface Category { id: string; name: string; position: number; isActive: boolean; dishType?: string; _count?: { dishes: number }; }
const DISH_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  food: { label: "Platos de fondo", emoji: "🍽️" },
  entry: { label: "Entradas", emoji: "🥗" },
  drink: { label: "Bebestibles", emoji: "🥤" },
  dessert: { label: "Postres", emoji: "🍰" },
  extra: { label: "Extras", emoji: "🔧" },
};

interface Props {
  restaurantId: string;
  allDishes: any[];
  onDishesChange: (dishes: any[]) => void;
  onEditDish?: (dish: any) => void;
}

function SortableDish({ dish, onMove, onEdit, categories, currentCatId }: { dish: Dish; onMove: (dishId: string, toCatId: string) => void; onEdit?: (dish: Dish) => void; categories: Category[]; currentCatId: string }) {
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
        {onEdit && <button onClick={() => onEdit(dish)} style={{ padding: "3px 8px", background: "rgba(244,166,35,0.1)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.62rem", color: "#F4A623", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>Editar</button>}
        <button onClick={() => setMoving(!moving)} style={{ padding: "3px 8px", background: "rgba(127,191,220,0.08)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.62rem", color: "#7fbfdc", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>Mover</button>
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

/* ── Icon button shared style ── */
const iconBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, background: "transparent",
  border: "none", color: "#888", cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0,
};

function SortableCategory({ category, allCategories, dishes, onReorder, onMove, onEditDish, onRename, onToggle, onDelete, onTypeChange }: {
  category: Category;
  allCategories: Category[];
  dishes: Dish[];
  onReorder: (catId: string, dishIds: string[]) => void;
  onEditDish?: (dish: Dish) => void;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingType, setChangingType] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDishDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = dishes.findIndex(d => d.id === active.id);
    const newIndex = dishes.findIndex(d => d.id === over.id);
    const reordered = arrayMove(dishes, oldIndex, newIndex);
    onReorder(category.id, reordered.map(d => d.id));
  };

  const hiddenCount = dishes.filter(d => d.isActive === false).length;
  const dt = DISH_TYPE_LABELS[category.dishType || "food"] || DISH_TYPE_LABELS.food;
  const isHidden = !category.isActive;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, marginBottom: 8 }}>
      {/* Category row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          background: isHidden ? "#FAF9F7" : "white",
          border: "0.5px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          padding: 12,
          display: "flex",
          gap: 10,
          alignItems: "center",
          opacity: isHidden ? 0.7 : 1,
          cursor: "pointer",
          overflow: expanded ? "visible" : "hidden",
          ...(expanded ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : {}),
        }}
      >
        {/* Drag handle */}
        <div
          {...attributes} {...listeners}
          onClick={e => e.stopPropagation()}
          style={{ width: 24, height: 24, color: "#C5C0B5", fontSize: 14, cursor: "grab", touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <GripVertical size={16} />
        </div>

        {/* Body */}
        {editing ? (
          <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }} onClick={e => e.stopPropagation()}>
            <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { onRename(category.id, editName); setEditing(false); } }} style={{ flex: 1, padding: "4px 8px", background: "#F5F4F1", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "#1a1a1a", outline: "none" }} autoFocus />
            <button onClick={() => { onRename(category.id, editName); setEditing(false); }} style={{ padding: "4px 12px", background: "#1a1a1a", color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", fontWeight: 600, cursor: "pointer" }}>OK</button>
            <button onClick={() => setEditing(false)} style={{ padding: "4px 8px", background: "none", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "#888", cursor: "pointer" }}>X</button>
          </div>
        ) : changingType ? (
          <div style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} onClick={e => e.stopPropagation()}>
            {Object.entries(DISH_TYPE_LABELS).map(([key, v]) => (
              <button
                key={key}
                onClick={() => { onTypeChange(category.id, key); setChangingType(false); }}
                style={{
                  padding: "4px 10px", borderRadius: 999, border: (category.dishType || "food") === key ? "1.5px solid #854F0B" : "1px solid rgba(0,0,0,0.08)",
                  background: (category.dishType || "food") === key ? "#F5F0E8" : "transparent",
                  fontFamily: F, fontSize: "0.68rem", fontWeight: 500, color: "#854F0B", cursor: "pointer",
                }}
              >
                {v.emoji} {v.label}
              </button>
            ))}
            <button onClick={() => setChangingType(false)} style={{ padding: "4px 8px", background: "none", border: "none", fontFamily: F, fontSize: "0.68rem", color: "#888", cursor: "pointer" }}>Cancelar</button>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Name */}
            <span style={{ fontFamily: F, fontSize: "14.5px", fontWeight: 500, color: isHidden ? "#888" : "#1a1a1a", letterSpacing: "-0.1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {category.name}
            </span>
            {/* Meta row */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: FB, fontSize: 11, color: "#888" }}>
                {dishes.length} producto{dishes.length !== 1 ? "s" : ""}
              </span>
              {hiddenCount > 0 && (
                <span style={{ fontFamily: F, fontSize: 9, fontWeight: 500, color: "#6B5544", background: "#F0EBE2", padding: "2px 6px", borderRadius: 999, letterSpacing: "0.2px" }}>
                  {hiddenCount} oculto{hiddenCount !== 1 ? "s" : ""}
                </span>
              )}
              {isHidden && (
                <span style={{ fontFamily: F, fontSize: 9, fontWeight: 500, color: "#6B5544", background: "#F0EBE2", padding: "2px 6px", borderRadius: 999, letterSpacing: "0.2px" }}>
                  Toda oculta
                </span>
              )}
              <span onClick={(e) => { e.stopPropagation(); setChangingType(true); }} style={{ fontFamily: F, fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: "#F5F0E8", color: "#854F0B", letterSpacing: "0.1px", whiteSpace: "nowrap", opacity: isHidden ? 0.6 : 1, cursor: "pointer" }}>
                {dt.label}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        {!editing && !changingType && (
          <div style={{ flexShrink: 0, display: "flex", gap: 0 }} onClick={e => e.stopPropagation()}>
            {/* Visibility toggle */}
            <button
              onClick={() => onToggle(category.id, !category.isActive)}
              style={iconBtnStyle}
              title={isHidden ? "Mostrar categoría" : "Ocultar categoría"}
            >
              {isHidden ? <EyeOff size={16} color="#C5C0B5" /> : <Eye size={16} />}
            </button>
            {/* Menu */}
            <div style={{ position: "relative" }} ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)} style={iconBtnStyle}>
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "100%", marginTop: 4, width: 180,
                  background: "white", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 10,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 100, overflow: "hidden",
                }}>
                  <button
                    onClick={() => { setMenuOpen(false); setEditing(true); setEditName(category.name); }}
                    style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", textAlign: "left", fontFamily: F, fontSize: 13, color: "#1a1a1a", cursor: "pointer" }}
                  >
                    Editar nombre
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setChangingType(true); }}
                    style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", textAlign: "left", fontFamily: F, fontSize: 13, color: "#1a1a1a", cursor: "pointer", borderTop: "0.5px solid rgba(0,0,0,0.06)" }}
                  >
                    Cambiar tipo
                  </button>
                  <button
                    disabled
                    style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", textAlign: "left", fontFamily: F, fontSize: 13, color: "#bbb", cursor: "default", borderTop: "0.5px solid rgba(0,0,0,0.06)" }}
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      if (dishes.length > 0) {
                        if (confirm(`"${category.name}" tiene ${dishes.length} producto(s). ¿Quieres moverlos a otra categoría y eliminarla?`)) {
                          onDelete(category.id);
                        }
                      } else {
                        if (confirm(`¿Eliminar la categoría "${category.name}"?`)) {
                          onDelete(category.id);
                        }
                      }
                    }}
                    style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", textAlign: "left", fontFamily: F, fontSize: 13, color: "#ef4444", cursor: "pointer", borderTop: "0.5px solid rgba(0,0,0,0.06)" }}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expanded: dish list with drag */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", background: "white", border: "0.5px solid rgba(0,0,0,0.08)", borderTop: "none", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          {dishes.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDishDragEnd}>
              <SortableContext items={dishes.map(d => d.id)} strategy={verticalListSortingStrategy}>
                <div style={{ paddingTop: 8 }}>
                  {dishes.map(d => (
                    <SortableDish key={d.id} dish={d} onMove={onMove} onEdit={onEditDish} categories={allCategories} currentCatId={category.id} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 12px" }}>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#888" }}>Sin productos en esta categoría</p>
              <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "#888", opacity: 0.6, marginTop: 4 }}>Agrega productos desde la pestaña Productos</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CategoriesManager({ restaurantId, allDishes, onDishesChange, onEditDish }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);

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
    if (res.ok) { setCategories(prev => [...prev, { ...cat, _count: { dishes: 0 } }]); setNewCatName(""); setShowCreateInput(false); }
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
      {/* Hint card */}
      <div style={{
        background: "#FAF9F7", border: "0.5px solid rgba(0,0,0,0.06)", borderRadius: 10,
        padding: "10px 14px", margin: "0 0 14px", display: "flex", gap: 8, alignItems: "center",
      }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#FAEEDA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>
          💡
        </div>
        <span style={{ fontFamily: FB, fontSize: 11, color: "#5a5a5a", lineHeight: 1.4 }}>
          Arrastra para reordenar. El orden se refleja en la carta QR.
        </span>
      </div>

      {/* Create */}
      {showCreateInput ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") createCategory(); if (e.key === "Escape") { setShowCreateInput(false); setNewCatName(""); } }} placeholder="Nombre de la categoría..." autoFocus
            style={{ flex: 1, padding: "10px 14px", background: "#F5F4F1", border: "none", borderRadius: 10, color: "#1a1a1a", fontFamily: F, fontSize: 13, outline: "none" }} />
          <button onClick={createCategory} disabled={!newCatName.trim()} style={{ padding: "10px 16px", background: "#1a1a1a", color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: !newCatName.trim() ? 0.4 : 1 }}>Crear</button>
          <button onClick={() => { setShowCreateInput(false); setNewCatName(""); }} style={{ padding: "10px 12px", background: "transparent", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 10, fontFamily: F, fontSize: 13, color: "#888", cursor: "pointer" }}>Cancelar</button>
        </div>
      ) : (
        <button onClick={() => setShowCreateInput(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "10px 16px", background: "#1a1a1a", color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 16 }}>
          + Nueva categoría
        </button>
      )}

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
              onEditDish={onEditDish}
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
