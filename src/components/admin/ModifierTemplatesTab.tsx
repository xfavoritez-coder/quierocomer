"use client";

import { useState, useEffect } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";
const LBL: React.CSSProperties = { fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 };
const INP: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" as const };

interface Option { id: string; name: string; priceAdjustment: number; isDefault: boolean; position: number; }
interface Group { id: string; name: string; required: boolean; minSelect: number; maxSelect: number; position: number; options: Option[]; }
interface Template { id: string; name: string; groups: Group[]; dishes: { id: string; name: string }[]; }

interface Props { restaurantId: string; }

export default function ModifierTemplatesTab({ restaurantId }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Editing
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [eoName, setEoName] = useState("");
  const [eoPrice, setEoPrice] = useState("");

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/admin/modifier-templates?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTemplates(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
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
    if (res.ok) { setTemplates(prev => [t, ...prev]); setNewName(""); setCreating(false); setExpanded(t.id); }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    await fetch("/api/admin/modifier-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: id }) });
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const addGroup = async (templateId: string) => {
    const res = await fetch("/api/admin/modifier-templates", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addGroupToTemplate: templateId, name: "Nuevo grupo", required: true, maxSelect: 1 }),
    });
    const group = await res.json();
    if (res.ok) setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: [...t.groups, { ...group, options: group.options || [] }] } : t));
  };

  const updateGroup = async (templateId: string, groupId: string, data: Record<string, any>) => {
    await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId, ...data }) });
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: t.groups.map(g => g.id === groupId ? { ...g, ...data } : g) } : t));
  };

  const deleteGroup = async (templateId: string, groupId: string) => {
    await fetch("/api/admin/modifier-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId }) });
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: t.groups.filter(g => g.id !== groupId) } : t));
  };

  const addOption = async (templateId: string, groupId: string) => {
    const res = await fetch("/api/admin/modifier-templates", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addOptionToGroup: groupId, name: "Nueva opción" }),
    });
    const opt = await res.json();
    if (res.ok) {
      setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: t.groups.map(g => g.id === groupId ? { ...g, options: [...g.options, opt] } : g) } : t));
      setEditingOption(opt.id); setEoName(opt.name); setEoPrice("0");
    }
  };

  const saveOption = async (templateId: string, groupId: string) => {
    if (!editingOption) return;
    await fetch("/api/admin/modifier-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId: editingOption, name: eoName, priceAdjustment: Number(eoPrice) || 0 }) });
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: t.groups.map(g => g.id === groupId ? { ...g, options: g.options.map(o => o.id === editingOption ? { ...o, name: eoName, priceAdjustment: Number(eoPrice) || 0 } : o) } : g) } : t));
    setEditingOption(null);
  };

  const deleteOption = async (templateId: string, groupId: string, optionId: string) => {
    await fetch("/api/admin/modifier-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId }) });
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, groups: t.groups.map(g => g.id === groupId ? { ...g, options: g.options.filter(o => o.id !== optionId) } : g) } : t));
  };

  if (loading) return <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text3)", padding: 32, textAlign: "center" }}>Cargando modificadores...</p>;

  return (
    <div>
      <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Crea plantillas de modificadores reutilizables y asígnalas a tus platos. Si cambias una opción aquí, se actualiza en todos los platos que la usen.
      </p>

      {/* Create */}
      {creating ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && createTemplate()} placeholder='Ej: "Envolturas", "Tamaños", "Salsas"' style={{ flex: 1, padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }} autoFocus />
          <button onClick={createTemplate} disabled={saving || !newName.trim()} style={{ padding: "10px 18px", background: GOLD, color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: !newName.trim() ? 0.5 : 1 }}>Crear</button>
          <button onClick={() => { setCreating(false); setNewName(""); }} style={{ padding: "10px 14px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", cursor: "pointer" }}>X</button>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <button onClick={() => setCreating(true)} style={{ padding: "10px 18px", background: GOLD, color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>+ Nueva plantilla</button>
        </div>
      )}

      {/* Templates list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {templates.map(template => {
          const isExpanded = expanded === template.id;
          return (
            <div key={template.id} style={{ border: "1px solid var(--adm-card-border)", borderRadius: 14, overflow: "hidden", background: "var(--adm-card)" }}>
              {/* Header */}
              <button onClick={() => setExpanded(isExpanded ? null : template.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)", flex: 1 }}>{template.name}</span>
                <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{template.groups.length} grupo{template.groups.length !== 1 ? "s" : ""} · {template.dishes.length} plato{template.dishes.length !== 1 ? "s" : ""}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--adm-text3)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--adm-card-border)" }}>
                  {/* Assigned dishes */}
                  {template.dishes.length > 0 && (
                    <div style={{ margin: "12px 0", display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {template.dishes.map(d => (
                        <span key={d.id} style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: 50, background: "rgba(244,166,35,0.08)", color: GOLD, fontFamily: FB }}>{d.name}</span>
                      ))}
                    </div>
                  )}

                  {/* Groups */}
                  {template.groups.map(group => (
                    <div key={group.id} style={{ border: "1px solid var(--adm-card-border)", borderRadius: 10, marginTop: 12, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--adm-hover)" }}>
                        <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)", flex: 1 }}>{group.name}</span>
                        <button onClick={() => updateGroup(template.id, group.id, { required: !group.required, minSelect: !group.required ? 1 : 0 })} style={{ padding: "2px 8px", borderRadius: 6, border: "none", fontSize: "0.62rem", fontFamily: F, fontWeight: 600, cursor: "pointer", background: group.required ? "rgba(244,166,35,0.12)" : "var(--adm-card)", color: group.required ? GOLD : "var(--adm-text3)" }}>
                          {group.required ? "Obligatorio" : "Opcional"}
                        </button>
                        {group.maxSelect > 1 && <span style={{ fontFamily: F, fontSize: "0.62rem", color: "var(--adm-text3)" }}>máx {group.maxSelect}</span>}
                        <button onClick={() => deleteGroup(template.id, group.id)} style={{ padding: "2px 8px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontSize: "0.62rem", fontFamily: F, color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>Eliminar</button>
                      </div>
                      <div style={{ padding: "6px 12px 10px" }}>
                        {group.options.map(opt => (
                          <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                            {editingOption === opt.id ? (
                              <>
                                <input value={eoName} onChange={e => setEoName(e.target.value)} style={{ ...INP, flex: 1 }} autoFocus onKeyDown={e => e.key === "Enter" && saveOption(template.id, group.id)} />
                                <div style={{ width: 75 }}><input type="number" value={eoPrice} onChange={e => setEoPrice(e.target.value)} placeholder="+$" style={{ ...INP, textAlign: "right" as const }} /></div>
                                <button onClick={() => saveOption(template.id, group.id)} style={{ padding: "3px 8px", background: GOLD, color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", fontWeight: 700, cursor: "pointer" }}>OK</button>
                                <button onClick={() => setEditingOption(null)} style={{ padding: "3px 8px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", cursor: "pointer" }}>X</button>
                              </>
                            ) : (
                              <>
                                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{opt.name}</span>
                                {opt.priceAdjustment !== 0 && <span style={{ fontFamily: F, fontSize: "0.75rem", color: opt.priceAdjustment > 0 ? GOLD : "#4ade80", fontWeight: 600 }}>{opt.priceAdjustment > 0 ? "+" : ""}${Math.abs(opt.priceAdjustment).toLocaleString("es-CL")}</span>}
                                <button onClick={() => { setEditingOption(opt.id); setEoName(opt.name); setEoPrice(String(opt.priceAdjustment)); }} style={{ padding: "2px 8px", background: "rgba(127,191,220,0.1)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.62rem", color: "#7fbfdc", cursor: "pointer", fontWeight: 600 }}>Editar</button>
                                <button onClick={() => deleteOption(template.id, group.id, opt.id)} style={{ padding: "2px 8px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.62rem", color: "#ef4444", cursor: "pointer" }}>×</button>
                              </>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addOption(template.id, group.id)} style={{ marginTop: 8, padding: "5px 12px", background: "none", border: "1px dashed var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.72rem", color: GOLD, cursor: "pointer", width: "100%" }}>+ Agregar opción</button>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => addGroup(template.id)} style={{ padding: "8px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: GOLD, cursor: "pointer", fontWeight: 600 }}>+ Agregar grupo</button>
                    <button onClick={() => deleteTemplate(template.id)} style={{ padding: "8px 14px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>Eliminar plantilla</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {templates.length === 0 && !creating && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text3)", marginBottom: 4 }}>Sin plantillas de modificadores</p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Crea tu primera plantilla para ofrecer opciones como envolturas, tamaños o extras.</p>
          </div>
        )}
      </div>
    </div>
  );
}
