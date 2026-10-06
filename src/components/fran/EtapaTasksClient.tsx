"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
} from "lucide-react";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

type EstadoTarea = "PENDIENTE" | "EN_PROGRESO" | "BLOQUEADA" | "COMPLETADA";
type Prioridad = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
type ValidacionStatus = "PROPUESTA" | "VALIDADA" | "DESCARTADA";

interface ChecklistItem {
  id: string;
  texto: string;
  completado: boolean;
  orden: number;
}

interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  validacion: ValidacionStatus;
  prioridad: Prioridad;
  peso: number;
  motivoBloqueo: string | null;
  responsable: string | null;
  fechaLimite: Date | null;
  fechaCompletada: Date | null;
  costoEstimado: number | null;
  costoReal: number | null;
  proveedor: string | null;
  notas: string | null;
  orden: number;
  checklist: ChecklistItem[];
}

interface Etapa {
  id: string;
  numero: number;
  nombre: string;
  tareas: Tarea[];
}

const VALIDACION_COLOR: Record<ValidacionStatus, string> = {
  PROPUESTA: "var(--adm-text3)",
  VALIDADA: "#10b981",
  DESCARTADA: "#ef4444",
};

const VALIDACION_LABEL: Record<ValidacionStatus, string> = {
  PROPUESTA: "Propuesta",
  VALIDADA: "Validada",
  DESCARTADA: "Descartada",
};

const ESTADO_COLOR: Record<EstadoTarea, string> = {
  PENDIENTE: "var(--adm-text3)",
  EN_PROGRESO: GOLD,
  COMPLETADA: "#10b981",
  BLOQUEADA: "#ef4444",
};

const PRIORIDAD_COLOR: Record<Prioridad, string> = {
  BAJA: "var(--adm-text3)",
  MEDIA: "var(--adm-text2)",
  ALTA: GOLD,
  CRITICA: "#ef4444",
};

