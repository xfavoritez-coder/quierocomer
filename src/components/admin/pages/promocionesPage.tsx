"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Tag } from "lucide-react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const GOLD = "#F4A623";
const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  SUGGESTED: { label: "Sugerida", color: "#F4A623", bg: "rgba(244,166,35,0.1)" },
  ACTIVE: { label: "Activa", color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  PAUSED: { label: "Pausada", color: "var(--adm-text2)", bg: "var(--adm-hover)" },
};

interface Promo {
  id: string; name: string; description: string | null; dishIds: string[];
  dishes?: { id: string; name: string; price: number; photos: string[] }[];
  originalPrice: number | null; promoPrice: number | null; discountPct: number | null;
  validFrom: string | null; validUntil: string | null; status: string;
  generatedBy: string; aiJustification: string | null; metrics: any;
  promoType?: string; imageUrl?: string | null; thumbUrl?: string | null;
  createdAt: string; targetSegment?: string; emailCopy?: string; dishNames?: string[];
  restaurant?: { name: string; logoUrl?: string | null } | null;
  daysOfWeek?: number[];
  position?: number;
  featured?: boolean;
  modifierTemplates?: { id: string; name: string }[];
}

interface ModOption {
  id: string; name: string; priceAdjustment: number; isDefault?: boolean; isHidden?: boolean; position: number;
}
interface ModGroup {
  id: string; name: string; required: boolean; minSelect: number; maxSelect: number; position: number;
  options: ModOption[];
}
interface ModTemplate {
  id: string; name: string; restaurantId: string;
  groups: ModGroup[];
  dishes?: { id: string; name: string }[];
}

