"use client";
import { useState, useEffect } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { Plus, X, Check, ChevronDown } from "lucide-react";

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
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color || "#94a3b8",
        flexShrink: 0,
      }}
    />
  );
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      title={value ? "Activo — clic para desactivar" : "Inactivo — clic para activar"}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: value ? "#22c55e" : "var(--adm-card-border)",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: value ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Emoji picker grid
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

function EmojiPicker({ selected, onSelect }: { selected: string; onSelect: (e: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selected && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.6rem" }}>{selected}</span>
          <span style={{ fontFamily: "var(--font-body,system-ui)", fontSize: "0.75rem", color: "var(--adm-text3)" }}>
            seleccionado —{" "}
            <button
              type="button"
              onClick={() => onSelect("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontFamily: "inherit", fontSize: "inherit", padding: 0 }}
            >
              quitar
            </button>
          </span>
        </div>
      )}
      {EMOJI_GROUPS.map(group => (
        <div key={group.label}>
          <div style={{ fontFamily: "var(--font-body,system-ui)", fontSize: "0.7rem", fontWeight: 600, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            {group.label}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {group.emojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelect(emoji)}
                title={emoji}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 7,
                  border: selected === emoji ? "2px solid #1a5f3f" : "1.5px solid var(--adm-card-border)",
                  background: selected === emoji ? "rgba(26,95,63,0.15)" : "var(--adm-bg)",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "border-color 0.1s, background 0.1s",
                }}
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
// Form para agregar nueva categoría
// ─────────────────────────────────────────────────────────────────────────────
function AddCategoryForm({
  restaurantId,
  existingGroups,
  onCreated,
  onCancel,
}: {
  restaurantId: string;
  existingGroups: string[];
  onCreated: (cat: Category) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FinancialType>("EXPENSE");
  const [group, setGroup] = useState(existingGroups[0] || "");
  const [newGroup, setNewGroup] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#64748b");
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
      const res = await fetch("/api/admin/financial/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          restaurantId,
          name: name.trim(),
          type,
          group: finalGroup || null,
          icon: icon.trim() || null,
          color: color || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al crear");
      }
      const cat: Category = await res.json();
      onCreated(cat);
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--adm-card-border)",
    background: "var(--adm-bg)",
    color: "var(--adm-text)",
    fontFamily: FB,
    fontSize: "0.875rem",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: FB,
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--adm-text3)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 4,
    display: "block",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--adm-card)",
        border: "1px solid var(--adm-card-border)",
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.95rem", color: "var(--adm-text)" }}>
          Nueva categoría
        </span>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)", padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Nombre */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Nombre *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Meta Ads"
            style={inputStyle}
            required
          />
        </div>

        {/* Tipo */}
        <div>
          <label style={labelStyle}>Tipo</label>
          <select value={type} onChange={e => setType(e.target.value as FinancialType)} style={inputStyle}>
            <option value="EXPENSE">Egreso</option>
            <option value="INCOME">Ingreso</option>
          </select>
        </div>

        {/* Grupo */}
        <div>
          <label style={labelStyle}>Grupo</label>
          <select
            value={group}
            onChange={e => setGroup(e.target.value)}
            style={inputStyle}
          >
            {existingGroups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
            <option value="__new__">+ Nueva categoría de grupo</option>
          </select>
        </div>

        {isNewGroup && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Nombre del nuevo grupo</label>
            <input
              type="text"
              value={newGroup}
              onChange={e => setNewGroup(e.target.value)}
              placeholder="Ej: Inversiones"
              style={inputStyle}
            />
          </div>
        )}

        {/* Icono */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Ícono</label>
          <EmojiPicker selected={icon} onSelect={setIcon} />
        </div>

        {/* Color */}
        <div>
          <label style={labelStyle}>Color (hex)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", padding: 0, background: "none" }}
            />
            <input
              type="text"
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="#64748b"
              style={{ ...inputStyle, flex: 1 }}
              maxLength={7}
            />
          </div>
        </div>
      </div>

      {error && (
        <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "#ef4444", marginBottom: 12 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: "9px 18px",
          borderRadius: 8,
          border: "none",
          background: "#1a5f3f",
          color: "#fff",
          fontFamily: FB,
          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Guardando..." : "Crear categoría"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grupo de categorías
// ─────────────────────────────────────────────────────────────────────────────
function CategoryGroup({
  groupName,
  groupIcon,
  groupColor,
  categories,
  onToggleActive,
}: {
  groupName: string;
  groupIcon: string | null;
  groupColor: string | null;
  categories: Category[];
  onToggleActive: (id: string, value: boolean) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "var(--adm-hover)",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          marginBottom: open ? 2 : 0,
        }}
      >
        {groupIcon && <span style={{ fontSize: "0.95rem" }}>{groupIcon}</span>}
        <span
          style={{
            fontFamily: FB,
            fontSize: "0.8rem",
            fontWeight: 700,
            color: groupColor || "var(--adm-text2)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            flex: 1,
            textAlign: "left",
          }}
        >
          {groupName}
        </span>
        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
          {categories.filter(c => c.isActive).length}/{categories.length}
        </span>
        <ChevronDown
          size={14}
          color="var(--adm-text3)"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {open && (
        <div style={{ paddingLeft: 4 }}>
          {categories.map(cat => (
            <div
              key={cat.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 12px",
                borderBottom: "1px solid var(--adm-card-border)",
                opacity: cat.isActive ? 1 : 0.5,
              }}
            >
              <span style={{ fontSize: "1rem", width: 22, textAlign: "center" }}>{cat.icon || "·"}</span>
              <ColorDot color={cat.color} />
              <span
                style={{
                  flex: 1,
                  fontFamily: FB,
                  fontSize: "0.875rem",
                  color: "var(--adm-text)",
                }}
              >
                {cat.name}
              </span>
              <Toggle
                value={cat.isActive}
                onChange={v => onToggleActive(cat.id, v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
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
  const [showForm, setShowForm] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/admin/financial/categories?restaurantId=${restaurantId}`)
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
    // Optimistic
    setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: value } : c));
    try {
      const res = await fetch("/api/admin/financial/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, restaurantId, isActive: value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revertir
      setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: !value } : c));
    } finally {
      setToggling(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  function handleCreated(cat: Category) {
    setCategories(prev => [...prev, cat]);
    setShowForm(false);
  }

  // Agrupar por tipo y luego por grupo
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

  // Extraer grupos únicos para el formulario
  const allGroups = Array.from(new Set(categories.map(c => c.group).filter(Boolean) as string[]));

  // Determinar icono y color representativo de cada grupo (primer item del grupo)
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

      {/* Botón agregar */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 16px",
            borderRadius: 9,
            border: "1.5px dashed var(--adm-card-border)",
            background: "none",
            color: "var(--adm-text2)",
            fontFamily: FB,
            fontSize: "0.875rem",
            cursor: "pointer",
            marginBottom: 24,
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a5f3f"; (e.currentTarget as HTMLButtonElement).style.color = "#1a5f3f"; }}
          onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--adm-card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--adm-text2)"; }}
        >
          <Plus size={15} />
          Nueva categoría
        </button>
      )}

      {/* Formulario */}
      {showForm && restaurantId && (
        <AddCategoryForm
          restaurantId={restaurantId}
          existingGroups={allGroups}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
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
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: TYPE_COLOR.INCOME,
                  }}
                />
                <h2
                  style={{
                    fontFamily: F,
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "var(--adm-text)",
                    margin: 0,
                  }}
                >
                  {TYPE_LABEL.INCOME}
                </h2>
                <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>
                  {incomeCategories.length} categorías
                </span>
              </div>
              <div
                style={{
                  background: "var(--adm-card)",
                  border: "1px solid var(--adm-card-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                  padding: "8px",
                }}
              >
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
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: TYPE_COLOR.EXPENSE,
                  }}
                />
                <h2
                  style={{
                    fontFamily: F,
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "var(--adm-text)",
                    margin: 0,
                  }}
                >
                  {TYPE_LABEL.EXPENSE}
                </h2>
                <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>
                  {expenseCategories.length} categorías
                </span>
              </div>
              <div
                style={{
                  background: "var(--adm-card)",
                  border: "1px solid var(--adm-card-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                  padding: "8px",
                }}
              >
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
                    />
                  );
                })}
              </div>
            </section>
          )}

          {categories.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "48px 0",
                fontFamily: FB,
                color: "var(--adm-text3)",
              }}
            >
              No hay categorías configuradas aún.
            </div>
          )}
        </>
      )}
    </div>
  );
}
