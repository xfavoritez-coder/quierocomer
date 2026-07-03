"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { toast } from "sonner";
import { Plus, Star, StarOff, Pencil, Trash2, Check, X } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GREEN = "#16a34a";

const CAT_LABELS: Record<string, string> = {
  PROTEINA: "Proteínas", VERDURA_FRUTA: "Verduras y Frutas",
  ABARROTE: "Abarrotes", LACTEO: "Lácteos", PANADERIA: "Panadería",
  BEBIDA: "Bebidas", LICOR: "Licores", DESECHABLE: "Desechables",
  LIMPIEZA: "Limpieza", OTRO: "Otros",
};
const CAT_ICONS: Record<string, string> = {
  PROTEINA: "🥩", VERDURA_FRUTA: "🥦", ABARROTE: "🫙", LACTEO: "🥛",
  PANADERIA: "🍞", BEBIDA: "🧃", LICOR: "🍷", DESECHABLE: "🥡",
  LIMPIEZA: "🧹", OTRO: "📦",
};
const UNIDAD_LABELS: Record<string, string> = {
  KG: "kg", GR: "gr", LT: "lt", ML: "ml", UN: "unidad",
  DOCENA: "docena", PAQUETE: "paquete", CAJA: "caja", BANDEJA: "bandeja", ATADO: "atado",
};
const CATEGORIAS = Object.keys(CAT_LABELS);
const UNIDADES = Object.keys(UNIDAD_LABELS);

interface Insumo {
  id: string; nombre: string; categoria: string; unidadBase: string;
  esCritico: boolean; ordenConteo: number | null; ultimoPrecio: number | null;
}

interface EditState {
  id: string; nombre: string; categoria: string; unidadBase: string;
}

const inputSt: React.CSSProperties = {
  padding: "7px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
  borderRadius: 7, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)",
  outline: "none", width: "100%", boxSizing: "border-box",
};
const selectSt: React.CSSProperties = { ...inputSt, cursor: "pointer" };