export default function AdminPromociones() {
  const pathname = usePathname();
  const isPanel = pathname.startsWith("/panel");
  const { restaurants, loading: sessionLoading, selectedRestaurantId, isSuper } = useAdminSession();
  const [selectedLocal, setSelectedLocal] = useState<string>("");
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Promo | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editOriginalPrice, setEditOriginalPrice] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editUploading, setEditUploading] = useState(false);

  // Create new promo
  const [creating, setCreating] = useState(false);
  const [createType, setCreateType] = useState<"graphic" | "product" | null>(null);
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cImageUrl, setCImageUrl] = useState("");
  const [cThumbUrl, setCThumbUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [cPromoPrice, setCPromoPrice] = useState("");
  const [cOriginalPrice, setCOriginalPrice] = useState("");
  const [cDiscountPct, setCDiscountPct] = useState("");
  const [cSelectedDishes, setCSelectedDishes] = useState<string[]>([]);
  const [cDaysOfWeek, setCDaysOfWeek] = useState<number[]>([]);
  const [editDaysOfWeek, setEditDaysOfWeek] = useState<number[]>([]);
  const [localDishes, setLocalDishes] = useState<{ id: string; name: string; price: number; photos: string[] }[]>([]);
  const [savingNew, setSavingNew] = useState(false);
  const [dishSearch, setDishSearch] = useState("");
  const [availableTemplates, setAvailableTemplates] = useState<{ id: string; name: string }[]>([]);
  const [cModifierTemplateIds, setCModifierTemplateIds] = useState<string[]>([]);
  const [editModifierTemplateIds, setEditModifierTemplateIds] = useState<string[]>([]);
  const editRef = React.useRef<HTMLDivElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"ofertas" | "modificadores">("ofertas");

  // Modifier templates full data
  const [modTemplates, setModTemplates] = useState<ModTemplate[]>([]);
  const [modLoading, setModLoading] = useState(false);
  const [modNewName, setModNewName] = useState("");
  const [modCreating, setModCreating] = useState(false);
  // Inline editing states
  const [modEditingName, setModEditingName] = useState<{ id: string; name: string } | null>(null);
  const [modAddingGroup, setModAddingGroup] = useState<string | null>(null);
  const [modGroupForm, setModGroupForm] = useState({ name: "", required: false, minSelect: 0, maxSelect: 1 });
  const [modAddingOption, setModAddingOption] = useState<string | null>(null);
  const [modOptionForm, setModOptionForm] = useState({ name: "", priceAdjustment: 0 });
  const [modEditingGroup, setModEditingGroup] = useState<{ id: string; name: string; required: boolean; minSelect: number; maxSelect: number } | null>(null);
  const [modEditingOption, setModEditingOption] = useState<{ id: string; name: string; priceAdjustment: number } | null>(null);

  // Auto-set selectedLocal from session (for owners)
  useEffect(() => {
    if (selectedRestaurantId && !selectedLocal) setSelectedLocal(selectedRestaurantId);
  }, [selectedRestaurantId, selectedLocal]);

  // Load dishes when local changes
  useEffect(() => {
    if (!selectedLocal) { setLocalDishes([]); setAvailableTemplates([]); return; }
    fetch(`/api/admin/dishes?restaurantId=${selectedLocal}`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setLocalDishes(d); })
      .catch(() => {});
    fetch(`/api/admin/modifier-templates?restaurantId=${selectedLocal}&scope=promotion`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAvailableTemplates(d.map((t: any) => ({ id: t.id, name: t.name }))); })
      .catch(() => {});
  }, [selectedLocal]);

  const toggleDishSelection = (id: string) => {
    setCSelectedDishes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectedDishesTotal = cSelectedDishes.reduce((sum, id) => {
    const d = localDishes.find(x => x.id === id);
    return sum + (d?.price || 0);
  }, 0);

  const handlePromoUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "general");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setCImageUrl(data.url);
        setCThumbUrl(data.url);
      } else {
        alert(data.error || "Error al subir imagen");
      }
    } catch (e) {
      alert("Error al subir imagen");
    }
    setUploading(false);
  };

  const handleCreatePromo = async () => {
    if (!selectedLocal || !cName) return;
    setSavingNew(true);
    const body: any = {
      restaurantId: selectedLocal,
      name: cName,
      description: cDesc || null,
      promoType: createType,
      daysOfWeek: cDaysOfWeek.length > 0 ? cDaysOfWeek : [],
    };
    if (createType === "graphic") {
      body.imageUrl = cImageUrl || null;
      body.thumbUrl = cThumbUrl || null;
      body.originalPrice = cOriginalPrice ? Number(cOriginalPrice) : null;
      body.promoPrice = cPromoPrice ? Number(cPromoPrice) : null;
    } else {
      body.dishIds = cSelectedDishes;
      body.originalPrice = selectedDishesTotal;
      body.promoPrice = cPromoPrice ? Number(cPromoPrice) : null;
      body.discountPct = cDiscountPct ? Number(cDiscountPct) : null;
    }
    if (cModifierTemplateIds.length > 0) body.modifierTemplateIds = cModifierTemplateIds;
    const res = await fetch("/api/admin/promotions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.promotion) setPromos(prev => [data.promotion, ...prev]);
    resetCreate();
    setSavingNew(false);
  };

  const resetCreate = () => {
    setCreating(false); setCreateType(null);
    setCName(""); setCDesc(""); setCImageUrl(""); setCThumbUrl(""); setCPromoPrice(""); setCOriginalPrice(""); setCDiscountPct(""); setCSelectedDishes([]); setDishSearch(""); setCModifierTemplateIds([]);
  };

  useEffect(() => {
    if (sessionLoading || !selectedLocal) { setPromos([]); return; }
    setLoading(true);
    fetch(`/api/admin/promotions?restaurantId=${selectedLocal}`)
      .then(r => r.json()).then(d => setPromos(d.promotions || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [selectedLocal, sessionLoading]);

  const handleGenerate = async () => {
    if (!selectedLocal) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest", restaurantId: selectedLocal }),
      });
      const data = await res.json();
      if (data.promotions) setPromos(prev => [...data.promotions, ...prev]);
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  const handleStatus = async (id: string, status: string) => {
    const res = await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) setPromos(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta promoción?")) return;
    await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "DELETED" }),
    });
    setPromos(prev => prev.filter(p => p.id !== id));
  };

  const startEdit = (p: Promo) => {
    setEditing(p);
    setEditName(p.name);
    setEditDesc(p.description || "");
    setEditPrice(p.promoPrice?.toString() || "");
    setEditOriginalPrice(p.originalPrice?.toString() || "");
    setEditImageUrl(p.imageUrl || "");
    setEditDaysOfWeek(p.daysOfWeek || []);
    setEditModifierTemplateIds((p.modifierTemplates || []).map(t => t.id));
    setTimeout(() => editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleEditUpload = async (file: File) => {
    setEditUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("localId", editing?.restaurant?.name || "promo");
      fd.append("dishName", editName || "promo");
      const res = await fetch("/api/admin/upload-dish-image", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setEditImageUrl(data.url);
      else {
        const fd2 = new FormData();
        fd2.append("file", file);
        fd2.append("folder", "general");
        const res2 = await fetch("/api/upload", { method: "POST", body: fd2 });
        const data2 = await res2.json();
        if (data2.url) setEditImageUrl(data2.url);
      }
    } catch {}
    setEditUploading(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body: any = {
      id: editing.id, name: editName, description: editDesc,
      promoPrice: editPrice ? Number(editPrice) : null,
      originalPrice: editOriginalPrice ? Number(editOriginalPrice) : null,
      imageUrl: editImageUrl || null,
      daysOfWeek: editDaysOfWeek.length > 0 ? editDaysOfWeek : [],
      modifierTemplateIds: editModifierTemplateIds,
    };
    const res = await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.promotion) {
      setPromos(prev => prev.map(p => p.id === editing.id ? { ...p, ...body } : p));
    }
    setEditing(null);
  };

  const movePromo = async (id: string, dir: "up" | "down") => {
    const idx = filtered.findIndex(p => p.id === id);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= filtered.length) return;
    const newOrder = [...filtered];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    const ids = newOrder.map(p => p.id);
    // Optimistic update
    setPromos(prev => {
      const copy = [...prev];
      const allIds = ids;
      allIds.forEach((pid, i) => {
        const p = copy.find(x => x.id === pid);
        if (p) p.position = i;
      });
      copy.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      return copy;
    });
    await fetch("/api/admin/promotions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", order: ids, restaurantId: selectedLocal }),
    });
  };

  const toggleFeatured = async (p: Promo) => {
    const newVal = !p.featured;
    setPromos(prev => prev.map(x => x.id === p.id ? { ...x, featured: newVal } : x));
    await fetch("/api/admin/promotions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, featured: newVal }),
    });
  };

  // Fetch full modifier templates when tab is active
  useEffect(() => {
    if (activeTab !== "modificadores" || !selectedLocal) { setModTemplates([]); return; }
    setModLoading(true);
    fetch(`/api/admin/modifier-templates?restaurantId=${selectedLocal}&scope=promotion`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setModTemplates(d); })
      .catch(() => {})
      .finally(() => setModLoading(false));
  }, [activeTab, selectedLocal]);

  const modRefresh = async () => {
    if (!selectedLocal) return;
    const r = await fetch(`/api/admin/modifier-templates?restaurantId=${selectedLocal}&scope=promotion`);
    const d = await r.json();
    if (Array.isArray(d)) setModTemplates(d);
  };

  const modCreateTemplate = async () => {
    if (!selectedLocal || !modNewName.trim()) return;
    setModCreating(true);
    try {
      await fetch("/api/admin/modifier-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedLocal, name: modNewName.trim(), scope: "promotion" }),
      });
      setModNewName("");
      await modRefresh();
      // Also refresh simple list for ofertas tab
      fetch(`/api/admin/modifier-templates?restaurantId=${selectedLocal}&scope=promotion`)
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setAvailableTemplates(d.map((t: any) => ({ id: t.id, name: t.name }))); }).catch(() => {});
    } catch {}
    setModCreating(false);
  };

  const modDeleteTemplate = async (id: string) => {
    if (!confirm("¿Eliminar este template de modificadores y todos sus grupos/opciones?")) return;
    await fetch("/api/admin/modifier-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: id }) });
    await modRefresh();
    fetch(`/api/admin/modifier-templates?restaurantId=${selectedLocal}&scope=promotion`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setAvailableTemplates(d.map((t: any) => ({ id: t.id, name: t.name }))); }).catch(() => {});
  };

  const modUpdateTemplateName = async (id: string, name: string) => {
    await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: id, name }) });
    await modRefresh();
    setModEditingName(null);
  };

  const modAddGroup = async (templateId: string) => {
    if (!modGroupForm.name.trim()) return;
    await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addGroupToTemplate: templateId, ...modGroupForm }) });
    setModAddingGroup(null);
    setModGroupForm({ name: "", required: false, minSelect: 0, maxSelect: 1 });
    await modRefresh();
  };

  const modUpdateGroup = async () => {
    if (!modEditingGroup) return;
    await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: modEditingGroup.id, name: modEditingGroup.name, required: modEditingGroup.required, minSelect: modEditingGroup.minSelect, maxSelect: modEditingGroup.maxSelect }) });
    setModEditingGroup(null);
    await modRefresh();
  };

  const modDeleteGroup = async (id: string) => {
    if (!confirm("¿Eliminar este grupo y todas sus opciones?")) return;
    await fetch("/api/admin/modifier-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: id }) });
    await modRefresh();
  };

  const modAddOption = async (groupId: string) => {
    if (!modOptionForm.name.trim()) return;
    await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addOptionToGroup: groupId, name: modOptionForm.name, priceAdjustment: modOptionForm.priceAdjustment }) });
    setModAddingOption(null);
    setModOptionForm({ name: "", priceAdjustment: 0 });
    await modRefresh();
  };

  const modUpdateOption = async () => {
    if (!modEditingOption) return;
    await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId: modEditingOption.id, name: modEditingOption.name, priceAdjustment: modEditingOption.priceAdjustment }) });
    setModEditingOption(null);
    await modRefresh();
  };

  const modDeleteOption = async (id: string) => {
    await fetch("/api/admin/modifier-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId: id }) });
    await modRefresh();
  };

  const filtered = promos.filter(p => {
    if (p.status === "DELETED") return false;
    if (isPanel && p.status === "SUGGESTED") return false; // Hide suggestions in panel
    if (filter === "all") return true;
    return p.status === filter;
  });

  if (sessionLoading) return <SkeletonLoading type="cards" />;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Tag size={20} color={GOLD} /> {isPanel ? "Ofertas" : "Promociones"}</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>Crea ofertas y descuentos para atraer más clientes</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isPanel && (
            <select
              value={selectedLocal}
              onChange={e => setSelectedLocal(e.target.value)}
              style={{ padding: "8px 12px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}
            >
              <option value="" style={{ background: "var(--adm-select-bg)" }}>Todos los locales</option>
              {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "var(--adm-select-bg)" }}>{r.name}</option>)}
            </select>
          )}
          {!isPanel && selectedLocal && <button onClick={handleGenerate} disabled={generating} style={{
            padding: "8px 16px", background: generating ? "rgba(244,166,35,0.3)" : "#F4A623",
            color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: generating ? "wait" : "pointer",
          }}>
            {generating ? "🧞 Analizando..." : "🧞 Generar sugerencias"}
          </button>}
        </div>
      </div>

      {/* ===== MODIFICADORES (hidden, accessible via Mi Carta) ===== */}
      {false && selectedLocal && (
        <div>
          {/* Create new template */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input placeholder="Nombre del nuevo template..." value={modNewName} onChange={e => setModNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") modCreateTemplate(); }} style={{ ...INP, flex: 1, marginBottom: 0 }} />
            <button onClick={modCreateTemplate} disabled={modCreating || !modNewName.trim()} style={{ padding: "8px 18px", background: "#F4A623", color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", opacity: modCreating || !modNewName.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}>
              {modCreating ? "Creando..." : "+ Crear template"}
            </button>
          </div>

          {modLoading ? <SkeletonLoading type="cards" /> : modTemplates.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <p style={{ fontSize: "2rem", marginBottom: 12 }}>🔧</p>
              <p style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text2)" }}>No hay templates de modificadores</p>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Crea uno para agregar opciones como tamaños, extras, etc.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {modTemplates.map(tpl => {
                // Find which promos use this template
                const usedBy = promos.filter(p => p.modifierTemplates?.some(mt => mt.id === tpl.id));
                return (
                  <div key={tpl.id} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, overflow: "hidden" }}>
                    {/* Template header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--adm-card-border)" }}>
                      {modEditingName?.id === tpl.id ? (
                        <div style={{ display: "flex", gap: 6, flex: 1 }}>
                          <input value={modEditingName.name} onChange={e => setModEditingName({ ...modEditingName, name: e.target.value })} onKeyDown={e => { if (e.key === "Enter") modUpdateTemplateName(tpl.id, modEditingName.name); if (e.key === "Escape") setModEditingName(null); }} autoFocus style={{ ...INP, flex: 1, marginBottom: 0, fontSize: "0.92rem", fontWeight: 600 }} />
                          <button onClick={() => modUpdateTemplateName(tpl.id, modEditingName.name)} style={{ padding: "6px 12px", background: "#F4A623", color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.75rem", cursor: "pointer" }}>OK</button>
                          <button onClick={() => setModEditingName(null)} style={{ padding: "6px 10px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.75rem", cursor: "pointer" }}>X</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                          <span style={{ fontFamily: F, fontSize: "0.95rem", color: "var(--adm-text)", fontWeight: 600 }}>{tpl.name}</span>
                          <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", background: "var(--adm-hover)", padding: "2px 8px", borderRadius: 4 }}>{tpl.groups.length} grupo{tpl.groups.length !== 1 ? "s" : ""}</span>
                          {usedBy.length > 0 && <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#F4A623", background: "rgba(244,166,35,0.1)", padding: "2px 8px", borderRadius: 4 }}>Usado en {usedBy.length} oferta{usedBy.length !== 1 ? "s" : ""}</span>}
                        </div>
                      )}
                      {!modEditingName && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => setModEditingName({ id: tpl.id, name: tpl.name })} style={{ padding: "5px 10px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.72rem", cursor: "pointer" }}>Editar</button>
                          <button onClick={() => modDeleteTemplate(tpl.id)} style={{ padding: "5px 10px", background: "none", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 6, color: "#ff6b6b", fontFamily: F, fontSize: "0.72rem", cursor: "pointer" }}>Eliminar</button>
                        </div>
                      )}
                    </div>

                    {/* Groups */}
                    <div style={{ padding: "12px 16px" }}>
                      {tpl.groups.map(grp => (
                        <div key={grp.id} style={{ marginBottom: 12, background: "var(--adm-hover)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--adm-card-border)" }}>
                          {/* Group header */}
                          {modEditingGroup?.id === grp.id ? (
                            <div style={{ marginBottom: 8 }}>
                              <input value={modEditingGroup.name} onChange={e => setModEditingGroup({ ...modEditingGroup, name: e.target.value })} style={{ ...INP, marginBottom: 6, fontWeight: 600 }} />
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)" }}>
                                  <input type="checkbox" checked={modEditingGroup.required} onChange={e => setModEditingGroup({ ...modEditingGroup, required: e.target.checked })} style={{ accentColor: "#F4A623" }} />
                                  Obligatorio
                                </label>
                                <label style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)" }}>Min: <select value={modEditingGroup.minSelect} onChange={e => setModEditingGroup({ ...modEditingGroup, minSelect: Number(e.target.value) })} style={{ background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 4, color: "var(--adm-text)", fontFamily: F, fontSize: "0.75rem", padding: "2px 4px" }}>{[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                                <label style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)" }}>Max: <select value={modEditingGroup.maxSelect} onChange={e => setModEditingGroup({ ...modEditingGroup, maxSelect: Number(e.target.value) })} style={{ background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 4, color: "var(--adm-text)", fontFamily: F, fontSize: "0.75rem", padding: "2px 4px" }}>{[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={modUpdateGroup} style={{ padding: "5px 12px", background: "#F4A623", color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.75rem", cursor: "pointer" }}>Guardar</button>
                                <button onClick={() => setModEditingGroup(null)} style={{ padding: "5px 10px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.75rem", cursor: "pointer" }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", fontWeight: 600 }}>{grp.name}</span>
                                {grp.required && <span style={{ fontFamily: F, fontSize: "0.62rem", color: "#F4A623", background: "rgba(244,166,35,0.1)", padding: "1px 6px", borderRadius: 3 }}>Obligatorio</span>}
                                <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)" }}>min:{grp.minSelect} max:{grp.maxSelect}</span>
                              </div>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button onClick={() => setModEditingGroup({ id: grp.id, name: grp.name, required: grp.required, minSelect: grp.minSelect, maxSelect: grp.maxSelect })} style={{ padding: "3px 8px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 4, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.68rem", cursor: "pointer" }}>Editar</button>
                                <button onClick={() => modDeleteGroup(grp.id)} style={{ padding: "3px 8px", background: "none", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 4, color: "#ff6b6b", fontFamily: F, fontSize: "0.68rem", cursor: "pointer" }}>X</button>
                              </div>
                            </div>
                          )}

                          {/* Options */}
                          {grp.options.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
                              {grp.options.map(opt => (
                                <div key={opt.id}>
                                  {modEditingOption?.id === opt.id ? (
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0" }}>
                                      <input value={modEditingOption.name} onChange={e => setModEditingOption({ ...modEditingOption, name: e.target.value })} style={{ ...INP, flex: 1, marginBottom: 0, fontSize: "0.78rem", padding: "6px 8px" }} />
                                      <input type="number" value={modEditingOption.priceAdjustment} onChange={e => setModEditingOption({ ...modEditingOption, priceAdjustment: Number(e.target.value) })} style={{ ...INP, width: 80, marginBottom: 0, fontSize: "0.78rem", padding: "6px 8px" }} />
                                      <button onClick={modUpdateOption} style={{ padding: "4px 8px", background: "#F4A623", color: "white", border: "none", borderRadius: 4, fontFamily: F, fontSize: "0.7rem", cursor: "pointer" }}>OK</button>
                                      <button onClick={() => setModEditingOption(null)} style={{ padding: "4px 6px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 4, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.7rem", cursor: "pointer" }}>X</button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: 5, background: opt.isHidden ? "rgba(255,107,107,0.05)" : "transparent" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontFamily: F, fontSize: "0.8rem", color: opt.isHidden ? "var(--adm-text3)" : "var(--adm-text)", textDecoration: opt.isHidden ? "line-through" : "none" }}>{opt.name}</span>
                                        {opt.priceAdjustment !== 0 && <span style={{ fontFamily: F, fontSize: "0.72rem", color: opt.priceAdjustment > 0 ? "#4ade80" : "#ff6b6b" }}>{opt.priceAdjustment > 0 ? "+" : ""}${opt.priceAdjustment.toLocaleString("es-CL")}</span>}
                                      </div>
                                      <div style={{ display: "flex", gap: 3 }}>
                                        <button onClick={() => setModEditingOption({ id: opt.id, name: opt.name, priceAdjustment: opt.priceAdjustment })} style={{ padding: "2px 6px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 3, color: "var(--adm-text3)", fontFamily: F, fontSize: "0.65rem", cursor: "pointer" }}>Editar</button>
                                        <button onClick={() => modDeleteOption(opt.id)} style={{ padding: "2px 6px", background: "none", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 3, color: "#ff6b6b", fontFamily: F, fontSize: "0.65rem", cursor: "pointer" }}>X</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add option form */}
                          {modAddingOption === grp.id ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                              <input placeholder="Nombre opcion" value={modOptionForm.name} onChange={e => setModOptionForm({ ...modOptionForm, name: e.target.value })} onKeyDown={e => { if (e.key === "Enter") modAddOption(grp.id); }} autoFocus style={{ ...INP, flex: 1, marginBottom: 0, fontSize: "0.78rem", padding: "6px 8px" }} />
                              <input type="number" placeholder="$+-" value={modOptionForm.priceAdjustment || ""} onChange={e => setModOptionForm({ ...modOptionForm, priceAdjustment: Number(e.target.value) })} style={{ ...INP, width: 70, marginBottom: 0, fontSize: "0.78rem", padding: "6px 8px" }} />
                              <button onClick={() => modAddOption(grp.id)} style={{ padding: "5px 10px", background: "#F4A623", color: "white", border: "none", borderRadius: 5, fontFamily: F, fontSize: "0.72rem", cursor: "pointer", whiteSpace: "nowrap" }}>+</button>
                              <button onClick={() => { setModAddingOption(null); setModOptionForm({ name: "", priceAdjustment: 0 }); }} style={{ padding: "5px 8px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 5, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.72rem", cursor: "pointer" }}>X</button>
                            </div>
                          ) : (
                            <button onClick={() => { setModAddingOption(grp.id); setModOptionForm({ name: "", priceAdjustment: 0 }); }} style={{ padding: "4px 10px", background: "none", border: "1px dashed var(--adm-card-border)", borderRadius: 5, color: "var(--adm-text3)", fontFamily: F, fontSize: "0.72rem", cursor: "pointer", marginTop: 2 }}>+ Agregar opcion</button>
                          )}
                        </div>
                      ))}

                      {/* Add group form */}
                      {modAddingGroup === tpl.id ? (
                        <div style={{ background: "var(--adm-hover)", borderRadius: 10, padding: "10px 12px", border: "1px dashed rgba(244,166,35,0.3)" }}>
                          <input placeholder="Nombre del grupo" value={modGroupForm.name} onChange={e => setModGroupForm({ ...modGroupForm, name: e.target.value })} onKeyDown={e => { if (e.key === "Enter") modAddGroup(tpl.id); }} autoFocus style={{ ...INP, marginBottom: 6, fontWeight: 600 }} />
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)" }}>
                              <input type="checkbox" checked={modGroupForm.required} onChange={e => setModGroupForm({ ...modGroupForm, required: e.target.checked })} style={{ accentColor: "#F4A623" }} />
                              Obligatorio
                            </label>
                            <label style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)" }}>Min: <select value={modGroupForm.minSelect} onChange={e => setModGroupForm({ ...modGroupForm, minSelect: Number(e.target.value) })} style={{ background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 4, color: "var(--adm-text)", fontFamily: F, fontSize: "0.75rem", padding: "2px 4px" }}>{[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                            <label style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)" }}>Max: <select value={modGroupForm.maxSelect} onChange={e => setModGroupForm({ ...modGroupForm, maxSelect: Number(e.target.value) })} style={{ background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 4, color: "var(--adm-text)", fontFamily: F, fontSize: "0.75rem", padding: "2px 4px" }}>{[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => modAddGroup(tpl.id)} style={{ padding: "6px 14px", background: "#F4A623", color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>Agregar grupo</button>
                            <button onClick={() => { setModAddingGroup(null); setModGroupForm({ name: "", required: false, minSelect: 0, maxSelect: 1 }); }} style={{ padding: "6px 12px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.78rem", cursor: "pointer" }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setModAddingGroup(tpl.id); setModGroupForm({ name: "", required: false, minSelect: 0, maxSelect: 1 }); }} style={{ padding: "6px 14px", background: "none", border: "1px dashed rgba(244,166,35,0.3)", borderRadius: 8, color: "#F4A623", fontFamily: F, fontSize: "0.78rem", cursor: "pointer", marginTop: tpl.groups.length > 0 ? 4 : 0 }}>+ Agregar grupo</button>
                      )}

                      {/* Which promos use this template */}
                      {usedBy.length > 0 && (
                        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--adm-card-border)" }}>
                          <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Usado en ofertas</p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {usedBy.map(p => (
                              <span key={p.id} style={{ fontFamily: F, fontSize: "0.72rem", color: "#F4A623", background: "rgba(244,166,35,0.08)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(244,166,35,0.15)" }}>{p.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== OFERTAS ===== */}
      {<>
      {/* Filters + create button */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, alignItems: "center" }}>
        {[
          { key: "all", label: "Todas" },
          ...(!isPanel ? [{ key: "SUGGESTED", label: "Sugeridas" }] : []),
          { key: "ACTIVE", label: "Activas" },
          { key: "PAUSED", label: "Pausadas" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer",
            fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
            background: filter === f.key ? "var(--adm-card-border)" : "transparent",
            color: filter === f.key ? "var(--adm-text)" : "var(--adm-text3)",
          }}>
            {f.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {selectedLocal && (
          <button onClick={() => creating ? resetCreate() : setCreating(true)} style={{ padding: "8px 16px", background: creating ? "none" : "#F4A623", color: creating ? "var(--adm-text2)" : "white", border: creating ? "1px solid var(--adm-card-border)" : "none", borderRadius: 10, fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            {creating ? "Cancelar" : "+ Crear oferta"}
          </button>
        )}
      </div>

      {/* Create new promo */}
      {creating && !createType && (
        <div style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text)", marginBottom: 16 }}>¿Qué tipo de oferta?</h3>
          <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button onClick={() => setCreateType("graphic")} style={{ padding: "20px 16px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 14, cursor: "pointer", textAlign: "center" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>🖼️</span>
              <span style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text)", fontWeight: 600, display: "block" }}>Gráfica propia</span>
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", display: "block", marginTop: 4 }}>Sube tu diseño o flyer</span>
            </button>
            <button onClick={() => setCreateType("product")} style={{ padding: "20px 16px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 14, cursor: "pointer", textAlign: "center" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>🍽️</span>
              <span style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text)", fontWeight: 600, display: "block" }}>Productos de la carta</span>
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", display: "block", marginTop: 4 }}>Selecciona 1 o más platos</span>
            </button>
          </div>
        </div>
      )}

      {creating && createType === "graphic" && (
        <div style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text)", marginBottom: 16 }}>🖼️ Promoción con gráfica</h3>
          <input placeholder="Nombre de la promoción" value={cName} onChange={e => setCName(e.target.value)} style={INP} />
          <textarea placeholder="Descripción (opcional)" value={cDesc} onChange={e => setCDesc(e.target.value)} rows={2} style={{ ...INP, resize: "vertical" }} />

          {/* File upload */}
          {!cImageUrl ? (
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "24px 16px", background: "var(--adm-hover)", border: "2px dashed var(--adm-card-border)", borderRadius: 12, cursor: uploading ? "wait" : "pointer", marginBottom: 12, transition: "border-color 0.2s" }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#F4A623"; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = "var(--adm-card-border)"; }}
              onDrop={async e => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--adm-card-border)";
                const file = e.dataTransfer.files[0];
                if (file) await handlePromoUpload(file);
              }}
            >
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={async e => {
                const file = e.target.files?.[0];
                if (file) await handlePromoUpload(file);
              }} />
              <span style={{ fontSize: "2rem" }}>{uploading ? "⏳" : "📷"}</span>
              <span style={{ fontFamily: F, fontSize: "0.85rem", color: uploading ? "#F4A623" : "var(--adm-text2)" }}>{uploading ? "Subiendo y optimizando..." : "Toca para subir imagen o arrastra aquí"}</span>
              <span style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)" }}>JPG, PNG o WebP · Máximo 10MB</span>
            </label>
          ) : (
            <div style={{ position: "relative", marginBottom: 12, borderRadius: 12, overflow: "hidden", height: 180 }}>
              <img src={cImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => { setCImageUrl(""); setCThumbUrl(""); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "white", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          )}

          {/* Prices (optional) */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input type="number" placeholder="Precio normal (opcional)" value={cOriginalPrice} onChange={e => setCOriginalPrice(e.target.value)} style={{ ...INP, flex: 1, marginBottom: 0 }} />
            <input type="number" placeholder="Precio promo (opcional)" value={cPromoPrice} onChange={e => setCPromoPrice(e.target.value)} style={{ ...INP, flex: 1, marginBottom: 0 }} />
          </div>

          {/* Modifier templates */}
          {availableTemplates.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Modificadores</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {availableTemplates.map(t => (
                  <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: cModifierTemplateIds.includes(t.id) ? "rgba(244,166,35,0.08)" : "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={cModifierTemplateIds.includes(t.id)} onChange={() => setCModifierTemplateIds(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])} style={{ accentColor: "#F4A623" }} />
                    <span style={{ fontFamily: F, fontSize: "0.82rem", color: cModifierTemplateIds.includes(t.id) ? "#F4A623" : "var(--adm-text)" }}>{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Days of week */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", marginBottom: 6 }}>Días de la semana (vacío = todos los días)</p>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {["D", "L", "M", "Mi", "J", "V", "S"].map((d, i) => (
                <button key={i} onClick={() => setCDaysOfWeek(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: cDaysOfWeek.includes(i) ? "#F4A623" : "var(--adm-hover)", color: cDaysOfWeek.includes(i) ? "#0a0a0a" : "var(--adm-text2)" }}>{d}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleCreatePromo} disabled={savingNew || !cName || !cImageUrl} style={{ flex: 1, padding: "10px", background: "#F4A623", color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: savingNew || !cName || !cImageUrl ? 0.5 : 1 }}>{savingNew ? "Creando..." : "Crear promoción"}</button>
            <button onClick={resetCreate} style={{ padding: "10px 16px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {creating && createType === "product" && (
        <div style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text)", marginBottom: 16 }}>🍽️ Promoción de productos</h3>
          <input placeholder="Nombre de la promoción" value={cName} onChange={e => setCName(e.target.value)} style={INP} />
          <textarea placeholder="Descripción (opcional)" value={cDesc} onChange={e => setCDesc(e.target.value)} rows={2} style={{ ...INP, resize: "vertical" }} />

          {/* Dish selector */}
          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Selecciona platos ({cSelectedDishes.length} seleccionados)</p>
          <input
            placeholder="Buscar plato..."
            value={dishSearch}
            onChange={e => setDishSearch(e.target.value)}
            style={{ ...INP, marginBottom: 0, borderRadius: "10px 10px 0 0", borderBottom: "none" }}
          />
          <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 14, borderRadius: "0 0 10px 10px", border: "1px solid var(--adm-card-border)", scrollbarWidth: "none" }}>
            {localDishes.filter(d => !dishSearch || d.name.toLowerCase().includes(dishSearch.toLowerCase())).map(d => {
              const sel = cSelectedDishes.includes(d.id);
              return (
                <button key={d.id} onClick={() => toggleDishSelection(d.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", width: "100%", background: sel ? "rgba(244,166,35,0.08)" : "transparent", border: "none", borderBottom: "1px solid var(--adm-card-border)", cursor: "pointer", textAlign: "left" }}>
                  {d.photos?.[0] && <img src={d.photos[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                  <span style={{ fontFamily: F, fontSize: "0.82rem", color: sel ? "#F4A623" : "var(--adm-text)", flex: 1, fontWeight: sel ? 600 : 400 }}>{d.name}</span>
                  <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)" }}>${d.price?.toLocaleString("es-CL")}</span>
                  {sel && <span style={{ color: "#F4A623", fontSize: "14px" }}>✓</span>}
                </button>
              );
            })}
          </div>

          {cSelectedDishes.length > 0 && (
            <div style={{ background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.15)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)" }}>Precio original (suma)</span>
                <span style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text)", fontWeight: 600 }}>${selectedDishesTotal.toLocaleString("es-CL")}</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text2)", display: "block", marginBottom: 4 }}>Precio promo</label>
                  <input type="number" placeholder="$" value={cPromoPrice} onChange={e => setCPromoPrice(e.target.value)} style={{ ...INP, marginBottom: 0 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text2)", display: "block", marginBottom: 4 }}>% descuento</label>
                  <input type="number" placeholder="%" value={cDiscountPct} onChange={e => setCDiscountPct(e.target.value)} style={{ ...INP, marginBottom: 0 }} />
                </div>
              </div>
            </div>
          )}

          {/* Modifier templates */}
          {availableTemplates.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Modificadores</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {availableTemplates.map(t => (
                  <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: cModifierTemplateIds.includes(t.id) ? "rgba(244,166,35,0.08)" : "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={cModifierTemplateIds.includes(t.id)} onChange={() => setCModifierTemplateIds(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])} style={{ accentColor: "#F4A623" }} />
                    <span style={{ fontFamily: F, fontSize: "0.82rem", color: cModifierTemplateIds.includes(t.id) ? "#F4A623" : "var(--adm-text)" }}>{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Days of week */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", marginBottom: 6 }}>Días de la semana (vacío = todos los días)</p>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {["D", "L", "M", "Mi", "J", "V", "S"].map((d, i) => (
                <button key={i} onClick={() => setCDaysOfWeek(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: cDaysOfWeek.includes(i) ? "#F4A623" : "var(--adm-hover)", color: cDaysOfWeek.includes(i) ? "#0a0a0a" : "var(--adm-text2)" }}>{d}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleCreatePromo} disabled={savingNew || !cName || cSelectedDishes.length === 0} style={{ flex: 1, padding: "10px", background: "#F4A623", color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: savingNew || !cName || cSelectedDishes.length === 0 ? 0.5 : 1 }}>{savingNew ? "Creando..." : "Crear promoción"}</button>
            <button onClick={resetCreate} style={{ padding: "10px 16px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}


      {/* Edit modal */}
      {editing && (
        <div ref={editRef} style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text)", marginBottom: 16 }}>Editar promoción</h3>
          <input placeholder="Nombre" value={editName} onChange={e => setEditName(e.target.value)} style={I} />
          <textarea placeholder="Descripción" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} style={{ ...I, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input placeholder="Precio normal" type="number" value={editOriginalPrice} onChange={e => setEditOriginalPrice(e.target.value)} style={{ ...I, flex: 1, marginBottom: 0 }} />
            <input placeholder="Precio promo" type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{ ...I, flex: 1, marginBottom: 0 }} />
          </div>
          {/* Image */}
          {editing.promoType === "graphic" && (
            <>
              {editImageUrl ? (
                <div style={{ position: "relative", marginBottom: 12, borderRadius: 12, overflow: "hidden", height: 150 }}>
                  <img src={editImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => setEditImageUrl("")} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "white", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "16px", background: "var(--adm-hover)", border: "2px dashed var(--adm-card-border)", borderRadius: 12, cursor: editUploading ? "wait" : "pointer", marginBottom: 12 }}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={async e => { const f = e.target.files?.[0]; if (f) await handleEditUpload(f); }} />
                  <span style={{ fontFamily: F, fontSize: "0.82rem", color: editUploading ? "#F4A623" : "var(--adm-text2)" }}>{editUploading ? "Subiendo..." : "📷 Cambiar imagen"}</span>
                </label>
              )}
            </>
          )}
          {/* Modifier templates edit */}
          {availableTemplates.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Modificadores</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {availableTemplates.map(t => (
                  <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: editModifierTemplateIds.includes(t.id) ? "rgba(244,166,35,0.08)" : "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={editModifierTemplateIds.includes(t.id)} onChange={() => setEditModifierTemplateIds(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])} style={{ accentColor: "#F4A623" }} />
                    <span style={{ fontFamily: F, fontSize: "0.82rem", color: editModifierTemplateIds.includes(t.id) ? "#F4A623" : "var(--adm-text)" }}>{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {/* Days of week edit */}
          <div style={{ marginTop: 10 }}>
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", marginBottom: 6 }}>Días de la semana (vacío = todos los días)</p>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {["D", "L", "M", "Mi", "J", "V", "S"].map((d, i) => (
                <button key={i} onClick={() => setEditDaysOfWeek(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: editDaysOfWeek.includes(i) ? "#F4A623" : "var(--adm-hover)", color: editDaysOfWeek.includes(i) ? "#0a0a0a" : "var(--adm-text2)" }}>{d}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={saveEdit} style={{ padding: "10px 20px", background: "#F4A623", color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
            <button onClick={() => setEditing(null)} style={{ padding: "10px 20px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonLoading type="cards" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(p => {
            const st = STATUS_STYLES[p.status] || STATUS_STYLES.SUGGESTED;
            const isOpen = expanded === p.id;
            const dishNames = p.dishes?.map(d => d.name) || p.dishNames || [];
            return (
              <div key={p.id} data-promo-id={p.id} style={{ background: p.featured ? "linear-gradient(135deg, var(--adm-card) 0%, rgba(244,166,35,0.06) 100%)" : "var(--adm-card)", border: `1px solid ${p.featured ? "rgba(244,166,35,0.25)" : isOpen ? "rgba(244,166,35,0.3)" : "var(--adm-card-border)"}`, borderRadius: 14, overflow: "hidden", position: "relative" }}>
                {/* Header — draggable from anywhere */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", cursor: isPanel ? "grab" : "pointer", touchAction: isPanel ? "none" : "auto", userSelect: "none" }}
                  onPointerDown={isPanel ? (e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    const card = e.currentTarget.closest("[data-promo-id]") as HTMLElement;
                    if (!card) return;
                    const container = card.parentElement;
                    if (!container) return;
                    const startY = e.clientY;
                    const cardH = card.offsetHeight + 10;
                    let moved = false;
                    card.style.zIndex = "10";

                    const onMove = (ev: PointerEvent) => {
                      const dy = ev.clientY - startY;
                      if (Math.abs(dy) > 5) moved = true;
                      if (moved) {
                        card.style.opacity = "0.85";
                        card.style.transition = "none";
                        card.style.transform = `translateY(${dy}px)`;
                      }
                    };
                    const onUp = (ev: PointerEvent) => {
                      document.removeEventListener("pointermove", onMove);
                      document.removeEventListener("pointerup", onUp);
                      card.style.zIndex = "";
                      card.style.opacity = "";
                      card.style.transform = "";
                      card.style.transition = "";
                      if (moved) {
                        const dy = ev.clientY - startY;
                        const steps = Math.round(dy / cardH);
                        if (steps !== 0) {
                          const dir = steps > 0 ? "down" : "up";
                          for (let i = 0; i < Math.abs(steps); i++) movePromo(p.id, dir);
                        }
                      } else {
                        setExpanded(isOpen ? null : p.id);
                      }
                    };
                    document.addEventListener("pointermove", onMove);
                    document.addEventListener("pointerup", onUp);
                  } : () => setExpanded(isOpen ? null : p.id)}
                >
                  {/* Grip dots — subtle */}
                  {isPanel && (
                    <div style={{ display: "grid", gridTemplateColumns: "3px 3px", gap: 2, flexShrink: 0, opacity: 0.3 }}>
                      {[...Array(6)].map((_, i) => <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--adm-text2)" }} />)}
                    </div>
                  )}
                  {/* Star inline */}
                  {isPanel && (
                    <button onClick={(e) => { e.stopPropagation(); toggleFeatured(p); }} title={p.featured ? "Quitar destacado" : "Destacar"} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "1.1rem", lineHeight: 1, flexShrink: 0 }}>{p.featured ? "⭐" : "☆"}</button>
                  )}
                  {(() => {
                    const thumb = (p.promoType === "graphic" && p.imageUrl) ? (p.thumbUrl || p.imageUrl) : p.dishes?.[0]?.photos?.[0] || null;
                    return thumb ? (
                      <img src={thumb} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(244,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#F4A623", flexShrink: 0 }}>
                        {p.restaurant?.name?.charAt(0) || "🏷️"}
                      </div>
                    );
                  })()}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span style={{ fontSize: "0.58rem", padding: "2px 7px", borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600, flexShrink: 0 }}>{st.label}</span>
                    </div>
                    <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.promoPrice ? `$${p.promoPrice.toLocaleString("es-CL")}` : ""}{p.discountPct ? ` · ${p.discountPct}% off` : ""}{dishNames.length > 0 ? ` · ${dishNames.join(", ")}` : ""}{p.daysOfWeek && p.daysOfWeek.length > 0 ? ` · ${p.daysOfWeek.map(d => ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][d]).join(" · ")}` : ""}
                    </p>
                  </div>
                  <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* Detail */}
                {isOpen && (
                  <div style={{ padding: "12px 18px 18px", borderTop: "1px solid var(--adm-card-border)" }}>
                    {p.description && <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px", lineHeight: 1.5 }}>{p.description}</p>}

                    {p.aiJustification && (
                      <div style={{ background: "rgba(244,166,35,0.05)", border: "1px solid rgba(244,166,35,0.12)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Por qué el Genio lo recomienda</p>
                        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", lineHeight: 1.5, margin: 0 }}>{p.aiJustification}</p>
                      </div>
                    )}

                    {/* Dishes */}
                    {(p.dishes?.length || 0) > 0 && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        {p.dishes!.map(d => (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, padding: "6px 10px" }}>
                            {d.photos?.[0] && <img src={d.photos[0]} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover" }} />}
                            <div>
                              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", margin: 0 }}>{d.name}</p>
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {p.promoPrice && <span style={{ fontFamily: F, fontSize: "0.72rem", color: "#4ade80", fontWeight: 600 }}>${p.promoPrice.toLocaleString("es-CL")}</span>}
                                <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text2)", textDecoration: p.promoPrice ? "line-through" : "none" }}>${d.price.toLocaleString("es-CL")}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Prices */}
                    <div style={{ display: "flex", gap: 12, fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", marginBottom: 14 }}>
                      {p.originalPrice && <span>Original: ${p.originalPrice.toLocaleString("es-CL")}</span>}
                      {p.promoPrice && <span style={{ color: "#4ade80" }}>Promo: ${p.promoPrice.toLocaleString("es-CL")}</span>}
                      {p.discountPct && <span style={{ color: "#F4A623" }}>{p.discountPct}% descuento</span>}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {p.status === "SUGGESTED" && (
                        <>
                          <button onClick={() => handleStatus(p.id, "ACTIVE")} style={btnStyle("#4ade80")}>Aprobar</button>
                          <button onClick={() => handleDelete(p.id)} style={btnStyle("#ff6b6b")}>Descartar</button>
                        </>
                      )}
                      {p.status === "ACTIVE" && (
                        <>
                          <button onClick={() => handleStatus(p.id, "PAUSED")} style={btnStyle("#888")}>Pausar</button>
                          <button onClick={() => startEdit(p)} style={btnStyle("#7fbfdc")}>Editar</button>
                          <button onClick={() => handleDelete(p.id)} style={btnStyle("#ff6b6b")}>Eliminar</button>
                        </>
                      )}
                      {p.status === "PAUSED" && (
                        <>
                          <button onClick={() => handleStatus(p.id, "ACTIVE")} style={btnStyle("#4ade80")}>Activar</button>
                          <button onClick={() => startEdit(p)} style={btnStyle("#7fbfdc")}>Editar</button>
                          <button onClick={() => handleDelete(p.id)} style={btnStyle("#ff6b6b")}>Eliminar</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 60 }}>
              <p style={{ fontSize: "2rem", marginBottom: 12 }}>🏷️</p>
              <p style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text2)" }}>No hay ofertas aún</p>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Crea una oferta para atraer más clientes a tu local</p>
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  );
}

const I: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: "var(--font-display)", fontSize: "0.85rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };
const INP: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: "var(--font-display)", fontSize: "0.82rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };
function btnStyle(color: string): React.CSSProperties {
  return { padding: "8px 16px", background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 8, color, fontFamily: "var(--font-display)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" };
}