export default function EtapaTasksClient({
  etapa,
  proyectoSlug,
}: {
  etapa: Etapa;
  proyectoSlug: string;
}) {
  const [tareas, setTareas] = useState<Tarea[]>(etapa.tareas);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bloqueandoId, setBloqueandoId] = useState<string | null>(null);
  const [motivoInput, setMotivoInput] = useState("");
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [addingTarea, setAddingTarea] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Tarea>>({});

  const updateEstado = async (
    id: string,
    estado: EstadoTarea,
    motivoBloqueo?: string
  ) => {
    const prev = tareas;
    setTareas((ts) =>
      ts.map((t) =>
        t.id === id
          ? {
              ...t,
              estado,
              motivoBloqueo: motivoBloqueo ?? null,
              fechaCompletada:
                estado === "COMPLETADA" ? new Date() : null,
            }
          : t
      )
    );
    setBloqueandoId(null);
    setMotivoInput("");
    try {
      const res = await fetch(`/api/fran/tareas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado,
          motivoBloqueo: motivoBloqueo ?? null,
          fechaCompletada:
            estado === "COMPLETADA" ? new Date().toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      if (estado === "COMPLETADA") toast.success("Tarea completada");
      else if (estado === "BLOQUEADA") toast.error("Tarea marcada como bloqueada");
    } catch {
      setTareas(prev);
      toast.error("Error al actualizar la tarea");
    }
  };

  const updateValidacion = async (id: string, validacion: ValidacionStatus) => {
    const prev = tareas;
    setTareas((ts) => ts.map((t) => (t.id === id ? { ...t, validacion } : t)));
    try {
      const res = await fetch(`/api/fran/tareas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validacion }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTareas(prev);
      toast.error("Error al actualizar validación");
    }
  };

  const saveTareaEdit = async (id: string) => {
    const prev = tareas;
    setTareas((ts) => ts.map((t) => (t.id === id ? { ...t, ...editFields } : t)));
    setEditingId(null);
    try {
      const res = await fetch(`/api/fran/tareas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFields),
      });
      if (!res.ok) throw new Error();
      toast.success("Guardado");
    } catch {
      setTareas(prev);
      toast.error("Error al guardar");
    }
  };

  const agregarTarea = async () => {
    if (!nuevaTarea.trim()) return;
    setAddingTarea(true);
    try {
      const res = await fetch("/api/fran/tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etapaId: etapa.id,
          titulo: nuevaTarea.trim(),
          orden: tareas.length,
        }),
      });
      if (!res.ok) throw new Error();
      const { tarea } = await res.json();
      setTareas((ts) => [...ts, { ...tarea, validacion: tarea.validacion ?? "PROPUESTA", checklist: [] }]);
      setNuevaTarea("");
      toast.success("Tarea agregada");
    } catch {
      toast.error("Error al agregar tarea");
    } finally {
      setAddingTarea(false);
    }
  };

  const eliminarTarea = async (id: string) => {
    const prev = tareas;
    setTareas((ts) => ts.filter((t) => t.id !== id));
    try {
      await fetch(`/api/fran/tareas/${id}`, { method: "DELETE" });
    } catch {
      setTareas(prev);
      toast.error("Error al eliminar");
    }
  };

  const completadas = tareas.filter((t) => t.estado === "COMPLETADA").length;
  const bloqueadas = tareas.filter((t) => t.estado === "BLOQUEADA").length;

  return (
    <div>
      {/* Etapa header */}
      <div style={{ padding: "24px 0 20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span
              style={{
                fontFamily: F,
                fontSize: "0.72rem",
                fontWeight: 700,
                color: GOLD,
                letterSpacing: "0.06em",
              }}
            >
              ETAPA {etapa.numero}
            </span>
            <h2
              style={{
                fontFamily: F,
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "var(--adm-text)",
                margin: "2px 0 0",
              }}
            >
              {etapa.nombre.replace(/^\d+\.\s*/, "")}
            </h2>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span
              style={{
                fontFamily: FB,
                fontSize: "0.8rem",
                color: "var(--adm-text2)",
              }}
            >
              {completadas}/{tareas.length} completadas
            </span>
            {bloqueadas > 0 && (
              <span
                style={{
                  fontFamily: FB,
                  fontSize: "0.78rem",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <AlertTriangle size={13} /> {bloqueadas} bloqueada
                {bloqueadas !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Task list */}
      <div
        style={{
          background: "var(--adm-card)",
          border: "1px solid var(--adm-card-border)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {tareas.length === 0 && (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--adm-text3)",
              fontFamily: FB,
              fontSize: "0.85rem",
            }}
          >
            No hay tareas en esta etapa.
          </div>
        )}

        {tareas.map((tarea, idx) => (
          <div
            key={tarea.id}
            style={{
              borderBottom:
                idx < tareas.length - 1
                  ? "1px solid var(--adm-card-border)"
                  : "none",
              opacity: tarea.estado === "COMPLETADA" ? 0.6 : 1,
            }}
          >
            {/* Main row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
              }}
            >
              {/* Status icon (decorative) */}
              <span
                style={{
                  flexShrink: 0,
                  color: ESTADO_COLOR[tarea.estado],
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {tarea.estado === "COMPLETADA" ? (
                  <CheckCircle2 size={16} fill="currentColor" />
                ) : tarea.estado === "BLOQUEADA" ? (
                  <AlertTriangle size={16} />
                ) : tarea.estado === "EN_PROGRESO" ? (
                  <Clock size={16} />
                ) : (
                  <Circle size={16} />
                )}
              </span>

              {/* Estado select */}
              <select
                value={tarea.estado}
                onChange={(e) => {
                  const nuevo = e.target.value as EstadoTarea;
                  if (nuevo === "BLOQUEADA") {
                    setBloqueandoId(tarea.id);
                    setMotivoInput("");
                  } else {
                    setBloqueandoId(null);
                    updateEstado(tarea.id, nuevo);
                  }
                }}
                style={{
                  background: "var(--adm-input)",
                  border: "1px solid var(--adm-input-border)",
                  borderRadius: 7,
                  color: ESTADO_COLOR[tarea.estado],
                  fontFamily: F,
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  padding: "3px 6px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_PROGRESO">En progreso</option>
                <option value="BLOQUEADA">Bloqueada</option>
                <option value="COMPLETADA">Completada</option>
              </select>

              {/* Title */}
              <span
                style={{
                  fontFamily: FB,
                  fontSize: "0.85rem",
                  flex: 1,
                  color:
                    tarea.estado === "COMPLETADA"
                      ? "var(--adm-text3)"
                      : "var(--adm-text)",
                  textDecoration:
                    tarea.estado === "COMPLETADA" ? "line-through" : "none",
                }}
              >
                {tarea.titulo}
              </span>

              {/* Prioridad badge */}
              {tarea.prioridad !== "MEDIA" && (
                <span
                  style={{
                    fontFamily: F,
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: PRIORIDAD_COLOR[tarea.prioridad],
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {tarea.prioridad}
                </span>
              )}

              {/* Validacion badge (only show non-default states) */}
              {tarea.validacion !== "PROPUESTA" && (
                <span
                  style={{
                    fontFamily: F,
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 99,
                    background: `${VALIDACION_COLOR[tarea.validacion]}18`,
                    color: VALIDACION_COLOR[tarea.validacion],
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {VALIDACION_LABEL[tarea.validacion]}
                </span>
              )}

              {/* Fecha limite */}
              {tarea.fechaLimite && (
                <span
                  style={{
                    fontFamily: FB,
                    fontSize: "0.75rem",
                    color: "var(--adm-text3)",
                  }}
                >
                  {new Date(tarea.fechaLimite).toLocaleDateString("es-CL", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}

              {/* Expand button */}
              <button
                onClick={() => {
                  setExpanded(expanded === tarea.id ? null : tarea.id);
                  setEditingId(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--adm-text3)",
                  padding: 2,
                }}
              >
                {expanded === tarea.id ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>

              {/* Delete button */}
              <button
                onClick={() => eliminarTarea(tarea.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--adm-text3)",
                  padding: 2,
                  opacity: 0.5,
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Block reason form */}
            {bloqueandoId === tarea.id && (
              <div
                style={{
                  padding: "8px 16px 12px",
                  background: "rgba(239,68,68,0.06)",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <input
                  autoFocus
                  value={motivoInput}
                  onChange={(e) => setMotivoInput(e.target.value)}
                  placeholder="Motivo del bloqueo..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      updateEstado(tarea.id, "BLOQUEADA", motivoInput);
                    if (e.key === "Escape") setBloqueandoId(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 7,
                    border: "1px solid rgba(239,68,68,0.3)",
                    background: "var(--adm-input)",
                    color: "var(--adm-text)",
                    fontFamily: FB,
                    fontSize: "0.82rem",
                  }}
                />
                <button
                  onClick={() =>
                    updateEstado(tarea.id, "BLOQUEADA", motivoInput)
                  }
                  style={{
                    padding: "6px 12px",
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    borderRadius: 7,
                    fontFamily: F,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Bloquear
                </button>
                <button
                  onClick={() => {
                    setBloqueandoId(null);
                    updateEstado(tarea.id, "COMPLETADA");
                  }}
                  style={{
                    padding: "6px 12px",
                    background: GOLD,
                    color: "#fff",
                    border: "none",
                    borderRadius: 7,
                    fontFamily: F,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Completar
                </button>
                <button
                  onClick={() => setBloqueandoId(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--adm-text3)",
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Expanded details */}
            {expanded === tarea.id && (
              <div
                style={{
                  padding: "12px 16px 16px",
                  background: "rgba(244,166,35,0.03)",
                  borderTop: "1px solid var(--adm-card-border)",
                }}
              >
                {editingId === tarea.id ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <input
                      value={
                        (editFields.descripcion !== undefined
                          ? editFields.descripcion
                          : tarea.descripcion) ?? ""
                      }
                      onChange={(e) =>
                        setEditFields((f) => ({
                          ...f,
                          descripcion: e.target.value,
                        }))
                      }
                      placeholder="Descripción..."
                      style={{
                        padding: "8px 10px",
                        borderRadius: 7,
                        border: "1px solid var(--adm-input-border)",
                        background: "var(--adm-input)",
                        color: "var(--adm-text)",
                        fontFamily: FB,
                        fontSize: "0.82rem",
                        width: "100%",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <select
                        value={
                          (editFields.prioridad ?? tarea.prioridad) as string
                        }
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            prioridad: e.target.value as Prioridad,
                          }))
                        }
                        style={{
                          padding: "6px 10px",
                          borderRadius: 7,
                          border: "1px solid var(--adm-input-border)",
                          background: "var(--adm-input)",
                          color: "var(--adm-text)",
                          fontFamily: F,
                          fontSize: "0.8rem",
                        }}
                      >
                        {(["BAJA", "MEDIA", "ALTA", "CRITICA"] as Prioridad[]).map(
                          (p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          )
                        )}
                      </select>
                      <input
                        type="date"
                        value={
                          editFields.fechaLimite !== undefined
                            ? editFields.fechaLimite
                              ? new Date(editFields.fechaLimite as Date)
                                  .toISOString()
                                  .split("T")[0]
                              : ""
                            : tarea.fechaLimite
                            ? new Date(tarea.fechaLimite)
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            fechaLimite: e.target.value
                              ? new Date(e.target.value)
                              : null,
                          }))
                        }
                        style={{
                          padding: "6px 10px",
                          borderRadius: 7,
                          border: "1px solid var(--adm-input-border)",
                          background: "var(--adm-input)",
                          color: "var(--adm-text)",
                          fontFamily: F,
                          fontSize: "0.8rem",
                        }}
                      />
                      <input
                        placeholder="Responsable"
                        value={
                          (editFields.responsable !== undefined
                            ? editFields.responsable
                            : tarea.responsable) ?? ""
                        }
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            responsable: e.target.value,
                          }))
                        }
                        style={{
                          padding: "6px 10px",
                          borderRadius: 7,
                          border: "1px solid var(--adm-input-border)",
                          background: "var(--adm-input)",
                          color: "var(--adm-text)",
                          fontFamily: FB,
                          fontSize: "0.8rem",
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Costo est."
                        value={
                          editFields.costoEstimado !== undefined
                            ? (editFields.costoEstimado ?? "")
                            : (tarea.costoEstimado ?? "")
                        }
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            costoEstimado: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }))
                        }
                        style={{
                          padding: "6px 10px",
                          borderRadius: 7,
                          border: "1px solid var(--adm-input-border)",
                          background: "var(--adm-input)",
                          color: "var(--adm-text)",
                          fontFamily: FB,
                          fontSize: "0.8rem",
                          width: 120,
                        }}
                      />
                    </div>
                    <textarea
                      placeholder="Notas..."
                      value={
                        (editFields.notas !== undefined
                          ? editFields.notas
                          : tarea.notas) ?? ""
                      }
                      onChange={(e) =>
                        setEditFields((f) => ({ ...f, notas: e.target.value }))
                      }
                      rows={2}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 7,
                        border: "1px solid var(--adm-input-border)",
                        background: "var(--adm-input)",
                        color: "var(--adm-text)",
                        fontFamily: FB,
                        fontSize: "0.82rem",
                        resize: "vertical",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => saveTareaEdit(tarea.id)}
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
                    {tarea.descripcion && (
                      <p
                        style={{
                          fontFamily: FB,
                          fontSize: "0.82rem",
                          color: "var(--adm-text2)",
                          margin: "0 0 8px",
                          lineHeight: 1.5,
                        }}
                      >
                        {tarea.descripcion}
                      </p>
                    )}
                    {tarea.notas && (
                      <p
                        style={{
                          fontFamily: FB,
                          fontSize: "0.78rem",
                          color: "var(--adm-text3)",
                          margin: "0 0 8px",
                        }}
                      >
                        📝 {tarea.notas}
                      </p>
                    )}
                    {tarea.motivoBloqueo && (
                      <p
                        style={{
                          fontFamily: FB,
                          fontSize: "0.78rem",
                          color: "#ef4444",
                          margin: "0 0 8px",
                        }}
                      >
                        ⚠️ Bloqueo: {tarea.motivoBloqueo}
                      </p>
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        flexWrap: "wrap",
                        marginBottom: 10,
                      }}
                    >
                      {tarea.responsable && (
                        <span
                          style={{
                            fontFamily: FB,
                            fontSize: "0.75rem",
                            color: "var(--adm-text3)",
                          }}
                        >
                          👤 {tarea.responsable}
                        </span>
                      )}
                      {tarea.costoEstimado != null && (
                        <span
                          style={{
                            fontFamily: FB,
                            fontSize: "0.75rem",
                            color: "var(--adm-text3)",
                          }}
                        >
                          💰 Est: ${tarea.costoEstimado.toLocaleString("es-CL")}
                        </span>
                      )}
                      {tarea.costoReal != null && (
                        <span
                          style={{
                            fontFamily: FB,
                            fontSize: "0.75rem",
                            color: "var(--adm-text3)",
                          }}
                        >
                          💸 Real: ${tarea.costoReal.toLocaleString("es-CL")}
                        </span>
                      )}
                    </div>
                    {tarea.checklist.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        {tarea.checklist.map((ci) => (
                          <div
                            key={ci.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 3,
                            }}
                          >
                            <span
                              style={{
                                color: ci.completado
                                  ? "#10b981"
                                  : "var(--adm-text3)",
                              }}
                            >
                              {ci.completado ? (
                                <CheckCircle2 size={13} />
                              ) : (
                                <Circle size={13} />
                              )}
                            </span>
                            <span
                              style={{
                                fontFamily: FB,
                                fontSize: "0.78rem",
                                color: ci.completado
                                  ? "var(--adm-text3)"
                                  : "var(--adm-text2)",
                                textDecoration: ci.completado
                                  ? "line-through"
                                  : "none",
                              }}
                            >
                              {ci.texto}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          setEditingId(tarea.id);
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
                      <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>
                        Validación:
                      </span>
                      <select
                        value={tarea.validacion ?? "PROPUESTA"}
                        onChange={(e) => updateValidacion(tarea.id, e.target.value as ValidacionStatus)}
                        style={{
                          background: "var(--adm-input)",
                          border: "1px solid var(--adm-input-border)",
                          borderRadius: 7,
                          color: VALIDACION_COLOR[tarea.validacion ?? "PROPUESTA"],
                          fontFamily: F,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "3px 8px",
                          cursor: "pointer",
                        }}
                      >
                        <option value="PROPUESTA">Propuesta</option>
                        <option value="VALIDADA">Validada</option>
                        <option value="DESCARTADA">Descartada</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add task row */}
        <div
          style={{
            padding: "10px 16px",
            borderTop:
              tareas.length > 0 ? "1px solid var(--adm-card-border)" : "none",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <Plus size={15} color={GOLD} />
          <input
            value={nuevaTarea}
            onChange={(e) => setNuevaTarea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") agregarTarea();
            }}
            placeholder="Agregar tarea..."
            disabled={addingTarea}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              color: "var(--adm-text2)",
              fontFamily: FB,
              fontSize: "0.85rem",
              outline: "none",
            }}
          />
          {nuevaTarea && (
            <button
              onClick={agregarTarea}
              disabled={addingTarea}
              style={{
                padding: "4px 12px",
                background: GOLD,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontFamily: F,
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {addingTarea ? "..." : "Agregar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