export default function InsumosPage() {
  const { selectedRestaurantId } = useAdminSession();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("ALL");
  const [editState, setEditState] = useState<EditState | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newCat, setNewCat] = useState("PROTEINA");
  const [newUnidad, setNewUnidad] = useState("KG");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!selectedRestaurantId) return;
    try {
      const res = await fetch(`/api/admin/control/insumos?restaurantId=${selectedRestaurantId}`);
      if (res.ok) setInsumos(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedRestaurantId]);

  async function toggleCritico(insumo: Insumo) {
    const res = await fetch(`/api/admin/control/insumos/${insumo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ esCritico: !insumo.esCritico }),
    });
    if (res.ok) {
      setInsumos(prev => prev.map(i => i.id === insumo.id ? { ...i, esCritico: !i.esCritico } : i));
    }
  }

  async function saveEdit() {
    if (!editState) return;
    setSaving(true);
    const res = await fetch(`/api/admin/control/insumos/${editState.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editState.nombre, categoria: editState.categoria, unidadBase: editState.unidadBase }),
    });
    if (res.ok) {
      const updated = await res.json();
      setInsumos(prev => prev.map(i => i.id === editState.id ? { ...i, ...updated } : i));
      setEditState(null);
      toast.success("Insumo actualizado");
    } else {
      toast.error("Error al actualizar");
    }
    setSaving(false);
  }

  async function deleteInsumo(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    const res = await fetch(`/api/admin/control/insumos/${id}`, { method: "DELETE" });
    if (res.ok) {
      setInsumos(prev => prev.filter(i => i.id !== id));
      toast.success("Insumo eliminado");
    } else {
      toast.error("Error al eliminar");
    }
  }

  async function addInsumo() {
    if (!newNombre.trim()) { toast.error("Ingresa un nombre"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/control/insumos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: selectedRestaurantId, nombre: newNombre.trim(), categoria: newCat, unidadBase: newUnidad }),
    });
    if (res.ok) {
      const created = await res.json();
      setInsumos(prev => [...prev, created]);
      setNewNombre(""); setShowAdd(false);
      toast.success("Insumo agregado");
    } else {
      const err = await res.json();
      toast.error(err.error || "Error al agregar");
    }
    setSaving(false);
  }

  if (loading) return <SkeletonLoading />;

  const filtered = filterCat === "ALL" ? insumos : insumos.filter(i => i.categoria === filterCat);
  const grouped: Record<string, Insumo[]> = {};
  filtered.forEach(i => { if (!grouped[i.categoria]) grouped[i.categoria] = []; grouped[i.categoria].push(i); });

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px" }}>
            Catálogo de insumos
          </h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>
            {insumos.length} insumos · {insumos.filter(i => i.esCritico).length} críticos
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); setNewNombre(""); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", background: GREEN, color: "#fff",
            border: "none", borderRadius: 8, cursor: "pointer",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600,
          }}
        >
          <Plus size={15} /> Agregar insumo
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 180px" }}>
            <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.4px", display: "block", marginBottom: 4 }}>Nombre</label>
            <input
              style={inputSt} value={newNombre} autoFocus
              onChange={e => setNewNombre(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addInsumo(); if (e.key === "Escape") setShowAdd(false); }}
              placeholder="ej. Pechuga de pollo"
            />
          </div>
          <div style={{ flex: "0 1 150px" }}>
            <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.4px", display: "block", marginBottom: 4 }}>Categoría</label>
            <select style={selectSt} value={newCat} onChange={e => setNewCat(e.target.value)}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {CAT_LABELS[c]}</option>)}
            </select>
          </div>
          <div style={{ flex: "0 1 110px" }}>
            <label style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.4px", display: "block", marginBottom: 4 }}>Unidad</label>
            <select style={selectSt} value={newUnidad} onChange={e => setNewUnidad(e.target.value)}>
              {UNIDADES.map(u => <option key={u} value={u}>{UNIDAD_LABELS[u]}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={addInsumo} disabled={saving} style={{ padding: "7px 14px", background: GREEN, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 600 }}>
              {saving ? "..." : "Guardar"}
            </button>
            <button onClick={() => setShowAdd(false)} style={{ padding: "7px 10px", background: "var(--adm-hover)", color: "var(--adm-text)", border: "none", borderRadius: 7, cursor: "pointer" }}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["ALL", ...CATEGORIAS.filter(c => insumos.some(i => i.categoria === c))].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            style={{
              padding: "5px 10px", borderRadius: 20, border: "1px solid",
              borderColor: filterCat === cat ? GREEN : "var(--adm-card-border)",
              background: filterCat === cat ? "rgba(22,163,74,0.1)" : "var(--adm-card)",
              color: filterCat === cat ? GREEN : "var(--adm-text2)",
              fontFamily: FB, fontSize: "0.75rem", cursor: "pointer",
            }}
          >
            {cat === "ALL" ? "Todos" : `${CAT_ICONS[cat]} ${CAT_LABELS[cat]}`}
          </button>
        ))}
      </div>

      {/* List */}
      {Object.keys(grouped).length === 0 && (
        <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", textAlign: "center", marginTop: 40 }}>
          No hay insumos en esta categoría
        </p>
      )}

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span>{CAT_ICONS[cat]}</span> {CAT_LABELS[cat]}
            <span style={{ fontWeight: 400, color: "var(--adm-text3)" }}>({items.length})</span>
          </div>
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
            {items.map((insumo, idx) => (
              <div key={insumo.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                borderBottom: idx < items.length - 1 ? "1px solid var(--adm-card-border)" : "none",
              }}>
                {/* Edit mode */}
                {editState?.id === insumo.id ? (
                  <>
                    <input
                      style={{ ...inputSt, flex: "1 1 150px" }}
                      value={editState.nombre}
                      autoFocus
                      onChange={e => setEditState(s => s ? { ...s, nombre: e.target.value } : s)}
                      onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditState(null); }}
                    />
                    <select style={{ ...selectSt, flex: "0 1 130px" }} value={editState.categoria} onChange={e => setEditState(s => s ? { ...s, categoria: e.target.value } : s)}>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                    </select>
                    <select style={{ ...selectSt, flex: "0 1 100px" }} value={editState.unidadBase} onChange={e => setEditState(s => s ? { ...s, unidadBase: e.target.value } : s)}>
                      {UNIDADES.map(u => <option key={u} value={u}>{UNIDAD_LABELS[u]}</option>)}
                    </select>
                    <button onClick={saveEdit} disabled={saving} style={{ padding: "6px 10px", background: GREEN, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditState(null)} style={{ padding: "6px 10px", background: "var(--adm-hover)", color: "var(--adm-text)", border: "none", borderRadius: 6, cursor: "pointer" }}>
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)" }}>{insumo.nombre}</span>
                      <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", marginLeft: 6 }}>{UNIDAD_LABELS[insumo.unidadBase]}</span>
                      {insumo.ultimoPrecio != null && (
                        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", marginLeft: 8 }}>
                          ${insumo.ultimoPrecio.toLocaleString("es-CL")}/u
                        </span>
                      )}
                    </div>
                    {insumo.esCritico && (
                      <span style={{ fontSize: "0.65rem", background: "rgba(22,163,74,0.12)", color: GREEN, padding: "2px 6px", borderRadius: 4, fontFamily: F, fontWeight: 600 }}>
                        crítico
                      </span>
                    )}
                    <button
                      onClick={() => toggleCritico(insumo)}
                      title={insumo.esCritico ? "Quitar de críticos" : "Marcar como crítico"}
                      style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: insumo.esCritico ? GREEN : "var(--adm-text3)" }}
                    >
                      {insumo.esCritico ? <Star size={15} fill={GREEN} /> : <StarOff size={15} />}
                    </button>
                    <button
                      onClick={() => setEditState({ id: insumo.id, nombre: insumo.nombre, categoria: insumo.categoria, unidadBase: insumo.unidadBase })}
                      style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteInsumo(insumo.id, insumo.nombre)}
                      style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
