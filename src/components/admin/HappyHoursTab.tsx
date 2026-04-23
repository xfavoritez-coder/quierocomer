"use client";

import { useState, useEffect } from "react";

const F = "var(--font-display)";
const GOLD = "#F4A623";
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const INP: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 };

interface HappyHour {
  id: string;
  name: string;
  days: number[];
  startTime: string;
  endTime: string;
  discountType: "FIXED_PRICE" | "PERCENTAGE";
  discountValue: number;
  categoryIds: string[];
  dishIds: string[];
  bannerText: string | null;
  bannerColor: string;
  isActive: boolean;
}

interface Category { id: string; name: string; }

export default function HappyHoursTab({ restaurantId, categories }: { restaurantId: string; categories: Category[] }) {
  const [hours, setHours] = useState<HappyHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  // Form state
  const [fName, setFName] = useState("");
  const [fDays, setFDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [fStart, setFStart] = useState("16:00");
  const [fEnd, setFEnd] = useState("19:00");
  const [fType, setFType] = useState<"FIXED_PRICE" | "PERCENTAGE">("FIXED_PRICE");
  const [fValue, setFValue] = useState("");
  const [fCatIds, setFCatIds] = useState<string[]>([]);
  const [fBannerText, setFBannerText] = useState("");
  const [fSaving, setFSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/happy-hours?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setHours(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const resetForm = () => {
    setFName(""); setFDays([1, 2, 3, 4, 5]); setFStart("16:00"); setFEnd("19:00");
    setFType("FIXED_PRICE"); setFValue(""); setFCatIds([]); setFBannerText("");
    setCreating(false); setEditing(null);
  };

  const loadForEdit = (hh: HappyHour) => {
    setFName(hh.name);
    setFDays([...hh.days]);
    setFStart(hh.startTime);
    setFEnd(hh.endTime);
    setFType(hh.discountType);
    setFValue(String(hh.discountValue));
    setFCatIds([...hh.categoryIds]);
    setFBannerText(hh.bannerText || "");
    setEditing(hh.id);
    setCreating(true);
  };

  const handleSave = async () => {
    if (!fName.trim() || !fValue || fCatIds.length === 0) return;
    setFSaving(true);

    const payload = {
      restaurantId,
      name: fName.trim(),
      days: fDays,
      startTime: fStart,
      endTime: fEnd,
      discountType: fType,
      discountValue: Number(fValue),
      categoryIds: fCatIds,
      dishIds: [],
      bannerText: fBannerText.trim() || null,
    };

    try {
      if (editing) {
        const res = await fetch("/api/admin/happy-hours", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing, ...payload }),
        });
        const updated = await res.json();
        if (res.ok) setHours(prev => prev.map(h => h.id === editing ? updated : h));
      } else {
        const res = await fetch("/api/admin/happy-hours", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created = await res.json();
        if (res.ok) setHours(prev => [created, ...prev]);
      }
      resetForm();
    } catch {}
    setFSaving(false);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch("/api/admin/happy-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive }),
    });
    setHours(prev => prev.map(h => h.id === id ? { ...h, isActive } : h));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este horario especial?")) return;
    const res = await fetch("/api/admin/happy-hours", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setHours(prev => prev.filter(h => h.id !== id));
  };

  const toggleDay = (d: number) => {
    setFDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  if (loading) return <p style={{ fontFamily: F, color: "var(--adm-text3)", padding: 20 }}>Cargando...</p>;

  return (
    <div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Crea horarios especiales con precios reducidos. Se muestra un banner automatico en la carta durante el horario activo.
      </p>

      {/* Create / Edit form */}
      {creating ? (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "0.95rem", color: "var(--adm-text)", marginBottom: 16, fontWeight: 700 }}>
            {editing ? "Editar horario" : "Nuevo horario especial"}
          </h3>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>Nombre</label>
            <input value={fName} onChange={e => setFName(e.target.value)} placeholder="Ej: Hand Roll Hour, Happy Hour..." style={INP} />
          </div>

          {/* Days */}
          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>Dias</label>
            <div style={{ display: "flex", gap: 6 }}>
              {DAY_LABELS.map((label, i) => (
                <button key={i} onClick={() => toggleDay(i)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
                  background: fDays.includes(i) ? GOLD : "var(--adm-input)",
                  color: fDays.includes(i) ? "white" : "var(--adm-text3)",
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={LBL}>Desde</label>
              <input type="time" value={fStart} onChange={e => setFStart(e.target.value)} style={INP} />
            </div>
            <div>
              <label style={LBL}>Hasta</label>
              <input type="time" value={fEnd} onChange={e => setFEnd(e.target.value)} style={INP} />
            </div>
          </div>

          {/* Discount type + value */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={LBL}>Tipo de descuento</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setFType("FIXED_PRICE")} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
                  background: fType === "FIXED_PRICE" ? GOLD : "var(--adm-input)",
                  color: fType === "FIXED_PRICE" ? "white" : "var(--adm-text3)",
                }}>Precio fijo</button>
                <button onClick={() => setFType("PERCENTAGE")} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
                  background: fType === "PERCENTAGE" ? GOLD : "var(--adm-input)",
                  color: fType === "PERCENTAGE" ? "white" : "var(--adm-text3)",
                }}>Porcentaje</button>
              </div>
            </div>
            <div>
              <label style={LBL}>{fType === "FIXED_PRICE" ? "Precio ($)" : "Descuento (%)"}</label>
              <input type="number" value={fValue} onChange={e => setFValue(e.target.value)}
                placeholder={fType === "FIXED_PRICE" ? "3990" : "20"} style={INP} />
            </div>
          </div>

          {/* Categories */}
          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>Categorias afectadas</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {categories.map(c => {
                const sel = fCatIds.includes(c.id);
                return (
                  <button key={c.id} onClick={() => setFCatIds(prev => sel ? prev.filter(x => x !== c.id) : [...prev, c.id])} style={{
                    padding: "6px 14px", borderRadius: 50, border: "none", cursor: "pointer",
                    fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
                    background: sel ? GOLD : "var(--adm-input)",
                    color: sel ? "white" : "var(--adm-text3)",
                  }}>{c.name}</button>
                );
              })}
            </div>
            {fCatIds.length === 0 && <p style={{ fontFamily: F, fontSize: "0.68rem", color: "#ef4444", margin: "6px 0 0" }}>Selecciona al menos una categoria</p>}
          </div>

          {/* Banner text */}
          <div style={{ marginBottom: 18 }}>
            <label style={LBL}>Texto del banner (opcional)</label>
            <input value={fBannerText} onChange={e => setFBannerText(e.target.value)}
              placeholder="Ej: Todos los hand rolls a $3.990" style={INP} />
            <p style={{ fontFamily: F, fontSize: "0.68rem", color: GOLD, fontWeight: 600, margin: "4px 0 0" }}>
              Si lo dejas vacio se genera automaticamente
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={fSaving || !fName.trim() || !fValue || fCatIds.length === 0} style={{
              padding: "10px 20px", background: GOLD, color: "white", border: "none", borderRadius: 10,
              fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
              opacity: (!fName.trim() || !fValue || fCatIds.length === 0) ? 0.5 : 1,
            }}>{fSaving ? "..." : editing ? "Guardar cambios" : "Crear horario"}</button>
            <button onClick={resetForm} style={{
              padding: "10px 16px", background: "none", border: "1px solid var(--adm-card-border)",
              borderRadius: 10, fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text3)", cursor: "pointer",
            }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} style={{
          padding: "10px 18px", background: GOLD, color: "white", border: "none", borderRadius: 10,
          fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", marginBottom: 20,
        }}>+ Nuevo horario especial</button>
      )}

      {/* List */}
      {hours.length === 0 && !creating && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: "2rem", marginBottom: 8 }}>🕐</p>
          <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text3)" }}>No tienes horarios especiales configurados</p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "var(--adm-text3)", marginTop: 4 }}>Crea uno para ofrecer precios especiales en ciertos horarios</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hours.map(hh => {
          const catNames = hh.categoryIds.map(id => categories.find(c => c.id === id)?.name || "").filter(Boolean);
          const dayStr = hh.days.map(d => DAY_LABELS[d]).join(", ");
          const isNowActive = (() => {
            const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
            const day = now.getDay();
            if (!hh.days.includes(day)) return false;
            const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
            return t >= hh.startTime && t < hh.endTime;
          })();

          return (
            <div key={hh.id} style={{
              background: "var(--adm-card)", border: `1px solid ${hh.isActive && isNowActive ? "rgba(74,222,128,0.3)" : "var(--adm-card-border)"}`,
              borderRadius: 12, padding: "14px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: "1.1rem" }}>🔥</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)" }}>{hh.name}</span>
                    {hh.isActive && isNowActive && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "rgba(74,222,128,0.12)", color: "#4ade80", padding: "2px 8px", borderRadius: 50 }}>ACTIVO AHORA</span>}
                    {!hh.isActive && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "rgba(255,100,100,0.08)", color: "#ff6b6b", padding: "2px 8px", borderRadius: 50 }}>PAUSADO</span>}
                  </div>
                  <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                    {dayStr} · {hh.startTime} - {hh.endTime} · {hh.discountType === "FIXED_PRICE" ? `$${hh.discountValue.toLocaleString("es-CL")}` : `${hh.discountValue}% dcto`}
                  </p>
                  {catNames.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                      {catNames.map(n => <span key={n} style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 50, background: "rgba(244,166,35,0.08)", color: GOLD, fontWeight: 600, fontFamily: F }}>{n}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => loadForEdit(hh)} style={{ padding: "4px 10px", background: "rgba(127,191,220,0.08)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "#7fbfdc", cursor: "pointer", fontWeight: 600 }}>Editar</button>
                  <button onClick={() => toggleActive(hh.id, !hh.isActive)} style={{ padding: "4px 10px", background: hh.isActive ? "rgba(255,100,100,0.06)" : "rgba(74,222,128,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: hh.isActive ? "#ff6b6b" : "#4ade80", cursor: "pointer", fontWeight: 600 }}>
                    {hh.isActive ? "Pausar" : "Activar"}
                  </button>
                  <button onClick={() => handleDelete(hh.id)} style={{ padding: "4px 8px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>Eliminar</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
