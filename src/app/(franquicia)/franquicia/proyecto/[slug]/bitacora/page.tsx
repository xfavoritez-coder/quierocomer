import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import BitacoraClient from "@/components/fran/BitacoraClient";

export const dynamic = "force-dynamic";

export default async function BitacoraPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const proyecto = await prisma.franProyecto.findUnique({
    where: { slug },
    include: {
      bitacora: {
        orderBy: { fecha: "desc" },
        include: { aprendizaje: { select: { id: true } } },
      },
      etapas: {
        select: { id: true, nombre: true },
        orderBy: { orden: "asc" },
      },
    },
  });
  if (!proyecto) notFound();

  return (
    <BitacoraClient
      proyecto={{
        id: proyecto.id,
        slug: proyecto.slug,
        etapas: proyecto.etapas,
      }}
      entradas={proyecto.bitacora}
    />
  );
}
