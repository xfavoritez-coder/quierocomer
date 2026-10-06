import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

const ESTADO_COLORS: Record<string, string> = {
  COMPLETADA: "#10b981",
  EN_PROGRESO: GOLD,
  BLOQUEADA: "#ef4444",
  PENDIENTE: "var(--adm-text3)",
};

export default async function EtapasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const proyecto = await prisma.franProyecto.findUnique({
    where: { slug },
    include: {
      etapas: {
        include: {
          tareas: { select: { id: true, estado: true, peso: true, prioridad: true } },
        },
        orderBy: { orden: "asc" },
      },
    },
  });
  if (!proyecto) notFound();

  return (
    <div style={{ paddingTop: 28 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {proyecto.etapas.map((etapa) => {
          const total = etapa.tareas.length;
          const completadas = etapa.tareas.filter(
            (t) => t.estado === "COMPLETADA"
          ).length;
          const bloqueadas = etapa.tareas.filter(
            (t) => t.estado === "BLOQUEADA"
          ).length;
          const enProgreso = etapa.tareas.filter(
            (t) => t.estado === "EN_PROGRESO"
          ).length;
          const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;

          const etapaEstado =
            bloqueadas > 0
              ? "BLOQUEADA"
              : completadas === total && total > 0
              ? "COMPLETADA"
              : enProgreso > 0
              ? "EN_PROGRESO"
              : "PENDIENTE";

          return (
            <Link
              key={etapa.id}
              href={`/franquicia/proyecto/${slug}/etapa/${etapa.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--adm-card)",
                  border: "1px solid var(--adm-card-border)",
                  borderRadius: 14,
                  padding: "18px 20px",
                  cursor: "pointer",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  borderLeft: `3px solid ${ESTADO_COLORS[etapaEstado]}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: F,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: GOLD,
                        letterSpacing: "0.06em",
                      }}
                    >
                      ETAPA {etapa.numero}
                    </span>
                    <h3
                      style={{
                        fontFamily: F,
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        color: "var(--adm-text)",
                        margin: "2px 0 0",
                        lineHeight: 1.3,
                      }}
                    >
                      {etapa.nombre.replace(/^\d+\.\s*/, "")}
                    </h3>
                  </div>
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: pct === 100 ? "#10b981" : GOLD,
                    }}
                  >
                    {pct}%
                  </span>
                </div>

                {/* Mini progress */}
                <div
                  style={{
                    height: 3,
                    background: "var(--adm-card-border)",
                    borderRadius: 99,
                    overflow: "hidden",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: pct === 100 ? "#10b981" : GOLD,
                      borderRadius: 99,
                    }}
                  />
                </div>

                {/* Stats */}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: FB,
                      fontSize: "0.75rem",
                      color: "var(--adm-text2)",
                    }}
                  >
                    {completadas}/{total} tareas
                  </span>
                  {bloqueadas > 0 && (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        fontFamily: FB,
                        fontSize: "0.72rem",
                        color: "#ef4444",
                      }}
                    >
                      <AlertTriangle size={11} /> {bloqueadas}
                    </span>
                  )}
                  {enProgreso > 0 && etapaEstado !== "BLOQUEADA" && (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        fontFamily: FB,
                        fontSize: "0.72rem",
                        color: GOLD,
                      }}
                    >
                      <Clock size={11} /> {enProgreso} en progreso
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
