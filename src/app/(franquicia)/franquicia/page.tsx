import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AlertTriangle, Clock, CheckCircle2, FolderOpen } from "lucide-react";

export const dynamic = "force-dynamic";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      style={{
        height: 6,
        background: "var(--adm-card-border)",
        borderRadius: 99,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: GOLD,
          borderRadius: 99,
          transition: "width 0.5s",
        }}
      />
    </div>
  );
}

export default async function FranDashboard() {
  const proyectos = await prisma.franProyecto.findMany({
    where: { estado: { not: "CANCELADO" } },
    include: {
      marca: { select: { nombre: true, slug: true } },
      local: { select: { nombre: true } },
      etapas: {
        include: {
          tareas: {
            select: {
              id: true,
              titulo: true,
              estado: true,
              peso: true,
              prioridad: true,
              fechaLimite: true,
              motivoBloqueo: true,
              etapaId: true,
            },
          },
        },
      },
      hitos: { orderBy: { orden: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: F,
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--adm-text)",
            margin: 0,
          }}
        >
          Franquicias
        </h1>
        <p
          style={{
            fontFamily: FB,
            fontSize: "0.85rem",
            color: "var(--adm-text2)",
            margin: "4px 0 0",
          }}
        >
          Vista operacional ·{" "}
          {proyectos.length} proyecto
          {proyectos.length !== 1 ? "s" : ""} activo
          {proyectos.length !== 1 ? "s" : ""}
        </p>
      </div>

      {proyectos.map((p) => {
        const todasTareas = p.etapas.flatMap((e) => e.tareas);
        const totalPeso = todasTareas.reduce((s, t) => s + t.peso, 0) || 1;
        const completadoPeso = todasTareas
          .filter((t) => t.estado === "COMPLETADA")
          .reduce((s, t) => s + t.peso, 0);
        const pct = Math.round((completadoPeso / totalPeso) * 100);
        const bloqueadas = todasTareas.filter((t) => t.estado === "BLOQUEADA");
        const atrasadas = todasTareas.filter(
          (t) =>
            t.fechaLimite &&
            t.fechaLimite < now &&
            t.estado !== "COMPLETADA"
        );

        return (
          <div
            key={p.id}
            style={{
              background: "var(--adm-card)",
              border: "1px solid var(--adm-card-border)",
              borderRadius: 16,
              padding: "24px",
              marginBottom: 20,
              boxShadow: "var(--adm-card-shadow, none)",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FB,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: GOLD,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {p.marca.nombre}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--adm-text3)" }}>
                    ·
                  </span>
                  <span
                    style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}
                  >
                    {p.estado.replace("_", " ")}
                  </span>
                </div>
                <h2
                  style={{
                    fontFamily: F,
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--adm-text)",
                    margin: 0,
                  }}
                >
                  {p.nombre}
                </h2>
                {p.local && (
                  <p
                    style={{
                      fontFamily: FB,
                      fontSize: "0.8rem",
                      color: "var(--adm-text2)",
                      margin: "2px 0 0",
                    }}
                  >
                    {p.local.nombre}
                  </p>
                )}
              </div>
              <Link
                href={`/franquicia/proyecto/${p.slug}/etapas`}
                style={{
                  padding: "8px 16px",
                  background: GOLD,
                  color: "#fff",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontFamily: F,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                Ver proyecto →
              </Link>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: FB,
                    fontSize: "0.78rem",
                    color: "var(--adm-text2)",
                  }}
                >
                  Progreso general
                </span>
                <span
                  style={{
                    fontFamily: F,
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: GOLD,
                  }}
                >
                  {pct}%
                </span>
              </div>
              <ProgressBar pct={pct} />
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                {
                  icon: <FolderOpen size={13} />,
                  val: p.etapas.length,
                  label: "etapas",
                  alert: false,
                },
                {
                  icon: <CheckCircle2 size={13} />,
                  val: todasTareas.length,
                  label: "tareas",
                  alert: false,
                },
                {
                  icon: (
                    <AlertTriangle
                      size={13}
                      color={bloqueadas.length > 0 ? "#ef4444" : undefined}
                    />
                  ),
                  val: bloqueadas.length,
                  label: "bloqueadas",
                  alert: bloqueadas.length > 0,
                },
                {
                  icon: (
                    <Clock
                      size={13}
                      color={atrasadas.length > 0 ? "#f59e0b" : undefined}
                    />
                  ),
                  val: atrasadas.length,
                  label: "atrasadas",
                  alert: atrasadas.length > 0,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                >
                  <span
                    style={{ color: s.alert ? undefined : "var(--adm-text3)" }}
                  >
                    {s.icon}
                  </span>
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      color: s.alert
                        ? s.label === "bloqueadas"
                          ? "#ef4444"
                          : "#f59e0b"
                        : "var(--adm-text2)",
                    }}
                  >
                    {s.val}
                  </span>
                  <span
                    style={{
                      fontFamily: FB,
                      fontSize: "0.78rem",
                      color: "var(--adm-text3)",
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Bloqueadas */}
            {bloqueadas.length > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  background: "rgba(239,68,68,0.08)",
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <p
                  style={{
                    fontFamily: F,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#ef4444",
                    margin: "0 0 8px",
                  }}
                >
                  Tareas bloqueadas
                </p>
                {bloqueadas.map((t) => (
                  <div
                    key={t.id}
                    style={{ display: "flex", gap: 8, marginBottom: 4 }}
                  >
                    <span
                      style={{
                        fontFamily: FB,
                        fontSize: "0.78rem",
                        color: "var(--adm-text)",
                      }}
                    >
                      • {t.titulo}
                    </span>
                    {t.motivoBloqueo && (
                      <span
                        style={{
                          fontFamily: FB,
                          fontSize: "0.75rem",
                          color: "var(--adm-text2)",
                        }}
                      >
                        — {t.motivoBloqueo}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {proyectos.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "var(--adm-text3)",
            fontFamily: FB,
          }}
        >
          No hay proyectos activos.
        </div>
      )}
    </div>
  );
}
