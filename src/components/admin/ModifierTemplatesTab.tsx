"use client";

import { useState, useEffect, useRef } from "react";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { norm } from "@/lib/normalize";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";
const LBL: React.CSSProperties = { fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 };
const INP: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" as const };

interface Option { id: string; name: string; description?: string | null; imageUrl?: string | null; priceAdjustment: number; isDefault: boolean; isHidden?: boolean; position: number; }
interface Group { id: string; name: string; required: boolean; minSelect: number; maxSelect: number; position: number; options: Option[]; }
interface Template { id: string; name: string; groups: Group[]; dishes: { id: string; name: string }[]; }
interface DishRef { id: string; name: string; categoryId?: string; categoryName?: string; }

interface Props { restaurantId: string; }

export default function ModifierTemplatesTab({ restaurantId }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Editing
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [etName, setEtName] = useState("");
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [egName, setEgName] = useState("");
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [eoName, setEoName] = useState("");
  const [eoPrice, setEoPrice] = useState("");
  const [eoDesc, setEoDesc] = useState("");
  const [eoImage, setEoImage] = useState("");
  const [eoUploading, setEoUploading] = useState(false);
  const [addingGroupTo, setAddingGroupTo] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [addingOptionTo, setAddingOptionTo] = useState<string | null>(null);
  const [newOptName, setNewOptName] = useState("");
  const [newOptPrice, setNewOptPrice] = useState("");
  const [allDishes, setAllDishes] = useState<DishRef[]>([]);
  const [dishPickerFor, setDishPickerFor] = useState<string | null>(null);
  const [dishSearch, setDishSearch] = useState("");
  const [pickerMode, setPickerMode] = useState<"dish" | "category">("dish");
  const [pickerOpensUp, setPickerOpensUp] = useState(false);
  const [pickerAlignRight, setPickerAlignRight] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const showSaved = (msg = "Guardado") => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(null), 2000);
  };

  // Close dish picker on outside click
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dishPickerFor) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setDishPickerFor(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dishPickerFor]);

  // Listen for FAB click from parent
  useEffect(() => {
    const handler = () => setCreating(true);
    window.addEventListener("mod-fab-click", handler);
    return () => window.removeEventListener("mod-fab-click", handler);
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/admin/modifier-templates?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTemplates(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch(`/api/admin/dishes?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setAllDishes(d.map((x: any) => ({ id: x.id, name: x.name, categoryId: x.category?.id, categoryName: x.category?.name })));
          // Extract unique categories
          const catMap = new Map<string, string>();
          for (const x of d) { if (x.category) catMap.set(x.category.id, x.category.name); }
          setCategories([...catMap.entries()].map(([id, name]) => ({ id, name })));
        }
      })
      .catch(() => {});
  }, [restaurantId]);

  const createTemplate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/modifier-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, name: newName.trim() }),
    });
    const t = await res.json();
    if (res.ok) { setTemplates(prev => [t, ...prev]); setNewName(""); setCreating(false); setExpanded(t.id); showSaved("Modificador creado"); }
    setSaving(false);
  };

  const renameTemplate = async (id: string) => {
    if (!etName.trim()) return;
    await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: id, name: etName.trim() }) });
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: etName.trim() } : t));
    setEditingTemplate(null);
    showSaved();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("¿Eliminar este modificador y todas sus opciones?")) return;
    await fetch("/api/admin/modifier-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: id }) });
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const addGroup = async (templateId: string, name: string) => {
    if (!name.trim()) return;
    const res = await fetch("/api/admin/modifier-templates", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addGroupToTemplate: templateId, name: name.trim(), required: true, maxSelect: 1 }),
    });
    const group = await res.json();
    if (res.ok) {
      setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: [...t.groups, { ...group, options: group.options || [] }] } : t));
      setAddingGroupTo(null);
      setNewGroupName("");
      showSaved("Grupo creado");
    }
  };

  const updateGroup = async (templateId: string, groupId: string, data: Record<string, any>) => {
    await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId, ...data }) });
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: t.groups.map(g => g.id === groupId ? { ...g, ...data } : g) } : t));
    showSaved();
  };

  const deleteGroup = async (templateId: string, groupId: string) => {
    await fetch("/api/admin/modifier-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId }) });
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: t.groups.filter(g => g.id !== groupId) } : t));
  };

  const addOption = async (templateId: string, groupId: string, name: string, price: string) => {
    if (!name.trim()) return;
    const res = await fetch("/api/admin/modifier-templates", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addOptionToGroup: groupId, name: name.trim(), priceAdjustment: price ? Number(price) : 0 }),
    });
    const opt = await res.json();
    if (res.ok) {
      setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: t.groups.map(g => g.id === groupId ? { ...g, options: [...g.options, opt] } : g) } : t));
      setAddingOptionTo(null);
      setNewOptName("");
      setNewOptPrice("");
      showSaved("Opción agregada");
    }
  };

  const saveOption = async (templateId: string, groupId: string) => {
    if (!editingOption || !eoName.trim()) return;
    const payload: Record<string, any> = { optionId: editingOption, name: eoName.trim(), priceAdjustment: Number(eoPrice) || 0 };
    if (eoDesc !== undefined) payload.description = eoDesc || null;
    if (eoImage !== undefined) payload.imageUrl = eoImage || null;
    await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: t.groups.map(g => g.id === groupId ? { ...g, options: g.options.map(o => o.id === editingOption ? { ...o, name: eoName.trim(), priceAdjustment: Number(eoPrice) || 0, description: eoDesc || null, imageUrl: eoImage || null } : o) } : g) } : t));
    setEditingOption(null);
    showSaved();
  };

  const deleteOption = async (templateId: string, groupId: string, optionId: string) => {
    await fetch("/api/admin/modifier-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId }) });
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: t.groups.map(g => g.id === groupId ? { ...g, options: g.options.filter(o => o.id !== optionId) } : g) } : t));
  };

  const assignCategory = async (templateId: string, categoryId: string) => {
    const catDishes = allDishes.filter(d => d.categoryId === categoryId && !templates.find(t => t.id === templateId)?.dishes.some(td => td.id === d.id));
    if (catDishes.length === 0) return;
    const promises = catDishes.map(d =>
      fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId, assignDishId: d.id }) })
    );
    await Promise.all(promises);
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, dishes: [...t.dishes, ...catDishes.map(d => ({ id: d.id, name: d.name }))] } : t));
    setDishPickerFor(null);
    setDishSearch("");
    showSaved(`${catDishes.length} platos agregados`);
  };

  if (loading) return <SkeletonLoading type="cards" />;

  return (
    <div>
      <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Crea modificadores reutilizables y asígnalos a tus platos. Si cambias una opción aquí, se actualiza en todos los platos que la usen.
      </p>

      {/* Saved toast */}
      {savedMsg && (
        <div style={{ position: "fixed", top: 20, right: 20, background: "#16a34a", color: "white", padding: "8px 20px", borderRadius: 999, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", animation: "fadeInDown 0.2s ease" }}>
          ✓ {savedMsg}
        </div>
      )}

      {/* Create */}
      {creating ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && createTemplate()} placeholder='Ej: "Extras pizza", "Tamaños", "Salsas"' style={{ flex: 1, padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }} autoFocus />
          <button onClick={createTemplate} disabled={saving || !newName.trim()} style={{ padding: "10px 18px", background: GOLD, color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: !newName.trim() ? 0.5 : 1 }}>Crear</button>
          <button onClick={() => { setCreating(false); setNewName(""); }} style={{ padding: "10px 14px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", cursor: "pointer" }}>X</button>
        </div>
      ) : (
        <div className="lnd-desktop-only" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <button onClick={() => setCreating(true)} style={{ padding: "10px 18px", background: GOLD, color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>+ Nuevo modificador</button>
        </div>
      )}

      {/* Templates list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {templates.map(template => {
          const isExpanded = expanded === template.id;
          return (
            <div key={template.id} style={{ border: "1px solid var(--adm-card-border)", borderRadius: 14, overflow: "hidden", background: "var(--adm-card)" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
                {editingTemplate === template.id ? (
                  <>
                    <input value={etName} onChange={e => setEtName(e.target.value)} onKeyDown={e => e.key === "Enter" && renameTemplate(template.id)} style={{ flex: 1, padding: "6px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.92rem", fontWeight: 700, outline: "none" }} autoFocus />
                    <button onClick={() => renameTemplate(template.id)} style={{ padding: "4px 10px", background: GOLD, color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", fontWeight: 700, cursor: "pointer" }}>OK</button>
                    <button onClick={() => setEditingTemplate(null)} style={{ padding: "4px 10px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", cursor: "pointer" }}>X</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setExpanded(isExpanded ? null : template.id)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)" }}>{template.name}</span>
                        <span onClick={(e) => { e.stopPropagation(); setEditingTemplate(template.id); setEtName(template.name); }} style={{ fontSize: "0.65rem", cursor: "pointer", opacity: 0.5 }}>✏️</span>
                      </span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{template.groups.length} grupo{template.groups.length !== 1 ? "s" : ""}{template.dishes.length > 0 ? ` · ${template.dishes.length} plato${template.dishes.length !== 1 ? "s" : ""}` : ""}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--adm-text3)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
                    </button>
                  </>
                )}
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--adm-card-border)" }}>
                  {/* Assigned dishes */}
                  <div style={{ margin: "12px 0" }}>
                    {template.dishes.length > 0 && <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Platos asignados</p>}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                      {template.dishes.map(d => (
                        <span key={d.id} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.72rem", padding: "3px 10px", borderRadius: 50, background: "rgba(244,166,35,0.08)", color: GOLD, fontFamily: FB }}>
                          {d.name}
                          <span onClick={async () => {
                            await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: template.id, unassignDishId: d.id }) });
                            setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, dishes: t.dishes.filter(x => x.id !== d.id) } : t));
                          }} style={{ cursor: "pointer", fontSize: "0.78rem", opacity: 0.6, marginLeft: 4, lineHeight: 1 }}>×</span>
                        </span>
                      ))}
                    </div>

                    {/* Add dish button */}
                    <div ref={dishPickerFor === template.id ? pickerRef : undefined} style={{ position: "relative" }}>
                      <button onClick={(e) => {
                        if (dishPickerFor === template.id) { setDishPickerFor(null); return; }
                        // Decide whether to open the dropdown above or below, and
                        // whether to align left or right, based on remaining space.
                        // Esto evita que el picker se corte fuera de la pantalla
                        // en moviles o cuando el boton esta cerca del borde.
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const dropdownH = 320;
                        const dropdownW = 260;
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const spaceRight = window.innerWidth - rect.left;
                        setPickerOpensUp(spaceBelow < dropdownH && rect.top > spaceBelow);
                        setPickerAlignRight(spaceRight < dropdownW + 16);
                        setDishPickerFor(template.id);
                        setPickerMode("dish");
                        setDishSearch("");
                      }}
                        style={{ fontSize: "0.78rem", padding: "6px 14px", borderRadius: 8, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", color: GOLD, cursor: "pointer", fontFamily: F, fontWeight: 600 }}>
                        + Agregar platos
                      </button>

                      {/* Picker dropdown */}
                      {dishPickerFor === template.id && (
                        <div style={{ position: "absolute", ...(pickerOpensUp ? { bottom: "100%", marginBottom: 4 } : { top: "100%", marginTop: 4 }), ...(pickerAlignRight ? { right: 0 } : { left: 0 }), background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 100, width: "min(260px, calc(100vw - 32px))", overflow: "hidden" }}>
                          {/* Mode tabs */}
                          <div style={{ display: "flex", borderBottom: "1px solid var(--adm-card-border)" }}>
                            <button onClick={() => setPickerMode("dish")} style={{ flex: 1, padding: "8px", background: pickerMode === "dish" ? "var(--adm-hover)" : "none", border: "none", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: pickerMode === "dish" ? GOLD : "var(--adm-text3)", cursor: "pointer" }}>Platos</button>
                            <button onClick={() => setPickerMode("category")} style={{ flex: 1, padding: "8px", background: pickerMode === "category" ? "var(--adm-hover)" : "none", border: "none", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: pickerMode === "category" ? GOLD : "var(--adm-text3)", cursor: "pointer" }}>Categorías</button>
                          </div>

                          {pickerMode === "dish" ? (
                            <>
                              <input value={dishSearch} onChange={e => setDishSearch(e.target.value)} placeholder="Buscar plato..."
                                style={{ width: "100%", padding: "8px 12px", border: "none", borderBottom: "1px solid var(--adm-card-border)", background: "transparent", fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box" }} autoFocus />
                              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                {allDishes
                                  .filter(d => !template.dishes.some(td => td.id === d.id) && (!dishSearch || norm(d.name).includes(norm(dishSearch))))
                                  .slice(0, 20)
                                  .map(d => (
                                    <button key={d.id} onClick={async () => {
                                      await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: template.id, assignDishId: d.id }) });
                                      setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, dishes: [...t.dishes, { id: d.id, name: d.name }] } : t));
                                      showSaved("Plato agregado");
                                    }} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", textAlign: "left", cursor: "pointer", fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)" }}>
                                      <span>{d.name}</span>
                                      {d.categoryName && <span style={{ fontSize: "0.65rem", color: "var(--adm-text3)" }}>{d.categoryName}</span>}
                                    </button>
                                  ))}
                                {allDishes.filter(d => !template.dishes.some(td => td.id === d.id) && (!dishSearch || norm(d.name).includes(norm(dishSearch)))).length === 0 && (
                                  <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", textAlign: "center", padding: 12, margin: 0 }}>Sin resultados</p>
                                )}
                              </div>
                            </>
                          ) : (
                            <div style={{ maxHeight: 200, overflowY: "auto" }}>
                              {categories.map(cat => {
                                const catDishCount = allDishes.filter(d => d.categoryId === cat.id).length;
                                const alreadyAssigned = allDishes.filter(d => d.categoryId === cat.id && template.dishes.some(td => td.id === d.id)).length;
                                const toAdd = catDishCount - alreadyAssigned;
                                return (
                                  <button key={cat.id} onClick={() => assignCategory(template.id, cat.id)} disabled={toAdd === 0}
                                    style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "10px 12px", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", textAlign: "left", cursor: toAdd > 0 ? "pointer" : "default", fontFamily: F, fontSize: "0.78rem", color: toAdd > 0 ? "var(--adm-text)" : "var(--adm-text3)" }}>
                                    <span>{cat.name}</span>
                                    <span style={{ fontSize: "0.68rem", color: toAdd > 0 ? GOLD : "var(--adm-text3)" }}>
                                      {toAdd > 0 ? `+${toAdd} platos` : "Ya asignados"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <button onClick={() => setDishPickerFor(null)} style={{ width: "100%", padding: "8px", background: "var(--adm-hover)", border: "none", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", cursor: "pointer" }}>Cerrar</button>
                        </div>
                      )}
                    </div>

                    {template.dishes.length === 0 && <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "8px 0 0" }}>Sin platos asignados</p>}
                  </div>

                  {/* Groups */}
                  {template.groups.map(group => (
                    <div key={group.id} style={{ border: "1px solid var(--adm-card-border)", borderRadius: 10, marginTop: 12, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--adm-hover)" }}>
                        {editingGroup === group.id ? (
                          <>
                            <input value={egName} onChange={e => setEgName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { updateGroup(template.id, group.id, { name: egName.trim() }); setEditingGroup(null); } }} style={{ flex: 1, padding: "4px 8px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 6, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, outline: "none" }} autoFocus />
                            <button onClick={() => { updateGroup(template.id, group.id, { name: egName.trim() }); setEditingGroup(null); }} style={{ padding: "3px 8px", background: GOLD, color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.62rem", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
                            <button onClick={() => setEditingGroup(null)} style={{ padding: "3px 8px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.62rem", color: "var(--adm-text3)", cursor: "pointer" }}>X</button>
                          </>
                        ) : (
                          <>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flex: 1 }}>
                              <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)" }}>{group.name}</span>
                              <span onClick={() => { setEditingGroup(group.id); setEgName(group.name); }} style={{ fontSize: "0.6rem", cursor: "pointer", opacity: 0.5 }}>✏️</span>
                            </span>
                            <button onClick={() => updateGroup(template.id, group.id, { required: !group.required, minSelect: !group.required ? 1 : 0 })} style={{ padding: "2px 8px", borderRadius: 6, border: "none", fontSize: "0.62rem", fontFamily: F, fontWeight: 600, cursor: "pointer", background: group.required ? "rgba(244,166,35,0.12)" : "var(--adm-card)", color: group.required ? GOLD : "var(--adm-text3)" }}>
                              {group.required ? "Obligatorio" : "Opcional"}
                            </button>
                          </>
                        )}
                        {group.maxSelect > 1 && <span style={{ fontFamily: F, fontSize: "0.62rem", color: "var(--adm-text3)" }}>máx {group.maxSelect}</span>}
                        <button onClick={() => deleteGroup(template.id, group.id)} style={{ padding: "2px 8px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontSize: "0.62rem", fontFamily: F, color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>Eliminar</button>
                      </div>
                      <div style={{ padding: "6px 12px 10px" }}>
                        {group.options.map(opt => (
                          <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--adm-card-border)", opacity: opt.isHidden ? 0.4 : 1, transition: "opacity 0.2s" }}>
                            {editingOption === opt.id ? (
                              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <input value={eoName} onChange={e => setEoName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveOption(template.id, group.id)} placeholder="Nombre de la opción" style={{ ...INP, flex: 1 }} autoFocus />
                                  <div style={{ width: 75 }}><input type="number" value={eoPrice} onChange={e => setEoPrice(e.target.value)} onKeyDown={e => e.key === "Enter" && saveOption(template.id, group.id)} placeholder="+$" style={{ ...INP, textAlign: "right" as const }} /></div>
                                </div>
                                <input value={eoDesc} onChange={e => setEoDesc(e.target.value)} placeholder="Descripción (opcional)" style={INP} />
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <div style={{ flex: 1 }} />
                                  <button onClick={() => saveOption(template.id, group.id)} style={{ padding: "5px 12px", background: GOLD, color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
                                  <button onClick={() => setEditingOption(null)} style={{ padding: "5px 12px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", cursor: "pointer" }}>X</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div onClick={() => { setEditingOption(opt.id); setEoName(opt.name); setEoPrice(String(opt.priceAdjustment)); setEoDesc(opt.description || ""); setEoImage(opt.imageUrl || ""); }} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: "pointer", minWidth: 0 }}>
                                  <span style={{ fontFamily: FB, fontSize: "0.82rem", color: opt.isHidden ? "var(--adm-text3)" : "var(--adm-text)", flex: 1, textDecoration: opt.isHidden ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.name}</span>
                                  {opt.isHidden && <span style={{ fontSize: "0.58rem", padding: "1px 6px", borderRadius: 4, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontFamily: F, fontWeight: 600, flexShrink: 0 }}>Oculto</span>}
                                  {opt.description && <span style={{ fontSize: "0.6rem", flexShrink: 0 }}>📝</span>}
                                  {opt.priceAdjustment !== 0 && <span style={{ fontFamily: F, fontSize: "0.75rem", color: opt.priceAdjustment > 0 ? GOLD : "#4ade80", fontWeight: 600, flexShrink: 0 }}>{opt.priceAdjustment > 0 ? "+" : ""}${Math.abs(opt.priceAdjustment).toLocaleString("es-CL")}</span>}
                                </div>
                                <button onClick={async (e) => { e.stopPropagation(); const newHidden = !opt.isHidden; await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId: opt.id, isHidden: newHidden }) }); setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, groups: t.groups.map(g => g.id === group.id ? { ...g, options: g.options.map(o => o.id === opt.id ? { ...o, isHidden: newHidden } : o) } : g) } : t)); }} style={{ padding: "2px 8px", background: opt.isHidden ? "rgba(74,222,128,0.1)" : "rgba(255,170,0,0.08)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.62rem", color: opt.isHidden ? "#4ade80" : "#b88a00", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                                  {opt.isHidden ? "Mostrar" : "Ocultar"}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar "${opt.name}"?`)) deleteOption(template.id, group.id, opt.id); }} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontSize: "1rem", color: "#ef4444", cursor: "pointer", flexShrink: 0 }}>×</button>
                              </>
                            )}
                          </div>
                        ))}
                        {addingOptionTo === group.id ? (
                          <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
                            <input value={newOptName} onChange={e => setNewOptName(e.target.value)} onKeyDown={e => e.key === "Enter" && addOption(template.id, group.id, newOptName, newOptPrice)}
                              placeholder="Ej: Panko, Sésamo, Salmón..."
                              style={{ flex: 1, padding: "6px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", outline: "none" }} autoFocus />
                            <input value={newOptPrice} onChange={e => setNewOptPrice(e.target.value)} onKeyDown={e => e.key === "Enter" && addOption(template.id, group.id, newOptName, newOptPrice)}
                              placeholder="+$"
                              style={{ width: 65, padding: "6px 8px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", outline: "none", textAlign: "right" as const }} />
                            <button onClick={() => addOption(template.id, group.id, newOptName, newOptPrice)} disabled={!newOptName.trim()} style={{ padding: "6px 10px", background: GOLD, color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", fontWeight: 700, cursor: "pointer", opacity: !newOptName.trim() ? 0.5 : 1 }}>Crear</button>
                            <button onClick={() => { setAddingOptionTo(null); setNewOptName(""); setNewOptPrice(""); }} style={{ padding: "4px 8px", background: "none", border: "none", color: "var(--adm-text3)", cursor: "pointer", fontSize: "0.65rem" }}>×</button>
                          </div>
                        ) : (
                          <button onClick={() => setAddingOptionTo(group.id)} style={{ marginTop: 8, padding: "5px 12px", background: "none", border: "1px dashed var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.72rem", color: GOLD, cursor: "pointer", width: "100%" }}>+ Agregar opción</button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: 12 }}>
                    {addingGroupTo === template.id ? (
                      <div style={{ border: "1px dashed var(--adm-card-border)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                        <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && addGroup(template.id, newGroupName)}
                          placeholder="Ej: Elige tu masa, Tipo de cocción..."
                          style={{ width: "100%", padding: "8px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box" as const, marginBottom: 4 }} autoFocus />
                        <p style={{ fontFamily: F, fontSize: "0.75rem", color: "#F4A623", margin: "0 0 10px", lineHeight: 1.4, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>⚠️ Este titulo se muestra al cliente en la carta</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => addGroup(template.id, newGroupName)} disabled={!newGroupName.trim()} style={{ padding: "6px 14px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", opacity: !newGroupName.trim() ? 0.5 : 1 }}>Crear grupo</button>
                          <button onClick={() => { setAddingGroupTo(null); setNewGroupName(""); }} style={{ padding: "6px 12px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", cursor: "pointer" }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setAddingGroupTo(template.id)} style={{ padding: "8px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: GOLD, cursor: "pointer", fontWeight: 600 }}>+ Crear grupo</button>
                        <button onClick={() => deleteTemplate(template.id)} style={{ padding: "8px 14px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>Eliminar modificador</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {templates.length === 0 && !creating && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text3)", marginBottom: 4 }}>Sin modificadores</p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Crea tu primer modificador para ofrecer opciones como envolturas, tamaños o extras.</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInDown { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  );
}
