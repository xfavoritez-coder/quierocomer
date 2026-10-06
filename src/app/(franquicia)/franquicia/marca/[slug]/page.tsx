import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FolderOpen, MapPin, Building2 } from "lucide-react";
import MarcaIdentidadClient from "@/components/fran/MarcaIdentidadClient";

export const dynamic = "force-dynamic";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

const ESTADO_LOCAL_LABEL: Record<string, string> = {
  EN_PROYECTO: "En proyecto",
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
  PAUSADO: "Pausado",
};

const ESTADO_PROYECTO_LABEL: Record<string, string> = {
  PLANIFICACION: "Planificación",
  EN_DESARROLLO: "En desarrollo",
  PAUSADO: "Pausado",
  ABIERTO: "Abierto",
  CANCELADO: "Cancelado",
};

export default async function MarcaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const marca = await prisma.franMarca.findUnique({
    where: { slug },
    include: {
      identidad: true,
      locales: { orderBy: { createdAt: "asc" } },
      proyectos: {
        where: { estado: { not: "CANCELADO" } },
        include: {
          local: { select: { nombre: true } },
          etapas: {
            include: { tareas: { select: { peso: true, estado: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!marca) notFound();

  return (
    <div style={{ padding: "32px 36px", maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <Building2 size={20} color={GOLD} />
          <h1
            style={{
              fontFamily: F,
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--adm-text)",
              margin: 0,
            }}
          >
            {marca.nombre}
          </h1>
        </div>
        {marca.descripcion && (
          <p
            style={{
              fontFamily: FB,
              fontSize: "0.85rem",
              color: "var(--adm-text2)",
              margin: 0,
            }}
          >
            {marca.descripcion}
          </p>
        )}
      </div>

      {/* Locales */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontFamily: F,
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--adm-text)",
            marginBottom: 12,
          }}
        >
          Locales
        </h2>
        {marca.locales.length === 0 ? (
          <p
            style={{
              fontFamily: FB,
              fontSize: "0.85rem",
              color: "var(--adm-text3)",
            }}
          >
            No hay locales registrados.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {marca.locales.map((local) => (
              <div
                key={local.id}
                style={{
                  background: "var(--adm-card)",
                  border: "1px solid var(--adm-card-border)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <MapPin size={15} color={GOLD} />
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      color: "var(--adm-text)",
                    }}
                  >
                    {local.nombre}
                  </span>
                  {local.direccion && (
                    <span
                      style={{
                        fontFamily: FB,
                        fontSize: "0.78rem",
                        color: "var(--adm-text3)",
                        marginLeft: 8,
                      }}
                    >
                      {local.direccion}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: F,
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    padding: "2px 9px",
                    borderRadius: 99,
                    background:
                      local.estado === "ABIERTO"
                        ? "rgba(16,185,129,0.12)"
                        : "rgba(244,166,35,0.12)",
                    color:
                      local.estado === "ABIERTO" ? "#10b981" : GOLD,
                  }}
                >
                  {ESTADO_LOCAL_LABEL[local.estado] ?? local.estado}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proyectos */}
      <div>
        <h2
          style={{
            fontFamily: F,
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--adm-text)",
            marginBottom: 12,
          }}
        >
          Proyectos activos
        </h2>
        {marca.proyectos.length === 0 ? (
          <p
            style={{
              fontFamily: FB,
              fontSize: "0.85rem",
              color: "var(--adm-text3)",
            }}
          >
            No hay proyectos activos.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {marca.proyectos.map((p) => {
              const todasTareas = p.etapas.flatMap((e) => e.tareas);
              const totalPeso =
                todasTareas.reduce((s, t) => s + t.peso, 0) || 1;
              const completadoPeso = todasTareas
                .filter((t) => t.estado === "COMPLETADA")
                .reduce((s, t) => s + t.peso, 0);
              const pct = Math.round((completadoPeso / totalPeso) * 100);

              return (
                <Link
                  key={p.id}
                  href={`/franquicia/proyecto/${p.slug}/etapas`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      background: "var(--adm-card)",
                      border: "1px solid var(--adm-card-border)",
                      borderRadius: 12,
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <FolderOpen size={16} color={GOLD} />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontFamily: F,
                          fontSize: "0.88rem",
                          fontWeight: 600,
                          color: "var(--adm-text)",
                        }}
                      >
                        {p.nombre}
                      </div>
                      {p.local && (
                        <div
                          style={{
                            fontFamily: FB,
                            fontSize: "0.75rem",
                            color: "var(--adm-text3)",
                          }}
                        >
                          {p.local.nombre}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 80,
                          height: 4,
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
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontFamily: F,
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: GOLD,
                          minWidth: 32,
                          textAlign: "right",
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: F,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        padding: "2px 9px",
                        borderRadius: 99,
                        background: `${GOLD}18`,
                        color: GOLD,
                      }}
                    >
                      {ESTADO_PROYECTO_LABEL[p.estado] ?? p.estado}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>

      <MarcaIdentidadClient
        marcaSlug={slug}
        marcaNombre={marca.nombre}
        identidadInicial={marca.identidad ?? null}
      />
    </div>
  );
}
