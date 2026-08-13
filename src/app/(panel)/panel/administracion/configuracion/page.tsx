"use client";
import { useState, useEffect } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { Plus, X, ChevronDown, User, Zap, Trash2, Edit2 } from "lucide-react";

const F = "var(--font-display, system-ui)";
const FB = "var(--font-body, system-ui)";

type FinancialType = "INCOME" | "EXPENSE";

type Category = {
  id: string;
  name: string;
  type: FinancialType;
  group: string | null;
  color: string | null;
  icon: string | null;
  position: number;
  isActive: boolean;
};

const TYPE_LABEL: Record<FinancialType, string> = {
  INCOME: "Ingresos",
  EXPENSE: "Egresos",
};

const TYPE_COLOR: Record<FinancialType, string> = {
  INCOME: "#22c55e",
  EXPENSE: "#ef4444",
};

function ColorDot({ color }: { color: string | null }) {
  return (
    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color || "#94a3b8", flexShrink: 0 }} />
  );
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      title={value ? "Activo — clic para desactivar" : "Inactivo — clic para activar"}
      style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: disabled ? "not-allowed" : "pointer", background: value ? "#22c55e" : "var(--adm-card-border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
    >
      <span style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Emoji groups
// ─────────────────────────────────────────────────────────────────────────────
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: "Proveedores / Alimentos", emojis: ["🥩","🐟","🥦","🧅","🍅","🥑","☕","🍵","🥛","🫙","🍄","🌾","🫒","🧄","🫚"] },
  { label: "Operaciones", emojis: ["🔌","💧","🔥","🏠","📦","🧹","🪲","🔧","🛠️","📡","🔒","⚡","🧯","🚪","🪑"] },
  { label: "Administración", emojis: ["📊","📋","🧾","💼","📑","🖊️","🗂️","🏦","💳","📬","📩","🔏","📎","🗃️","💰"] },
  { label: "Marketing", emojis: ["📣","📢","🎯","📱","🌐","📸","🎨","✉️","⭐","💬","🤝","📰","🎁","🏷️","🎪"] },
  { label: "RRHH", emojis: ["👥","👤","🎓","💪","🏆","🎖️","🩺","🧢","🚌","🎉","🤲","👔","🪪","🛡️","📅"] },
  { label: "Inversiones", emojis: ["📈","🏗️","🛋️","🖥️","⚙️","🔬","🧪","🪛","🔑","🏢","💡","🎯","🚀","🏅","💎"] },
  { label: "Dinero / Impuestos", emojis: ["💵","💶","💷","💴","🏧","⚖️","📜","🧮","💹","🪙","🏛️","📉","🗒️","📐","🔢"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// EmojiPicker (grid, for use inside modal)
// ─────────────────────────────────────────────────────────────────────────────
function EmojiPickerGrid({ selected, onSelect }: { selected: string; onSelect: (e: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selected && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.6rem" }}>{selected}</span>
          <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>
            seleccionado —{" "}
            <button type="button" onClick={() => onSelect("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontFamily: "inherit", fontSize: "inherit", padding: 0 }}>
              quitar
            </button>
          </span>
        </div>
      )}
      {EMOJI_GROUPS.map(group => (
        <div key={group.label}>
          <div style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            {group.label}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {group.emojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelect(emoji)}
                title={emoji}
                style={{ width: 34, height: 34, borderRadius: 7, border: selected === emoji ? "2px solid #1a5f3f" : "1.5px solid var(--adm-card-border)", background: selected === emoji ? "rgba(26,95,63,0.15)" : "var(--adm-bg)", fontSize: "1.1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.1s, background 0.1s" }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IconPickerButton — muestra el ícono actual; al hacer clic abre popup con grid
// ─────────────────────────────────────────────────────────────────────────────
function IconPickerButton({ selected, onSelect }: { selected: string; onSelect: (e: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Cambiar ícono"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: selected ? "6px 10px" : "7px 12px",
          borderRadius: 8, border: "1.5px dashed var(--adm-card-border)",
          background: "var(--adm-bg)", cursor: "pointer",
          fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)",
          transition: "border-color 0.15s",
        }}
        onMouseOver={e => (e.currentTarget.style.borderColor = "#1a5f3f")}
        onMouseOut={e => (e.currentTarget.style.borderColor = "var(--adm-card-border)")}
      >
        {selected
          ? <><span style={{ fontSize: "1.3rem" }}>{selected}</span><span style={{ fontSize: "0.75rem", color: "var(--adm-text3)" }}>cambiar</span></>
          : <><span style={{ fontSize: "0.9rem" }}>😶</span><span>Agregar ícono <span style={{ color: "var(--adm-text3)" }}>(opcional)</span></span></>
        }
      </button>

      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "var(--adm-card)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 460, maxHeight: "75vh", overflowY: "auto", border: "1px solid var(--adm-card-border)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.95rem", color: "var(--adm-text)" }}>Elige un ícono</span>
              <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}><X size={16} /></button>
            </div>
            <EmojiPickerGrid
              selected={selected}
              onSelect={v => { onSelect(v); setOpen(false); }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared input styles
// ─────────────────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--adm-card-border)", background: "var(--adm-bg)",
  color: "var(--adm-text)", fontFamily: FB, fontSize: "0.875rem",
  outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontFamily: FB, fontSize: "0.75rem", fontWeight: 600, color: "var(--adm-text3)",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block",
};

// ─────────────────────────────────────────────────────────────────────────────
// CategoryForm — compartido por create y edit
// ─────────────────────────────────────────────────────────────────────────────
function CategoryForm({
  initial,
  existingGroups,
  restaurantId,
  onSaved,
  onCancel,
}: {
  initial?: Category;
  existingGroups: string[];
  restaurantId: string;
  onSaved: (cat: Category) => void;
  onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<FinancialType>(initial?.type ?? "EXPENSE");
  const [group, setGroup] = useState(initial?.group ?? (existingGroups[0] || ""));
  const [newGroup, setNewGroup] = useState("");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  const [color, setColor] = useState(initial?.color ?? "#64748b");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isNewGroup = group === "__new__";
  const finalGroup = isNewGroup ? newGroup.trim() : group;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    if (isNewGroup && !newGroup.trim()) { setError("Indica el nombre del nuevo grupo"); return; }
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("qc_admin_token") || sessionStorage.getItem("qc_admin_token") || "";
      const method = isEdit ? "PUT" : "POST";
      const body = isEdit
        ? { id: initial!.id, restaurantId, name: name.trim(), group: finalGroup || null, icon: icon.trim() || null, color: color || null }
        : { restaurantId, name: name.trim(), type, group: finalGroup || null, icon: icon.trim() || null, color: color || null };

      const res = await fetch("/api/admin/financial/categories", {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al guardar");
      }
      const cat: Category = await res.json();
      onSaved(cat);
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 20, marginBottom: 24 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.95rem", color: "var(--adm-text)" }}>
          {isEdit ? `Editar: ${initial!.name}` : "Nueva categoría"}
        </span>
        <button type="button" onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)", padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Nombre */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Nombre *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Meta Ads" style={inputStyle} required />
        </div>

        {/* Tipo — solo en creación */}
        {!isEdit && (
          <div>
            <label style={labelStyle}>Tipo</label>
            <select value={type} onChange={e => setType(e.target.value as FinancialType)} style={inputStyle}>
              <option value="EXPENSE">Egreso</option>
              <option value="INCOME">Ingreso</option>
            </select>
          </div>
        )}

        {/* Grupo */}
        <div style={isEdit ? { gridColumn: "1 / -1" } : {}}>
          <label style={labelStyle}>Grupo</label>
          <select value={group} onChange={e => setGroup(e.target.value)} style={inputStyle}>
            <option value="">Sin grupo</option>
            {existingGroups.map(g => <option key={g} value={g}>{g}</option>)}
            <option value="__new__">+ Nuevo grupo…</option>
          </select>
        </div>

        {isNewGroup && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Nombre del nuevo grupo</label>
            <input type="text" value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="Ej: Franquicia" style={inputStyle} />
          </div>
        )}

        {/* Ícono — botón que abre popup */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Ícono <span style={{ textTransform: "none", fontWeight: 400 }}>(opcional)</span></label>
          <IconPickerButton selected={icon} onSelect={setIcon} />
        </div>

        {/* Color */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", padding: 0, background: "none" }} />
            <input type="text" value={color} onChange={e => setColor(e.target.value)} placeholder="#64748b" style={{ ...inputStyle, flex: 1 }} maxLength={7} />
          </div>
        </div>
      </div>

      {error && <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "#ef4444", marginBottom: 12 }}>{error}</p>}

      <button
        type="submit"
        disabled={saving}
        style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#1a5f3f", color: "#fff", fontFamily: FB, fontWeight: 600, fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
      >
        {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear categoría"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grupo de categorías
// ─────────────────────────────────────────────────────────────────────────────
function CategoryGroup({
  groupName, groupIcon, groupColor, categories, onToggleActive, onEdit,
}: {
  groupName: string;
  groupIcon: string | null;
  groupColor: string | null;
  categories: Category[];
  onToggleActive: (id: string, value: boolean) => void;
  onEdit: (cat: Category) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--adm-hover)", border: "none", borderRadius: 8, cursor: "pointer", marginBottom: open ? 2 : 0 }}
      >
        {groupIcon && <span style={{ fontSize: "0.95rem" }}>{groupIcon}</span>}
        <span style={{ fontFamily: FB, fontSize: "0.8rem", fontWeight: 700, color: groupColor || "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.07em", flex: 1, textAlign: "left" }}>
          {groupName}
        </span>
        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
          {categories.filter(c => c.isActive).length}/{categories.length}
        </span>
        <ChevronDown size={14} color="var(--adm-text3)" style={{ transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }} />
      </button>

      {open && (
        <div style={{ paddingLeft: 4 }}>
          {categories.map(cat => (
            <div
              key={cat.id}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderBottom: "1px solid var(--adm-card-border)", opacity: cat.isActive ? 1 : 0.5 }}
            >
              <span style={{ fontSize: "1rem", width: 22, textAlign: "center" }}>{cat.icon || "·"}</span>
              <ColorDot color={cat.color} />
              <span style={{ flex: 1, fontFamily: FB, fontSize: "0.875rem", color: "var(--adm-text)" }}>{cat.name}</span>
              <button
                onClick={() => onEdit(cat)}
                title="Editar"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)", padding: "3px 5px", borderRadius: 5, flexShrink: 0 }}
                onMouseOver={e => (e.currentTarget.style.color = "#1a5f3f")}
                onMouseOut={e => (e.currentTarget.style.color = "var(--adm-text3)")}
              >
                <Edit2 size={13} />
              </button>
              <Toggle value={cat.isActive} onChange={v => onToggleActive(cat.id, v)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Agentes de compras
// ─────────────────────────────────────────────────────────────────────────────
type CashAgent = { id: string; name: string; bankPatterns: string[]; isActive: boolean };
type Rule = { id: string; pattern: string; categoryId: string | null; isSplit: boolean; usageCount: number; confidence: number };

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ color: "var(--adm-text3)" }}>{icon}</span>
      <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: "1rem", color: "var(--adm-text)", margin: 0 }}>{title}</h2>
      {count !== undefined && <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>{count}</span>}
    </div>
  );
}

function AgentsSection({ restaurantId }: { restaurantId: string }) {
  const [agents, setAgents] = useState<CashAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [patterns, setPatterns] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/financial/agents?restaurantId=${restaurantId}`)
      .then(r => r.json()).then(setAgents).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const bankPatterns = patterns.split(",").map(p => p.trim()).filter(Boolean);
    const method = editId ? "PUT" : "POST";
    const body = editId
      ? { id: editId, restaurantId, name: name.trim(), bankPatterns }
      : { restaurantId, name: name.trim(), bankPatterns };
    const res = await fetch("/api/admin/financial/agents", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (editId) setAgents(prev => prev.map(a => a.id === editId ? data : a));
    else setAgents(prev => [...prev, data]);
    setShowForm(false); setEditId(null); setName(""); setPatterns("");
    setSaving(false);
  }

  async function deactivate(id: string) {
    await fetch("/api/admin/financial/agents", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, restaurantId }),
    });
    setAgents(prev => prev.map(a => a.id === id ? { ...a, isActive: false } : a));
  }

  function startEdit(a: CashAgent) {
    setEditId(a.id); setName(a.name); setPatterns(a.bankPatterns.join(", "));
    setShowForm(true);
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "1px solid var(--adm-card-border)", background: "var(--adm-bg)",
    color: "var(--adm-text)", fontFamily: FB, fontSize: "0.875rem",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon={<User size={16} />} title="Agentes de compras" count={agents.filter(a => a.isActive).length} />
      <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)", marginBottom: 16, marginTop: -8 }}>
        Personas que retiran dinero del banco para comprar cosas. Sus transferencias se identifican automáticamente en la conciliación.
      </p>

      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
        {loading ? (
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", padding: "16px", margin: 0 }}>Cargando...</p>
        ) : agents.length === 0 ? (
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", padding: "16px", margin: 0 }}>Sin agentes configurados.</p>
        ) : agents.map((a, i) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < agents.length - 1 ? "1px solid var(--adm-card-border)" : "none", opacity: a.isActive ? 1 : 0.45 }}>
            <span style={{ fontSize: "1.1rem" }}>👤</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: FB, fontSize: "0.875rem", fontWeight: 600, color: "var(--adm-text)" }}>{a.name}</p>
              <p style={{ margin: "2px 0 0", fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Patrones: {a.bankPatterns.join(", ") || "—"}
              </p>
            </div>
            <button onClick={() => startEdit(a)} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)", padding: 4 }}>
              <Edit2 size={13} />
            </button>
            {a.isActive && (
              <button onClick={() => deactivate(a.id)} title="Desactivar" style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {showForm ? (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 16, marginBottom: 8 }}>
          <p style={{ fontFamily: F, fontWeight: 700, fontSize: "0.9rem", color: "var(--adm-text)", margin: "0 0 12px" }}>
            {editId ? "Editar agente" : "Nuevo agente"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Nombre *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Carlos Gómez" style={inp} />
            </div>
            <div>
              <label style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                Patrones en banco <span style={{ textTransform: "none", fontWeight: 400 }}>(separados por coma)</span>
              </label>
              <input value={patterns} onChange={e => setPatterns(e.target.value)} placeholder="Carlos Gómez, Carlos Gomez, C GOMEZ" style={inp} />
              <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>
                Texto que aparece en la descripción de las transferencias del banco a esta persona.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={save} disabled={saving || !name.trim()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#1a5f3f", color: "#fff", fontFamily: FB, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Guardando..." : editId ? "Actualizar" : "Crear agente"}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); setName(""); setPatterns(""); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "none", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.875rem", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1.5px dashed var(--adm-card-border)", background: "none", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.85rem", cursor: "pointer" }}>
          <Plus size={14} /> Agregar agente
        </button>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reglas automáticas de categorización
// ─────────────────────────────────────────────────────────────────────────────
function RulesSection({ restaurantId, categories }: { restaurantId: string; categories: { id: string; name: string; icon: string | null }[] }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const catById = new Map(categories.map(c => [c.id, c]));

  useEffect(() => {
    fetch(`/api/admin/financial/rules?restaurantId=${restaurantId}`)
      .then(r => r.json()).then(data => { if (Array.isArray(data)) setRules(data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  async function deleteRule(id: string) {
    setDeletingId(id);
    await fetch("/api/admin/financial/rules", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, restaurantId }),
    });
    setRules(prev => prev.filter(r => r.id !== id));
    setDeletingId(null);
  }

  const pct = (n: number) => Math.round(n * 100);

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon={<Zap size={16} />} title="Reglas automáticas" count={rules.length} />
      <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)", marginBottom: 16, marginTop: -8 }}>
        Patrones aprendidos al categorizar movimientos bancarios. Se aplican automáticamente al importar el XLSX.
      </p>

      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", padding: "16px", margin: 0 }}>Cargando...</p>
        ) : rules.length === 0 ? (
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", padding: "16px", margin: 0 }}>
            Sin reglas aún. Se crean automáticamente cuando categorizas movimientos bancarios.
          </p>
        ) : rules.map((rule, i) => {
          const cat = rule.categoryId ? catById.get(rule.categoryId) : null;
          return (
            <div key={rule.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < rules.length - 1 ? "1px solid var(--adm-card-border)" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <code style={{ fontFamily: "'Courier New', monospace", fontSize: "0.78rem", background: "var(--adm-hover)", padding: "2px 6px", borderRadius: 4, color: "var(--adm-text2)" }}>{rule.pattern}</code>
                  <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>→</span>
                  {rule.isSplit ? (
                    <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "#3b82f6" }}>Split</span>
                  ) : cat ? (
                    <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}>{cat.icon && `${cat.icon} `}{cat.name}</span>
                  ) : (
                    <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Sin categoría</span>
                  )}
                </div>
                <p style={{ margin: "2px 0 0", fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)" }}>
                  Usada {rule.usageCount} {rule.usageCount === 1 ? "vez" : "veces"} · confianza {pct(rule.confidence)}%
                </p>
              </div>
              <button onClick={() => deleteRule(rule.id)} disabled={deletingId === rule.id} title="Eliminar regla" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)", padding: 4, flexShrink: 0, opacity: deletingId === rule.id ? 0.4 : 1 }}>
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principal
// ─────────────────────────────────────────────────────────────────────────────
export default function ConfiguracionFinanciera() {
  const { selectedRestaurantId: restaurantId } = usePanelSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    // ?all=true para ver también las inactivas
    fetch(`/api/admin/financial/categories?restaurantId=${restaurantId}&all=true`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
        else setError(data.error || "Error al cargar");
      })
      .catch(() => setError("Error de red"))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  async function handleToggleActive(id: string, value: boolean) {
    if (toggling.has(id)) return;
    setToggling(prev => new Set(prev).add(id));
    setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: value } : c));
    try {
      const res = await fetch("/api/admin/financial/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, restaurantId, isActive: value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: !value } : c));
    } finally {
      setToggling(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  function handleCreated(cat: Category) {
    setCategories(prev => [...prev, cat]);
    setShowCreateForm(false);
  }

  function handleEdited(cat: Category) {
    setCategories(prev => prev.map(c => c.id === cat.id ? cat : c));
    setEditingCat(null);
  }

  const incomeCategories = categories.filter(c => c.type === "INCOME");
  const expenseCategories = categories.filter(c => c.type === "EXPENSE");

  function groupBy(cats: Category[]) {
    const map = new Map<string, Category[]>();
    for (const cat of cats) {
      const g = cat.group || "Sin grupo";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(cat);
    }
    return map;
  }

  const allGroups = Array.from(new Set(categories.map(c => c.group).filter(Boolean) as string[]));

  function getGroupMeta(cats: Category[]) {
    const first = cats.find(c => c.icon || c.color) || cats[0];
    return { icon: first?.icon || null, color: first?.color || null };
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: F, fontWeight: 800, fontSize: "1.45rem", color: "var(--adm-text)", margin: 0 }}>
          Configuración financiera
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.875rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>
          Gestiona las categorías de ingresos y egresos de tu local.
        </p>
      </div>

      {/* Formulario crear */}
      {!showCreateForm && !editingCat && (
        <button
          onClick={() => setShowCreateForm(true)}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, border: "1.5px dashed var(--adm-card-border)", background: "none", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.875rem", cursor: "pointer", marginBottom: 24, transition: "border-color 0.15s, color 0.15s" }}
          onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a5f3f"; (e.currentTarget as HTMLButtonElement).style.color = "#1a5f3f"; }}
          onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--adm-card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--adm-text2)"; }}
        >
          <Plus size={15} /> Nueva categoría
        </button>
      )}

      {showCreateForm && restaurantId && (
        <CategoryForm
          existingGroups={allGroups}
          restaurantId={restaurantId}
          onSaved={handleCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {editingCat && restaurantId && (
        <CategoryForm
          initial={editingCat}
          existingGroups={allGroups}
          restaurantId={restaurantId}
          onSaved={handleEdited}
          onCancel={() => setEditingCat(null)}
        />
      )}

      {/* Contenido */}
      {loading ? (
        <div style={{ fontFamily: FB, color: "var(--adm-text3)", padding: "32px 0", textAlign: "center" }}>
          Cargando categorías...
        </div>
      ) : error ? (
        <div style={{ fontFamily: FB, color: "#ef4444", padding: "16px 0" }}>{error}</div>
      ) : (
        <>
          {/* INGRESOS */}
          {incomeCategories.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: TYPE_COLOR.INCOME }} />
                <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: "1rem", color: "var(--adm-text)", margin: 0 }}>{TYPE_LABEL.INCOME}</h2>
                <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>{incomeCategories.length} categorías</span>
              </div>
              <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden", padding: "8px" }}>
                {Array.from(groupBy(incomeCategories)).map(([gName, gCats]) => {
                  const meta = getGroupMeta(gCats);
                  return (
                    <CategoryGroup
                      key={gName}
                      groupName={gName}
                      groupIcon={meta.icon}
                      groupColor={meta.color}
                      categories={gCats}
                      onToggleActive={handleToggleActive}
                      onEdit={cat => { setEditingCat(cat); setShowCreateForm(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* EGRESOS */}
          {expenseCategories.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: TYPE_COLOR.EXPENSE }} />
                <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: "1rem", color: "var(--adm-text)", margin: 0 }}>{TYPE_LABEL.EXPENSE}</h2>
                <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>{expenseCategories.length} categorías</span>
              </div>
              <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden", padding: "8px" }}>
                {Array.from(groupBy(expenseCategories)).map(([gName, gCats]) => {
                  const meta = getGroupMeta(gCats);
                  return (
                    <CategoryGroup
                      key={gName}
                      groupName={gName}
                      groupIcon={meta.icon}
                      groupColor={meta.color}
                      categories={gCats}
                      onToggleActive={handleToggleActive}
                      onEdit={cat => { setEditingCat(cat); setShowCreateForm(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {categories.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", fontFamily: FB, color: "var(--adm-text3)" }}>
              No hay categorías configuradas aún.
            </div>
          )}
        </>
      )}

      {/* Separador */}
      <div style={{ borderTop: "1px solid var(--adm-card-border)", margin: "8px 0 36px" }} />

      {/* Agentes de compras */}
      {restaurantId && <AgentsSection restaurantId={restaurantId} />}

      {/* Reglas automáticas */}
      {restaurantId && (
        <RulesSection
          restaurantId={restaurantId}
          categories={categories.map(c => ({ id: c.id, name: c.name, icon: c.icon }))}
        />
      )}
    </div>
  );
}
