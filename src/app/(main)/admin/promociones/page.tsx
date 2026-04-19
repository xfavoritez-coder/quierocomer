"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  SUGGESTED: { label: "Sugerida", color: "#F4A623", bg: "rgba(244,166,35,0.1)" },
  ACTIVE: { label: "Activa", color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  PAUSED: { label: "Pausada", color: "#888", bg: "rgba(255,255,255,0.05)" },
};

interface Promo {
  id: string; name: string; description: string | null; dishIds: string[];
  dishes?: { id: string; name: string; price: number; photos: string[] }[];
  originalPrice: number | null; promoPrice: number | null; discountPct: number | null;
  validFrom: string | null; validUntil: string | null; status: string;
  generatedBy: string; aiJustification: string | null; metrics: any;
  createdAt: string; targetSegment?: string; emailCopy?: string; dishNames?: string[];
  restaurant?: { name: string; logoUrl?: string | null } | null;
}

export default function AdminPromociones() {
  const { restaurants, loading: sessionLoading } = useAdminSession();
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

  // Create new promo
  const [creating, setCreating] = useState(false);
  const [createType, setCreateType] = useState<"graphic" | "product" | null>(null);
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cImageUrl, setCImageUrl] = useState("");
  const [cThumbUrl, setCThumbUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [cPromoPrice, setCPromoPrice] = useState("");
  const [cDiscountPct, setCDiscountPct] = useState("");
  const [cSelectedDishes, setCSelectedDishes] = useState<string[]>([]);
  const [localDishes, setLocalDishes] = useState<{ id: string; name: string; price: number; photos: string[] }[]>([]);
  const [savingNew, setSavingNew] = useState(false);

  // Load dishes when local changes
  useEffect(() => {
    if (!selectedLocal) { setLocalDishes([]); return; }
    fetch(`/api/admin/dishes?restaurantId=${selectedLocal}`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setLocalDishes(d); })
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
      fd.append("localId", selectedLocal || "promo");
      fd.append("dishName", cName || "promo");
      const res = await fetch("/api/admin/upload-dish-image", { method: "POST", body: fd });
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
    };
    if (createType === "graphic") {
      body.imageUrl = cImageUrl || null;
      body.thumbUrl = cThumbUrl || null;
    } else {
      body.dishIds = cSelectedDishes;
      body.originalPrice = selectedDishesTotal;
      body.promoPrice = cPromoPrice ? Number(cPromoPrice) : null;
      body.discountPct = cDiscountPct ? Number(cDiscountPct) : null;
    }
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
    setCName(""); setCDesc(""); setCImageUrl(""); setCPromoPrice(""); setCDiscountPct(""); setCSelectedDishes([]);
  };

  useEffect(() => {
    if (sessionLoading) return;
    setLoading(true);
    const url = selectedLocal
      ? `/api/admin/promotions?restaurantId=${selectedLocal}`
      : `/api/admin/promotions?all=true`;
    fetch(url)
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
  };

  const saveEdit = async () => {
    if (!editing) return;
    const res = await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, name: editName, description: editDesc, promoPrice: editPrice ? Number(editPrice) : null }),
    });
    const data = await res.json();
    if (data.promotion) {
      setPromos(prev => prev.map(p => p.id === editing.id ? { ...p, name: editName, description: editDesc, promoPrice: editPrice ? Number(editPrice) : null } : p));
    }
    setEditing(null);
  };

  const filtered = promos.filter(p => {
    if (p.status === "DELETED") return false;
    if (filter === "all") return true;
    return p.status === filter;
  });

  if (sessionLoading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando...</p>;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Promociones</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <select
            value={selectedLocal}
            onChange={e => setSelectedLocal(e.target.value)}
            style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none" }}
          >
            <option value="" style={{ background: "#1A1A1A" }}>Todos los locales</option>
            {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
          </select>
          {selectedLocal && !creating && <button onClick={() => setCreating(true)} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid #2A2A2A", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "white", cursor: "pointer" }}>+ Crear promo</button>}
          {selectedLocal && <button onClick={handleGenerate} disabled={generating} style={{
            padding: "8px 16px", background: generating ? "rgba(244,166,35,0.3)" : "#F4A623",
            color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: generating ? "wait" : "pointer",
          }}>
            {generating ? "🧞 Analizando..." : "🧞 Generar sugerencias"}
          </button>}
        </div>
      </div>

      {/* Create new promo */}
      {creating && !createType && (
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "white", marginBottom: 16 }}>¿Qué tipo de promoción?</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button onClick={() => setCreateType("graphic")} style={{ padding: "20px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid #2A2A2A", borderRadius: 14, cursor: "pointer", textAlign: "center" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>🖼️</span>
              <span style={{ fontFamily: F, fontSize: "0.92rem", color: "white", fontWeight: 600, display: "block" }}>Gráfica propia</span>
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "#999", display: "block", marginTop: 4 }}>Sube tu diseño o flyer</span>
            </button>
            <button onClick={() => setCreateType("product")} style={{ padding: "20px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid #2A2A2A", borderRadius: 14, cursor: "pointer", textAlign: "center" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>🍽️</span>
              <span style={{ fontFamily: F, fontSize: "0.92rem", color: "white", fontWeight: 600, display: "block" }}>Productos de la carta</span>
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "#999", display: "block", marginTop: 4 }}>Selecciona 1 o más platos</span>
            </button>
          </div>
          <button onClick={resetCreate} style={{ marginTop: 14, background: "none", border: "none", color: "#888", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Cancelar</button>
        </div>
      )}

      {creating && createType === "graphic" && (
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "white", marginBottom: 16 }}>🖼️ Promoción con gráfica</h3>
          <input placeholder="Nombre de la promoción" value={cName} onChange={e => setCName(e.target.value)} style={INP} />
          <textarea placeholder="Descripción (opcional)" value={cDesc} onChange={e => setCDesc(e.target.value)} rows={2} style={{ ...INP, resize: "vertical" }} />

          {/* File upload */}
          {!cImageUrl ? (
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "24px 16px", background: "rgba(255,255,255,0.03)", border: "2px dashed #2A2A2A", borderRadius: 12, cursor: uploading ? "wait" : "pointer", marginBottom: 12, transition: "border-color 0.2s" }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#F4A623"; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = "#2A2A2A"; }}
              onDrop={async e => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "#2A2A2A";
                const file = e.dataTransfer.files[0];
                if (file) await handlePromoUpload(file);
              }}
            >
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={async e => {
                const file = e.target.files?.[0];
                if (file) await handlePromoUpload(file);
              }} />
              <span style={{ fontSize: "2rem" }}>{uploading ? "⏳" : "📷"}</span>
              <span style={{ fontFamily: F, fontSize: "0.85rem", color: uploading ? "#F4A623" : "#888" }}>{uploading ? "Subiendo y optimizando..." : "Toca para subir imagen o arrastra aquí"}</span>
              <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#555" }}>JPG, PNG o WebP · Máximo 10MB</span>
            </label>
          ) : (
            <div style={{ position: "relative", marginBottom: 12, borderRadius: 12, overflow: "hidden", height: 180 }}>
              <img src={cImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => { setCImageUrl(""); setCThumbUrl(""); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "white", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleCreatePromo} disabled={savingNew || !cName || !cImageUrl} style={{ flex: 1, padding: "10px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: savingNew || !cName || !cImageUrl ? 0.5 : 1 }}>{savingNew ? "Creando..." : "Crear promoción"}</button>
            <button onClick={resetCreate} style={{ padding: "10px 16px", background: "none", border: "1px solid #2A2A2A", borderRadius: 10, color: "#888", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {creating && createType === "product" && (
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "white", marginBottom: 16 }}>🍽️ Promoción de productos</h3>
          <input placeholder="Nombre de la promoción" value={cName} onChange={e => setCName(e.target.value)} style={INP} />
          <textarea placeholder="Descripción (opcional)" value={cDesc} onChange={e => setCDesc(e.target.value)} rows={2} style={{ ...INP, resize: "vertical" }} />

          {/* Dish selector */}
          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Selecciona platos ({cSelectedDishes.length} seleccionados)</p>
          <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 14, borderRadius: 10, border: "1px solid #2A2A2A", scrollbarWidth: "none" }}>
            {localDishes.map(d => {
              const sel = cSelectedDishes.includes(d.id);
              return (
                <button key={d.id} onClick={() => toggleDishSelection(d.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", width: "100%", background: sel ? "rgba(244,166,35,0.08)" : "transparent", border: "none", borderBottom: "1px solid #2A2A2A", cursor: "pointer", textAlign: "left" }}>
                  {d.photos?.[0] && <img src={d.photos[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                  <span style={{ fontFamily: F, fontSize: "0.82rem", color: sel ? "#F4A623" : "white", flex: 1, fontWeight: sel ? 600 : 400 }}>{d.name}</span>
                  <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#888" }}>${d.price?.toLocaleString("es-CL")}</span>
                  {sel && <span style={{ color: "#F4A623", fontSize: "14px" }}>✓</span>}
                </button>
              );
            })}
          </div>

          {cSelectedDishes.length > 0 && (
            <div style={{ background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.15)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#999" }}>Precio original (suma)</span>
                <span style={{ fontFamily: F, fontSize: "0.92rem", color: "white", fontWeight: 600 }}>${selectedDishesTotal.toLocaleString("es-CL")}</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: F, fontSize: "0.68rem", color: "#999", display: "block", marginBottom: 4 }}>Precio promo</label>
                  <input type="number" placeholder="$" value={cPromoPrice} onChange={e => setCPromoPrice(e.target.value)} style={{ ...INP, marginBottom: 0 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: F, fontSize: "0.68rem", color: "#999", display: "block", marginBottom: 4 }}>% descuento</label>
                  <input type="number" placeholder="%" value={cDiscountPct} onChange={e => setCDiscountPct(e.target.value)} style={{ ...INP, marginBottom: 0 }} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleCreatePromo} disabled={savingNew || !cName || cSelectedDishes.length === 0} style={{ flex: 1, padding: "10px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: savingNew || !cName || cSelectedDishes.length === 0 ? 0.5 : 1 }}>{savingNew ? "Creando..." : "Crear promoción"}</button>
            <button onClick={resetCreate} style={{ padding: "10px 16px", background: "none", border: "1px solid #2A2A2A", borderRadius: 10, color: "#888", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {[
          { key: "all", label: "Todas" },
          { key: "SUGGESTED", label: "Sugeridas" },
          { key: "ACTIVE", label: "Activas" },
          { key: "PAUSED", label: "Pausadas" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
            background: filter === f.key ? "#F4A623" : "rgba(255,255,255,0.05)",
            color: filter === f.key ? "#0a0a0a" : "#888",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "white", marginBottom: 16 }}>Editar promoción</h3>
          <input placeholder="Nombre" value={editName} onChange={e => setEditName(e.target.value)} style={I} />
          <textarea placeholder="Descripción" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} style={{ ...I, resize: "vertical" }} />
          <input placeholder="Precio promo" type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={I} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={saveEdit} style={{ padding: "10px 20px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
            <button onClick={() => setEditing(null)} style={{ padding: "10px 20px", background: "none", border: "1px solid #2A2A2A", borderRadius: 8, color: "#888", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#F4A623", fontFamily: F, padding: 40, textAlign: "center" }}>Cargando...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(p => {
            const st = STATUS_STYLES[p.status] || STATUS_STYLES.SUGGESTED;
            const isOpen = expanded === p.id;
            const dishNames = p.dishes?.map(d => d.name) || p.dishNames || [];
            return (
              <div key={p.id} style={{ background: "#1A1A1A", border: `1px solid ${isOpen ? "rgba(244,166,35,0.3)" : "#2A2A2A"}`, borderRadius: 14, overflow: "hidden" }}>
                {/* Header */}
                <button onClick={() => setExpanded(isOpen ? null : p.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  {p.restaurant?.logoUrl ? (
                    <img src={p.restaurant.logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(244,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#F4A623", flexShrink: 0 }}>
                      {p.restaurant?.name?.charAt(0) || "🏷️"}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: F, fontSize: "0.95rem", color: "white", fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontSize: "0.6rem", padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                    </div>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#666", margin: "4px 0 0" }}>
                      {p.discountPct && `${p.discountPct}% off`}
                      {p.promoPrice && ` · $${p.promoPrice.toLocaleString("es-CL")}`}
                      {dishNames.length > 0 && ` · ${dishNames.join(", ")}`}
                    </p>
                  </div>
                  <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#555", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                </button>

                {/* Detail */}
                {isOpen && (
                  <div style={{ padding: "0 18px 18px", borderTop: "1px solid #2A2A2A" }}>
                    {p.description && <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#aaa", margin: "12px 0", lineHeight: 1.5 }}>{p.description}</p>}

                    {p.aiJustification && (
                      <div style={{ background: "rgba(244,166,35,0.05)", border: "1px solid rgba(244,166,35,0.12)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Por qué el Genio lo recomienda</p>
                        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "#ccc", lineHeight: 1.5, margin: 0 }}>{p.aiJustification}</p>
                      </div>
                    )}

                    {/* Dishes */}
                    {(p.dishes?.length || 0) > 0 && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        {p.dishes!.map(d => (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid #2A2A2A", borderRadius: 8, padding: "6px 10px" }}>
                            {d.photos?.[0] && <img src={d.photos[0]} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover" }} />}
                            <div>
                              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "white", margin: 0 }}>{d.name}</p>
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {p.promoPrice && <span style={{ fontFamily: F, fontSize: "0.72rem", color: "#4ade80", fontWeight: 600 }}>${p.promoPrice.toLocaleString("es-CL")}</span>}
                                <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#666", textDecoration: p.promoPrice ? "line-through" : "none" }}>${d.price.toLocaleString("es-CL")}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Prices */}
                    <div style={{ display: "flex", gap: 12, fontFamily: F, fontSize: "0.8rem", color: "#888", marginBottom: 14 }}>
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
              <p style={{ fontSize: "2rem", marginBottom: 12 }}>🧞</p>
              <p style={{ fontFamily: F, fontSize: "0.92rem", color: "#888" }}>No hay promociones</p>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#555" }}>Toca "Generar sugerencias" para que el Genio analice la carta</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const I: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: "var(--font-display)", fontSize: "0.85rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };
const INP: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: "var(--font-display)", fontSize: "0.82rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };
function btnStyle(color: string): React.CSSProperties {
  return { padding: "8px 16px", background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 8, color, fontFamily: "var(--font-display)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" };
}
