"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, ChevronDown, ChevronUp, BookOpen, Clock } from "lucide-react";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

interface Etapa {
  id: string;
  nombre: string;
}

interface Entrada {
  id: string;
  fecha: Date;
  titulo: string | null;
  situacion: string;
  problema: string | null;
  consecuencia: string | null;
  accion: string | null;
  etiquetas: string[];
  etapaId: string | null;
  tareaId: string | null;
  aprendizaje: { id: string } | null;
}

interface Props {
  proyecto: { id: string; slug: string; etapas: Etapa[] };
  entradas: Entrada[];
}

const EMPTY_FORM = {
  titulo: "",
  situacion: "",
  problema: "",
  consecuencia: "",
  accion: "",
  etiquetas: "",
  etapaId: "",
};

export default function BitacoraClient({ proyecto, entradas: initialEntradas }: Props) {
  const [entradas, setEntradas] = useState<Entrada[]>(initialEntradas);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.situacion.trim()) {
      toast.error("La situación es obligatoria");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/fran/bitacora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyectoId: proyecto.id,
          titulo: form.titulo.trim() || null,
          situacion: form.situacion.trim(),
          problema: form.problema.trim() || null,
          consecuencia: form.consecuencia.trim() || null,
          accion: form.accion.trim() || null,
          etiquetas: form.etiquetas
            ? form.etiquetas
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
          etapaId: form.etapaId || null,
        }),
      });
      if (!res.ok) throw new Error();
      const { entrada } = await res.json();
      setEntradas((e) => [{ ...entrada, aprendizaje: null }, ...e]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success("Entrada agregada a la bitácora");
    } catch {
      toast.error("Error al guardar la entrada");
    } finally {
      setSaving(false);
    }
  };

  const eliminarEntrada = async (id: string) => {
    const prev = entradas;
    setEntradas((e) => e.filter((en) => en.id !== id));
    try {
      await fetch(`/api/fran/bitacora/${id}`, { method: "DELETE" });
    } catch {
      setEntradas(prev);
      toast.error("Error al eliminar");
    }
  };

  const convertirAprendizaje = async (entrada: Entrada) => {
    try {
      const res = await fetch("/api/fran/aprendizajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyectoId: proyecto.id,
          bitacoraId: entrada.id,
          titulo: entrada.titulo || entrada.situacion.slice(0, 80),
          problema: entrada.problema,
          aprendizaje: entrada.accion || entrada.situacion,
        }),
      });
      if (!res.ok) throw new Error();
      const { aprendizaje } = await res.json();
      setEntradas((e) =>
        e.map((en) =>
          en.id === entrada.id
            ? { ...en, aprendizaje: { id: aprendizaje.id } }
            : en
        )
      );
      toast.success("Convertido en aprendizaje");
    } catch {
      toast.error("Error al convertir");
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
            Bitácora
          </h2>
          <p
            style={{
              fontFamily: FB,
              fontSize: "0.8rem",
              color: "var(--adm-text3)",
              margin: "2px 0 0",
            }}
          >
            {entradas.length} entrada{entradas.length !== 1 ? "s" : ""}
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
          Nueva entrada
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
              Nueva entrada en bitácora
            </span>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--adm-text3)",
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              placeholder="Título (opcional)"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              style={inputStyle}
            />
            <textarea
              placeholder="Situación * (¿qué pasó?)"
              value={form.situacion}
              onChange={(e) =>
                setForm((f) => ({ ...f, situacion: e.target.value }))
              }
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <textarea
              placeholder="Problema detectado"
              value={form.problema}
              onChange={(e) =>
                setForm((f) => ({ ...f, problema: e.target.value }))
              }
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <textarea
              placeholder="Consecuencia / impacto"
              value={form.consecuencia}
              onChange={(e) =>
                setForm((f) => ({ ...f, consecuencia: e.target.value }))
              }
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <textarea
              placeholder="Acción tomada / decisión"
              value={form.accion}
              onChange={(e) =>
                setForm((f) => ({ ...f, accion: e.target.value }))
              }
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <input
                placeholder="Etiquetas (separadas por coma)"
                value={form.etiquetas}
                onChange={(e) =>
                  setForm((f) => ({ ...f, etiquetas: e.target.value }))
                }
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={form.etapaId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, etapaId: e.target.value }))
                }
                style={{ ...inputStyle, minWidth: 160 }}
              >
                <option value="">Sin etapa</option>
                {proyecto.etapas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre.replace(/^\d+\.\s*/, "")}
                  </option>
                ))}
              </select>
            </div>
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
                {saving ? "Guardando..." : "Guardar entrada"}
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

      {/* Entries list */}
      {entradas.length === 0 && !showForm && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "var(--adm-text3)",
            fontFamily: FB,
          }}
        >
          No hay entradas en la bitácora aún.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {entradas.map((entrada) => (
          <div
            key={entrada.id}
            style={{
              background: "var(--adm-card)",
              border: "1px solid var(--adm-card-border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Entry header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "14px 16px",
                cursor: "pointer",
              }}
              onClick={() =>
                setExpanded(expanded === entrada.id ? null : entrada.id)
              }
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <Clock size={12} color="var(--adm-text3)" />
                  <span
                    style={{
                      fontFamily: FB,
                      fontSize: "0.72rem",
                      color: "var(--adm-text3)",
                    }}
                  >
                    {new Date(entrada.fecha).toLocaleDateString("es-CL", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {entrada.etiquetas.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: F,
                        fontSize: "0.66rem",
                        fontWeight: 600,
                        padding: "1px 7px",
                        borderRadius: 99,
                        background: `${GOLD}18`,
                        color: GOLD,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {entrada.titulo && (
                  <h3
                    style={{
                      fontFamily: F,
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: "var(--adm-text)",
                      margin: "0 0 4px",
                    }}
                  >
                    {entrada.titulo}
                  </h3>
                )}
                <p
                  style={{
                    fontFamily: FB,
                    fontSize: "0.82rem",
                    color: "var(--adm-text2)",
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {entrada.situacion}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {expanded === entrada.id ? (
                  <ChevronUp size={15} color="var(--adm-text3)" />
                ) : (
                  <ChevronDown size={15} color="var(--adm-text3)" />
                )}
              </div>
            </div>

            {/* Expanded */}
            {expanded === entrada.id && (
              <div
                style={{
                  padding: "12px 16px 16px",
                  borderTop: "1px solid var(--adm-card-border)",
                  background: "rgba(244,166,35,0.02)",
                }}
              >
                {entrada.problema && (
                  <div style={{ marginBottom: 10 }}>
                    <span
                      style={{
                        fontFamily: F,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#ef4444",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Problema
                    </span>
                    <p
                      style={{
                        fontFamily: FB,
                        fontSize: "0.82rem",
                        color: "var(--adm-text2)",
                        margin: "4px 0 0",
                      }}
                    >
                      {entrada.problema}
                    </p>
                  </div>
                )}
                {entrada.consecuencia && (
                  <div style={{ marginBottom: 10 }}>
                    <span
                      style={{
                        fontFamily: F,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#f59e0b",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Consecuencia
                    </span>
                    <p
                      style={{
                        fontFamily: FB,
                        fontSize: "0.82rem",
                        color: "var(--adm-text2)",
                        margin: "4px 0 0",
                      }}
                    >
                      {entrada.consecuencia}
                    </p>
                  </div>
                )}
                {entrada.accion && (
                  <div style={{ marginBottom: 12 }}>
                    <span
                      style={{
                        fontFamily: F,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#10b981",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Acción / Decisión
                    </span>
                    <p
                      style={{
                        fontFamily: FB,
                        fontSize: "0.82rem",
                        color: "var(--adm-text2)",
                        margin: "4px 0 0",
                      }}
                    >
                      {entrada.accion}
                    </p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  {!entrada.aprendizaje && (
                    <button
                      onClick={() => convertirAprendizaje(entrada)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "6px 12px",
                        background: `${GOLD}18`,
                        color: GOLD,
                        border: `1px solid ${GOLD}40`,
                        borderRadius: 7,
                        fontFamily: F,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <BookOpen size={13} />
                      Convertir en aprendizaje
                    </button>
                  )}
                  {entrada.aprendizaje && (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontFamily: FB,
                        fontSize: "0.75rem",
                        color: "#10b981",
                      }}
                    >
                      <BookOpen size={13} /> Aprendizaje registrado
                    </span>
                  )}
                  <button
                    onClick={() => eliminarEntrada(entrada.id)}
                    style={{
                      padding: "6px 12px",
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
