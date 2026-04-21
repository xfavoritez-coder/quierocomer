"use client";

import { useState, useEffect } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Option {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
  position: number;
}

interface Group {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  position: number;
  options: Option[];
}

interface Props {
  dishId: string;
}

const LBL: React.CSSProperties = { fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 };
const INP: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" as const };

export default function DishModifiersEditor({ dishId }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRequired, setNewRequired] = useState(true);
  const [newMaxSelect, setNewMaxSelect] = useState(1);
  const [saving, setSaving] = useState(false);

  // Editing option inline
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [eoName, setEoName] = useState("");
  const [eoPrice, setEoPrice] = useState("");

  useEffect(() => {
    fetch(`/api/admin/dishes/${dishId}/modifiers`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setGroups(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dishId]);

  const createGroup = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/admin/dishes/${dishId}/modifiers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        required: newRequired,
        minSelect: newRequired ? 1 : 0,
        maxSelect: newMaxSelect,
      }),
    });
    const group = await res.json();
    if (res.ok) {
      setGroups(prev => [...prev, group]);
      setNewName("");
      setAdding(false);
    }
    setSaving(false);
  };

  const deleteGroup = async (groupId: string) => {
    await fetch(`/api/admin/dishes/${dishId}/modifiers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const addOption = async (groupId: string) => {
    const res = await fetch(`/api/admin/dishes/${dishId}/modifiers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addOptionToGroup: groupId, name: "Nueva opción", priceAdjustment: 0 }),
    });
    const option = await res.json();
    if (res.ok) {
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, options: [...g.options, option] } : g));
      // Auto-edit the new option
      setEditingOption(option.id);
      setEoName(option.name);
      setEoPrice("0");
    }
  };

  const saveOption = async (groupId: string) => {
    if (!editingOption) return;
    await fetch(`/api/admin/dishes/${dishId}/modifiers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: editingOption, name: eoName, priceAdjustment: Number(eoPrice) || 0 }),
    });
    setGroups(prev => prev.map(g => g.id === groupId ? {
      ...g,
      options: g.options.map(o => o.id === editingOption ? { ...o, name: eoName, priceAdjustment: Number(eoPrice) || 0 } : o),
    } : g));
    setEditingOption(null);
  };

  const deleteOption = async (groupId: string, optionId: string) => {
    await fetch(`/api/admin/dishes/${dishId}/modifiers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, options: g.options.filter(o => o.id !== optionId) } : g));
  };

  const toggleRequired = async (group: Group) => {
    const newReq = !group.required;
    await fetch(`/api/admin/dishes/${dishId}/modifiers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: group.id, required: newReq, minSelect: newReq ? 1 : 0 }),
    });
    setGroups(prev => prev.map(g => g.id === group.id ? { ...g, required: newReq, minSelect: newReq ? 1 : 0 } : g));
  };

  if (loading) return <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text3)", padding: "12px 0" }}>Cargando modificadores...</p>;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>Modificadores</h3>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{ padding: "5px 12px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>+ Grupo</button>
        )}
      </div>

      {groups.length === 0 && !adding && (
        <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", lineHeight: 1.5 }}>
          Sin modificadores. Agrega un grupo para ofrecer opciones como tamaño, envoltura o extras.
        </p>
      )}

      {/* Create new group form */}
      {adding && (
        <div style={{ background: "var(--adm-hover)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={LBL}>Nombre del grupo</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder='Ej: "Elige tu Roll", "Tamaño"' style={INP} autoFocus />
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", cursor: "pointer" }}>
              <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} /> Obligatorio
            </label>
            <div style={{ flex: 1 }}>
              <label style={LBL}>Máx. opciones</label>
              <input type="number" min={1} max={10} value={newMaxSelect} onChange={e => setNewMaxSelect(Number(e.target.value) || 1)} style={{ ...INP, width: 60 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={createGroup} disabled={saving || !newName.trim()} style={{ padding: "6px 14px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", opacity: !newName.trim() ? 0.5 : 1 }}>Crear grupo</button>
            <button onClick={() => { setAdding(false); setNewName(""); }} style={{ padding: "6px 14px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text3)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Groups list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {groups.map(group => (
          <div key={group.id} style={{ border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
            {/* Group header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--adm-hover)" }}>
              <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", flex: 1 }}>{group.name}</span>
              <button onClick={() => toggleRequired(group)} style={{ padding: "3px 8px", borderRadius: 6, border: "none", fontSize: "0.65rem", fontFamily: F, fontWeight: 600, cursor: "pointer", background: group.required ? "rgba(244,166,35,0.12)" : "var(--adm-card)", color: group.required ? GOLD : "var(--adm-text3)" }}>
                {group.required ? "Obligatorio" : "Opcional"}
              </button>
              {group.maxSelect > 1 && (
                <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)" }}>máx {group.maxSelect}</span>
              )}
              <button onClick={() => deleteGroup(group.id)} style={{ padding: "3px 8px", background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>Eliminar</button>
            </div>

            {/* Options */}
            <div style={{ padding: "6px 14px 10px" }}>
              {group.options.map(opt => (
                <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                  {editingOption === opt.id ? (
                    <>
                      <input value={eoName} onChange={e => setEoName(e.target.value)} style={{ ...INP, flex: 1 }} autoFocus onKeyDown={e => e.key === "Enter" && saveOption(group.id)} />
                      <div style={{ width: 80 }}>
                        <input type="number" value={eoPrice} onChange={e => setEoPrice(e.target.value)} placeholder="+$" style={{ ...INP, textAlign: "right" as const }} />
                      </div>
                      <button onClick={() => saveOption(group.id)} style={{ padding: "4px 8px", background: GOLD, color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", fontWeight: 700, cursor: "pointer" }}>OK</button>
                      <button onClick={() => setEditingOption(null)} style={{ padding: "4px 8px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", cursor: "pointer" }}>X</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{opt.name}</span>
                      {opt.priceAdjustment !== 0 && (
                        <span style={{ fontFamily: F, fontSize: "0.75rem", color: opt.priceAdjustment > 0 ? GOLD : "#4ade80", fontWeight: 600 }}>
                          {opt.priceAdjustment > 0 ? "+" : ""}${Math.abs(opt.priceAdjustment).toLocaleString("es-CL")}
                        </span>
                      )}
                      <button onClick={() => { setEditingOption(opt.id); setEoName(opt.name); setEoPrice(String(opt.priceAdjustment)); }} style={{ padding: "3px 8px", background: "rgba(127,191,220,0.1)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "#7fbfdc", cursor: "pointer", fontWeight: 600 }}>Editar</button>
                      <button onClick={() => deleteOption(group.id, opt.id)} style={{ padding: "3px 8px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "#ef4444", cursor: "pointer" }}>×</button>
                    </>
                  )}
                </div>
              ))}
              <button onClick={() => addOption(group.id)} style={{ marginTop: 8, padding: "5px 12px", background: "none", border: "1px dashed var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", color: GOLD, cursor: "pointer", width: "100%" }}>+ Agregar opción</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
