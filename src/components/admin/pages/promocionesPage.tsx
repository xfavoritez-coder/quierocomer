"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Tag } from "lucide-react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { usePanelLang } from "@/lib/i18n/panel";

const F = "var(--font-display)";
const GOLD = "#F4A623";

function parseCLP(v: string): number | null {
  if (!v) return null;
  const clean = v.replace(/\./g, "").replace(/,/g, "");
  const n = parseInt(clean, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function getPromoDisplayStatus(p: { status: string; validFrom: string | null; validUntil: string | null }): string {
  if (p.status === "ACTIVE" && p.validFrom && new Date(p.validFrom) > new Date()) return "SCHEDULED";
  return p.status;
}

function isPromoActiveToday(p: Promo): boolean {
  if (p.status !== "ACTIVE") return false;
  const now = new Date();
  if (p.validFrom && new Date(p.validFrom) > now) return false;
  if (p.validUntil && new Date(p.validUntil) < now) return false;
  if (p.daysOfWeek && p.daysOfWeek.length > 0 && !p.daysOfWeek.includes(now.getDay())) return false;
  return true;
}

interface Promo {
  id: string;
  name: string;
  status: string;
  dishId?: string | null;
  promoName?: string | null;
  promoPrice?: number | null;
  originalPrice?: number | null;
  daysOfWeek?: number[];
  validFrom?: string | null;
  validUntil?: string | null;
  dish?: { id: string; name: string; price: number; photos: string[] } | null;
  dishes?: { id: string; name: string; price: number; photos: string[] }[];
  // legacy
  dishIds?: string[];
  position?: number;
  createdAt?: string;
}

export default function AdminPromociones() {
  const { t } = usePanelLang();
  const pathname = usePathname();
  const isPanel = pathname.startsWith("/panel");

  const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE:    { label: "Activa",    color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
    SCHEDULED: { label: "Programada", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
    PAUSED:    { label: "Pausada",   color: "var(--adm-text2)", bg: "var(--adm-hover)" },
    SUGGESTED: { label: "Sugerida",  color: GOLD,      bg: `rgba(244,166,35,0.1)` },
  };

  const { restaurants, loading: sessionLoading, selectedRestaurantId } = useAdminSession();
  const [selectedLocal, setSelectedLocal] = useState("");
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(false);
  const [localDishes, setLocalDishes] = useState<{ id: string; name: string; price: number; photos: string[] }[]>([]);
  const [filter, setFilter] = useState("all");

  // Editor inline
  const [editing, setEditing] = useState<Promo | null>(null);
  const [editName, setEditName] = useState("");
  const [editDishId, setEditDishId] = useState("");
  const [editPromoName, setEditPromoName] = useState("");
  const [editPromoPrice, setEditPromoPrice] = useState("");
  const [editOriginalPrice, setEditOriginalPrice] = useState("");
  const [editDaysOfWeek, setEditDaysOfWeek] = useState<number[]>([]);
  const [editValidFrom, setEditValidFrom] = useState("");
  const [editValidUntil, setEditValidUntil] = useState("");
  const [editDishSearch, setEditDishSearch] = useState("");

  // Crear nueva oferta
  const [creating, setCreating] = useState(false);
  const [cName, setCName] = useState("");
  const [cDishId, setCDishId] = useState("");
  const [cPromoName, setCPromoName] = useState("");
  const [cPromoPrice, setCPromoPrice] = useState("");
  const [cOriginalPrice, setCOriginalPrice] = useState("");
  const [cDaysOfWeek, setCDaysOfWeek] = useState<number[]>([]);
  const [cValidFrom, setCValidFrom] = useState("");
  const [cValidUntil, setCValidUntil] = useState("");
  const [cDishSearch, setCDishSearch] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  useEffect(() => {
    if (selectedRestaurantId && !selectedLocal) setSelectedLocal(selectedRestaurantId);
  }, [selectedRestaurantId, selectedLocal]);

  useEffect(() => {
    if (!selectedLocal) { setLocalDishes([]); return; }
    fetch(`/api/admin/dishes?restaurantId=${selectedLocal}`)
      .then(r => r.json())
      .then(d => { const arr = Array.isArray(d) ? d : d?.dishes; if (Array.isArray(arr)) setLocalDishes(arr); })
      .catch(() => {});
  }, [selectedLocal]);

  useEffect(() => {
    if (sessionLoading || !selectedLocal) { setPromos([]); return; }
    setLoading(true);
    fetch(`/api/admin/promotions?restaurantId=${selectedLocal}`)
      .then(r => r.json()).then(d => setPromos(d.promotions || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [selectedLocal, sessionLoading]);

  const handleStatus = async (id: string, status: string) => {
    const res = await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) setPromos(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta oferta?")) return;
    await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "DELETED" }),
    });
    setPromos(prev => prev.filter(p => p.id !== id));
    setEditing(null);
  };

  const startEdit = (p: Promo) => {
    setEditing(p);
    setEditName(p.name);
    setEditDishId(p.dishId || "");
    setEditPromoName(p.promoName || "");
    setEditPromoPrice(p.promoPrice?.toString() || "");
    setEditOriginalPrice(p.originalPrice?.toString() || "");
    setEditDaysOfWeek(p.daysOfWeek || []);
    setEditValidFrom(p.validFrom ? p.validFrom.slice(0, 10) : "");
    setEditValidUntil(p.validUntil ? p.validUntil.slice(0, 10) : "");
    setEditDishSearch("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body: any = {
      id: editing.id,
      name: editName,
      dishId: editDishId || null,
      promoName: editPromoName || null,
      promoPrice: parseCLP(editPromoPrice),
      originalPrice: parseCLP(editOriginalPrice),
      daysOfWeek: editDaysOfWeek,
      validFrom: editValidFrom || null,
      validUntil: editValidUntil || null,
    };
    const res = await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const dishObj = localDishes.find(d => d.id === editDishId) || null;
      setPromos(prev => prev.map(p => p.id === editing.id ? { ...p, ...body, dish: dishObj } : p));
    }
    setEditing(null);
  };

  const resetCreate = () => {
    setCreating(false);
    setCName(""); setCDishId(""); setCPromoName(""); setCPromoPrice(""); setCOriginalPrice("");
    setCDaysOfWeek([]); setCValidFrom(""); setCValidUntil(""); setCDishSearch("");
  };

  const handleCreate = async () => {
    if (!selectedLocal || !cName || !cDishId) return;
    setSavingNew(true);
    const body: any = {
      restaurantId: selectedLocal,
      name: cName,
      dishId: cDishId,
      promoName: cPromoName || null,
      promoPrice: parseCLP(cPromoPrice),
      originalPrice: parseCLP(cOriginalPrice),
      daysOfWeek: cDaysOfWeek,
      validFrom: cValidFrom || null,
      validUntil: cValidUntil || null,
    };
    const res = await fetch("/api/admin/promotions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.promotion) {
      const dishObj = localDishes.find(d => d.id === cDishId) || null;
      setPromos(prev => [{ ...data.promotion, dish: dishObj }, ...prev]);
    }
    resetCreate();
    setSavingNew(false);
  };

  const toggleDayCreate = (i: number) => setCDaysOfWeek(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  const toggleDayEdit = (i: number) => setEditDaysOfWeek(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  const DAYS_ABBR = ["D","L","M","Mi","J","V","S"];
  const DAYS_FULL = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const todayIdx = new Date().getDay();

  const filtered = promos.filter(p => {
    if (p.status === "DELETED") return false;
    if (filter === "all") return true;
    if (filter === "ACTIVE") return p.status === "ACTIVE";
    if (filter === "PAUSED") return p.status === "PAUSED";
    return true;
  });

  if (sessionLoading) return <SkeletonLoading type="cards" />;

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Tag size={20} color="var(--adm-text3)" /> Ofertas
          </h1>
          <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>
            Aplica un precio especial a un plato existente ciertos días o por un período
          </p>
        </div>
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
      </div>

      {/* Filters + create */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, alignItems: "center" }}>
        {[
          { key: "all", label: "Todas" },
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
          <button onClick={() => creating ? resetCreate() : setCreating(true)} style={{
            padding: "8px 16px", background: creating ? "none" : GOLD,
            color: creating ? "var(--adm-text2)" : "white",
            border: creating ? "1px solid var(--adm-card-border)" : "none",
            borderRadius: 10, fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", flexShrink: 0,
          }}>
            {creating ? "Cancelar" : "+ Nueva oferta"}
          </button>
        )}
      </div>

      {/* Formulario de creación */}
      {creating && (
        <div style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text)", marginBottom: 16, marginTop: 0 }}>Nueva oferta</h3>

          <label style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", display: "block", marginBottom: 4 }}>Nombre interno (para identificarla en el panel)</label>
          <input placeholder="Ej: Martes de Suprema" value={cName} onChange={e => setCName(e.target.value)} style={INP} />

          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Plato al que aplica</p>
          {cDishId ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.25)", borderRadius: 10, marginBottom: 12 }}>
              {localDishes.find(d => d.id === cDishId)?.photos?.[0] && <img src={localDishes.find(d => d.id === cDishId)!.photos[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />}
              <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", flex: 1 }}>{localDishes.find(d => d.id === cDishId)?.name}</span>
              <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)" }}>${localDishes.find(d => d.id === cDishId)?.price.toLocaleString("es-CL")}</span>
              <button onClick={() => setCDishId("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)", fontSize: "1rem", padding: 0 }}>✕</button>
            </div>
          ) : (
            <>
              <input placeholder="Buscar plato…" value={cDishSearch} onChange={e => setCDishSearch(e.target.value)} style={{ ...INP, borderRadius: "10px 10px 0 0", borderBottom: "none", marginBottom: 0 }} />
              <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: 12, borderRadius: "0 0 10px 10px", border: "1px solid var(--adm-card-border)", scrollbarWidth: "none" }}>
                {localDishes.filter(d => !cDishSearch || d.name.toLowerCase().includes(cDishSearch.toLowerCase())).slice(0, 20).map(d => (
                  <button key={d.id} onClick={() => { setCDishId(d.id); setCDishSearch(""); if (!cOriginalPrice) setCOriginalPrice(String(d.price)); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", width: "100%", background: "transparent", border: "none", borderBottom: "1px solid var(--adm-card-border)", cursor: "pointer", textAlign: "left" }}>
                    {d.photos?.[0] && <img src={d.photos[0]} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover" }} />}
                    <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{d.name}</span>
                    <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)" }}>${d.price?.toLocaleString("es-CL")}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <label style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", display: "block", marginBottom: 4 }}>Nombre que ve el cliente esos días <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>(vacío = usa el nombre del plato)</span></label>
          <input placeholder={localDishes.find(d => d.id === cDishId)?.name || "Ej: Martes de Suprema"} value={cPromoName} onChange={e => setCPromoName(e.target.value)} style={INP} />

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", display: "block", marginBottom: 4 }}>Precio de oferta</label>
              <input type="text" inputMode="numeric" placeholder="19.900" value={cPromoPrice} onChange={e => setCPromoPrice(e.target.value)} style={{ ...INP, marginBottom: 0 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", display: "block", marginBottom: 4 }}>Precio normal (tachado)</label>
              <input type="text" inputMode="numeric" placeholder="25.900" value={cOriginalPrice} onChange={e => setCOriginalPrice(e.target.value)} style={{ ...INP, marginBottom: 0 }} />
            </div>
          </div>

          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", marginBottom: 6 }}>Días activos <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>(vacío = todos los días)</span></p>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
            {DAYS_ABBR.map((d, i) => (
              <button key={i} onClick={() => toggleDayCreate(i)} style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, background: cDaysOfWeek.includes(i) ? GOLD : "var(--adm-hover)", color: cDaysOfWeek.includes(i) ? "#0a0a0a" : "var(--adm-text2)" }}>{d}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Desde</label>
              <input type="date" value={cValidFrom} onChange={e => setCValidFrom(e.target.value)} style={{ ...INP, marginBottom: 0, colorScheme: "dark" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Hasta</label>
              <input type="date" value={cValidUntil} onChange={e => setCValidUntil(e.target.value)} style={{ ...INP, marginBottom: 0, colorScheme: "dark" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleCreate} disabled={savingNew || !cName || !cDishId} style={{ flex: 1, padding: "10px", background: GOLD, color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: savingNew || !cName || !cDishId ? 0.5 : 1 }}>
              {savingNew ? "Guardando…" : "Crear oferta"}
            </button>
            <button onClick={resetCreate} style={{ padding: "10px 16px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? <SkeletonLoading type="cards" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(p => {
            const displayStatus = getPromoDisplayStatus(p);
            const st = STATUS_STYLES[displayStatus] || STATUS_STYLES.PAUSED;
            const isOpen = editing?.id === p.id;
            const activeToday = isPromoActiveToday(p);
            // Plato base: preferir dish (nuevo campo), fallback a dishes[0] (legacy)
            const baseDish = p.dish || p.dishes?.[0] || null;
            const promoDisplayName = p.promoName || baseDish?.name || p.name;

            return (
              <div key={p.id} style={{ background: "var(--adm-card)", border: `1px solid ${isOpen ? "rgba(244,166,35,0.3)" : "var(--adm-card-border)"}`, borderRadius: 14, overflow: "hidden" }}>
                {/* Header de la card */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}
                  onClick={() => { if (editing?.id === p.id) setEditing(null); else startEdit(p); }}
                >
                  {/* Foto */}
                  {baseDish?.photos?.[0] ? (
                    <img src={baseDish.photos[0]} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(244,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: GOLD, flexShrink: 0 }}>🏷️</div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Nombre + badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span style={{ fontSize: "0.58rem", padding: "2px 7px", borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600, flexShrink: 0 }}>{st.label}</span>
                      {activeToday && (
                        <span style={{ fontSize: "0.58rem", padding: "2px 7px", borderRadius: 4, background: "rgba(74,222,128,0.18)", color: "#4ade80", fontWeight: 700, flexShrink: 0, border: "1px solid rgba(74,222,128,0.35)" }}>HOY</span>
                      )}
                    </div>

                    {/* Subtítulo */}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
                      {baseDish && (
                        <span style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)" }}>
                          🍽 {baseDish.name}
                          {p.promoName && p.promoName !== baseDish.name && (
                            <span style={{ color: GOLD }}> → {p.promoName}</span>
                          )}
                        </span>
                      )}
                      {p.promoPrice != null && (
                        <span style={{ fontFamily: F, fontSize: "0.7rem", color: GOLD, fontWeight: 600 }}>
                          ${p.promoPrice.toLocaleString("es-CL")}
                          {p.originalPrice != null && <span style={{ color: "var(--adm-text3)", fontWeight: 400, textDecoration: "line-through", marginLeft: 4 }}>${p.originalPrice.toLocaleString("es-CL")}</span>}
                        </span>
                      )}
                      {p.daysOfWeek && p.daysOfWeek.length > 0 && (
                        <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)" }}>
                          {p.daysOfWeek.map(d => (
                            <span key={d} style={{ marginRight: 1, color: d === todayIdx && activeToday ? GOLD : "var(--adm-text3)", fontWeight: d === todayIdx && activeToday ? 700 : 400 }}>
                              {DAYS_ABBR[d]}
                            </span>
                          ))}
                        </span>
                      )}
                      {(p.validFrom || p.validUntil) && (
                        <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)" }}>
                          {p.validFrom ? new Date(p.validFrom).toLocaleDateString("es-CL", { day: "numeric", month: "short" }) : "…"} → {p.validUntil ? new Date(p.validUntil).toLocaleDateString("es-CL", { day: "numeric", month: "short" }) : "…"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botón rápido pausar/activar */}
                  {p.status === "ACTIVE" && (
                    <button onClick={e => { e.stopPropagation(); handleStatus(p.id, "PAUSED"); }} style={{ padding: "5px 10px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 7, color: "var(--adm-text3)", fontFamily: F, fontSize: "0.7rem", cursor: "pointer", flexShrink: 0 }}>Pausar</button>
                  )}
                  {p.status === "PAUSED" && (
                    <button onClick={e => { e.stopPropagation(); handleStatus(p.id, "ACTIVE"); }} style={{ padding: "5px 10px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 7, color: "#4ade80", fontFamily: F, fontSize: "0.7rem", cursor: "pointer", flexShrink: 0 }}>Activar</button>
                  )}

                  <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* Editor inline */}
                {isOpen && editing?.id === p.id && (
                  <div style={{ padding: "16px 18px 18px", borderTop: "1px solid rgba(244,166,35,0.3)", background: "rgba(244,166,35,0.03)" }}>

                    {/* Resumen HOY */}
                    {p.status === "ACTIVE" && (() => {
                      const baseDishes = localDishes.filter(d => d.id === editDishId);
                      return (
                        <div style={{ padding: "9px 12px", background: activeToday ? "rgba(74,222,128,0.07)" : "rgba(0,0,0,0.04)", border: `1px solid ${activeToday ? "rgba(74,222,128,0.25)" : "var(--adm-card-border)"}`, borderRadius: 9, marginBottom: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: baseDishes.length > 0 ? 8 : 0 }}>
                            <span style={{ fontSize: "0.9rem" }}>{activeToday ? "✅" : "⏸"}</span>
                            <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: activeToday ? "#4ade80" : "var(--adm-text2)" }}>
                              {activeToday ? "Activa hoy" : "No activa hoy — el cliente ve el menú normal"}
                            </span>
                          </div>
                          {activeToday && baseDishes.map(d => (
                            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "rgba(74,222,128,0.06)", borderRadius: 7, border: "1px solid rgba(74,222,128,0.15)" }}>
                              {d.photos?.[0] && <img src={d.photos[0]} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover" }} />}
                              <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)", flex: 1 }}>{editPromoName || d.name}</span>
                              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", textDecoration: "line-through" }}>${d.price.toLocaleString("es-CL")}</span>
                              {editPromoPrice && <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "#4ade80" }}>${(parseCLP(editPromoPrice) ?? 0).toLocaleString("es-CL")}</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Nombre interno */}
                    <label style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Nombre interno</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} style={I} />

                    {/* Plato */}
                    <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Plato al que aplica</p>
                    {editDishId ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.25)", borderRadius: 10, marginBottom: 12 }}>
                        {localDishes.find(d => d.id === editDishId)?.photos?.[0] && <img src={localDishes.find(d => d.id === editDishId)!.photos[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />}
                        <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", flex: 1 }}>{localDishes.find(d => d.id === editDishId)?.name}</span>
                        <button onClick={() => setEditDishId("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)", fontSize: "1rem", padding: 0 }}>✕</button>
                      </div>
                    ) : (
                      <>
                        <input placeholder="Buscar plato…" value={editDishSearch} onChange={e => setEditDishSearch(e.target.value)} style={{ ...I, borderRadius: "8px 8px 0 0", borderBottom: "none", marginBottom: 0 }} />
                        {editDishSearch.trim() && (
                          <div style={{ maxHeight: 140, overflowY: "auto", marginBottom: 10, borderRadius: "0 0 8px 8px", border: "1px solid var(--adm-card-border)", scrollbarWidth: "none" }}>
                            {localDishes.filter(d => d.name.toLowerCase().includes(editDishSearch.toLowerCase())).slice(0, 20).map(d => (
                              <div key={d.id} onClick={() => { setEditDishId(d.id); setEditDishSearch(""); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", cursor: "pointer", borderBottom: "1px solid var(--adm-card-border)" }}>
                                {d.photos?.[0] && <img src={d.photos[0]} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover" }} />}
                                <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text)" }}>{d.name}</span>
                                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", marginLeft: "auto" }}>${d.price.toLocaleString("es-CL")}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Nombre que ve el cliente */}
                    <label style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Nombre que ve el cliente <span style={{ fontWeight: 400 }}>(vacío = nombre del plato)</span></label>
                    <input placeholder={localDishes.find(d => d.id === editDishId)?.name || ""} value={editPromoName} onChange={e => setEditPromoName(e.target.value)} style={I} />

                    {/* Precios */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Precio de oferta</label>
                        <input type="text" inputMode="numeric" placeholder="19.900" value={editPromoPrice} onChange={e => setEditPromoPrice(e.target.value)} style={{ ...I, marginBottom: 0 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Precio normal (tachado)</label>
                        <input type="text" inputMode="numeric" placeholder="25.900" value={editOriginalPrice} onChange={e => setEditOriginalPrice(e.target.value)} style={{ ...I, marginBottom: 0 }} />
                      </div>
                    </div>

                    {/* Días */}
                    <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>Días activos <span style={{ fontWeight: 400, textTransform: "none" }}>(vacío = todos)</span></p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
                      {DAYS_ABBR.map((d, i) => (
                        <button key={i} onClick={() => toggleDayEdit(i)} style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", fontWeight: 700, background: editDaysOfWeek.includes(i) ? GOLD : "var(--adm-hover)", color: editDaysOfWeek.includes(i) ? "#0a0a0a" : "var(--adm-text2)" }}>{d}</button>
                      ))}
                    </div>

                    {/* Rango de fechas */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Desde</label>
                        <input type="date" value={editValidFrom} onChange={e => setEditValidFrom(e.target.value)} style={{ ...INP, marginBottom: 0, colorScheme: "dark" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>Hasta</label>
                        <input type="date" value={editValidUntil} onChange={e => setEditValidUntil(e.target.value)} style={{ ...INP, marginBottom: 0, colorScheme: "dark" }} />
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button onClick={saveEdit} style={{ padding: "10px 20px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
                      <button onClick={() => setEditing(null)} style={{ padding: "10px 20px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
                      {editing.status === "ACTIVE" && (
                        <button onClick={() => { handleStatus(editing.id, "PAUSED"); setEditing(null); }} style={{ padding: "10px 16px", background: "rgba(136,136,136,0.1)", border: "1px solid rgba(136,136,136,0.3)", borderRadius: 8, color: "#888", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Pausar</button>
                      )}
                      {editing.status === "PAUSED" && (
                        <button onClick={() => { handleStatus(editing.id, "ACTIVE"); setEditing(null); }} style={{ padding: "10px 16px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 8, color: "#4ade80", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Activar</button>
                      )}
                      <button onClick={() => handleDelete(editing.id)} style={{ marginLeft: "auto", padding: "10px 16px", background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 8, color: "#ff6b6b", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Eliminar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 60 }}>
              <p style={{ fontSize: "2rem", marginBottom: 12 }}>🏷️</p>
              <p style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text2)" }}>No hay ofertas</p>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Creá una oferta para aplicar un precio especial a un plato ciertos días</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const I: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: "var(--font-display)", fontSize: "0.85rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };
const INP: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: "var(--font-display)", fontSize: "0.82rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };
