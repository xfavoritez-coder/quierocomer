import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import FranProyectoNav from "@/components/fran/FranProyectoNav";

export const dynamic = "force-dynamic";

export default async function ProyectoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const proyecto = await prisma.franProyecto.findUnique({
    where: { slug },
    include: {
      marca: { select: { nombre: true, slug: true } },
      local: { select: { nombre: true } },
      etapas: {
        include: { tareas: { select: { peso: true, estado: true } } },
        orderBy: { orden: "asc" },
      },
    },
  });
  if (!proyecto) notFound();

  const todasTareas = proyecto.etapas.flatMap((e) => e.tareas);
  const totalPeso = todasTareas.reduce((s, t) => s + t.peso, 0) || 1;
  const completadoPeso = todasTareas
    .filter((t) => t.estado === "COMPLETADA")
    .reduce((s, t) => s + t.peso, 0);
  const pct = Math.round((completadoPeso / totalPeso) * 100);

  return (
    <div>
      <FranProyectoNav
        proyecto={{
          slug: proyecto.slug,
          nombre: proyecto.nombre,
          marcaNombre: proyecto.marca.nombre,
          localNombre: proyecto.local?.nombre,
        }}
        pct={pct}
      />
      <div style={{ padding: "0 36px 36px" }}>{children}</div>
    </div>
  );
}
