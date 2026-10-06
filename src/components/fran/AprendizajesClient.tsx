"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

interface Aprendizaje {
  id: string;
  titulo: string;
  problema: string | null;
  causa: string | null;
  decision: string | null;
  resultado: string | null;
  aprendizaje: string;
  aplicacionFutura: string | null;
  createdAt: Date;
  bitacora: { id: string; titulo: string | null } | null;
}

interface Props {
  proyectoId: string;
  aprendizajes: Aprendizaje[];
}

const EMPTY_FORM = {
  titulo: "",
  aprendizaje: "",
  problema: "",
  causa: "",
  decision: "",
  resultado: "",
  aplicacionFutura: "",
};

export default function AprendizajesClient({
  proyectoId,
  aprendizajes: initial,
}: Props) {
  const [items, setItems] = useState<Aprendizaje[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<typeof EMPTY_FORM>>({});

  const handleSubmit = async () => {
    if (!form.titulo.trim() || !form.aprendizaje.trim()) {
      toast.error("Título y aprendizaje son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/fran/aprendizajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyectoId,
          titulo: form.titulo.trim(),
          aprendizaje: form.aprendizaje.trim(),
          problema: form.problema.trim() || null,
          causa: form.causa.trim() || null,
          decision: form.decision.trim() || null,
          resultado: form.resultado.trim() || null,
          aplicacionFutura: form.aplicacionFutura.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const { aprendizaje } = await res.json();
      setItems((i) => [{ ...aprendizaje, bitacora: null }, ...i]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success("Aprendizaje registrado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: string) => {
    const prev = items;
    setItems((is) =>
      is.map((item) =>
        item.id === id ? { ...item, ...editFields } : item
      )
    );
    setEditingId(null);
    try {
      const res = await fetch(`/api/fran/aprendizajes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFields),
      });
      if (!res.ok) throw new Error();
      toast.success("Guardado");
    } catch {
      setItems(prev);
      toast.error("Error al guardar");
    }
  };

  const eliminar = async (id: string) => {
    const prev = items;
    setItems((is) => is.filter((i) => i.id !== id));
    try {
      await fetch(`/api/fran/aprendizajes/${id}`, { method: "DELETE" });
    } catch {
      setItems(prev);
      toast.error("Error al eliminar");
    }
  };

  return (
    <div style={{ paddingTop: 28 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: F,
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--adm-text)",
              margin: 0,
            }}
          >
            Aprendizajes
          </h2>
          <p
            style={{
              fontFamily: FB,
              fontSize: "0.8rem",
              color: "var(--adm-text3)",
              margin: "2px 0 0",
            }}
          >
            {items.length} aprendizaje{items.length !== 1 ? "s" : ""} documentado
            {items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: GOLD,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontFamily: F,
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Plus size={15} />
          Nuevo aprendizaje
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div
          style={{
            background: "var(--adm-card)",
            border: "1px solid var(--adm-card-border)",
            borderRadius: 14,
            padding: "20px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontFamily: F,
                fontSize: "0.88rem",
                fontWeight: 700,
                color: "var(--adm-text)",
              }}
            >
              Nuevo aprendizaje
            </span>
            <button
              onClick={() => setShowForm(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              placeholder="Título *"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              style={inputStyle}
            />
            <textarea
              placeholder="Aprendizaje * (lección clave aprendida)"
              value={form.aprendizaje}
              onChange={(e) =>
                setForm((f) => ({ ...f, aprendizaje: e.target.value }))
              }
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <textarea
              placeholder="Problema que originó este aprendizaje"
              value={form.problema}
              onChange={(e) =>
                setForm((f) => ({ ...f, problema: e.target.value }))
              }
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <textarea
              placeholder="Causa raíz"
              value={form.causa}
              onChange={(e) => setForm((f) => ({ ...f, causa: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <textarea
              placeholder="Decisión tomada"
              value={form.decision}
              onChange={(e) =>
                setForm((f) => ({ ...f, decision: e.target.value }))
              }
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <textarea
              placeholder="Resultado obtenido"
              value={form.resultado}
              onChange={(e) =>
                setForm((f) => ({ ...f, resultado: e.target.value }))
              }
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <textarea
              placeholder="Aplicación futura (¿cómo evitar esto o reproducirlo?)"
              value={form.aplicacionFutura}
              onChange={(e) =>
                setForm((f) => ({ ...f, aplicacionFutura: e.target.value }))
              }
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  padding: "8px 20px",
                  background: GOLD,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontFamily: F,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setShowForm(false);
                }}
                style={{
                  padding: "8px 16px",
                  background: "var(--adm-card-border)",
                  color: "var(--adm-text2)",
                  border: "none",
                  borderRadius: 8,
                  fontFamily: F,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !showForm && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "var(--adm-text3)",
            fontFamily: FB,
          }}
        >
          No hay aprendizajes documentados aún.
        </div>
      )}

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              background: "var(--adm-card)",
              border: "1px solid var(--adm-card-border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "14px 16px",
                cursor: "pointer",
              }}
              onClick={() =>
                setExpanded(expanded === item.id ? null : item.id)
              }
            >
              <BookOpen size={16} color={GOLD} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontFamily: F,
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "var(--adm-text)",
                    margin: "0 0 4px",
                  }}
                >
                  {item.titulo}
                </h3>
                <p
                  style={{
                    fontFamily: FB,
                    fontSize: "0.82rem",
                    color: "var(--adm-text2)",
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {item.aprendizaje}
                </p>
                {item.bitacora && (
                  <span
                    style={{
                      fontFamily: FB,
                      fontSize: "0.72rem",
                      color: "var(--adm-text3)",
                      display: "block",
                      marginTop: 4,
                    }}
                  >
                    Desde bitácora: {item.bitacora.titulo || "entrada sin título"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)" }}>
                  {new Date(item.createdAt).toLocaleDateString("es-CL", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                {expanded === item.id ? (
                  <ChevronUp size={15} color="var(--adm-text3)" />
                ) : (
                  <ChevronDown size={15} color="var(--adm-text3)" />
                )}
              </div>
            </div>

            {expanded === item.id && (
              <div
                style={{
                  padding: "12px 16px 16px",
                  borderTop: "1px solid var(--adm-card-border)",
                  background: "rgba(244,166,35,0.02)",
                }}
              >
                {editingId === item.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(
                      [
                        { key: "titulo", label: "Título" },
                        { key: "aprendizaje", label: "Aprendizaje" },
                        { key: "problema", label: "Problema" },
                        { key: "causa", label: "Causa raíz" },
                        { key: "decision", label: "Decisión" },
                        { key: "resultado", label: "Resultado" },
                        { key: "aplicacionFutura", label: "Aplicación futura" },
                      ] as { key: keyof typeof EMPTY_FORM; label: string }[]
                    ).map(({ key, label }) => (
                      <textarea
                        key={key}
                        placeholder={label}
                        value={
                          editFields[key] !== undefined
                            ? (editFields[key] as string)
                            : (item[key as keyof Aprendizaje] as string) ?? ""
                        }
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            [key]: e.target.value,
                          }))
                        }
                        rows={key === "titulo" ? 1 : 2}
                        style={{ ...inputStyle, resize: "vertical" }}
                      />
                    ))}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => saveEdit(item.id)}
                        style={{
                          padding: "7px 16px",
                          background: GOLD,
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontFamily: F,
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: "7px 14px",
                          background: "var(--adm-card-border)",
                          color: "var(--adm-text2)",
                          border: "none",
                          borderRadius: 8,
                          fontFamily: F,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {[
                      { label: "Problema", value: item.problema, color: "#ef4444" },
                      { label: "Causa raíz", value: item.causa, color: "#f59e0b" },
                      { label: "Decisión", value: item.decision, color: GOLD },
                      { label: "Resultado", value: item.resultado, color: "#10b981" },
                      { label: "Aplicación futura", value: item.aplicacionFutura, color: "var(--adm-text2)" },
                    ]
                      .filter((s) => s.value)
                      .map((s) => (
                        <div key={s.label} style={{ marginBottom: 10 }}>
                          <span
                            style={{
                              fontFamily: F,
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              color: s.color,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {s.label}
                          </span>
                          <p
                            style={{
                              fontFamily: FB,
                              fontSize: "0.82rem",
                              color: "var(--adm-text2)",
                              margin: "4px 0 0",
                              lineHeight: 1.5,
                            }}
                          >
                            {s.value}
                          </p>
                        </div>
                      ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditFields({});
                        }}
                        style={{
                          padding: "5px 12px",
                          background: "var(--adm-card-border)",
                          color: "var(--adm-text2)",
                          border: "none",
                          borderRadius: 7,
                          fontFamily: F,
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminar(item.id)}
                        style={{
                          padding: "5px 12px",
                          background: "rgba(239,68,68,0.08)",
                          color: "#ef4444",
                          border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: 7,
                          fontFamily: F,
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 7,
  border: "1px solid var(--adm-input-border)",
  background: "var(--adm-input)",
  color: "var(--adm-text)",
  fontFamily: "var(--font-body)",
  fontSize: "0.82rem",
  width: "100%",
  boxSizing: "border-box",
};
