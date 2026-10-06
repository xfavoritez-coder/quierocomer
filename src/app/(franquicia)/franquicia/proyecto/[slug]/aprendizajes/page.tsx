import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AprendizajesClient from "@/components/fran/AprendizajesClient";

export const dynamic = "force-dynamic";

export default async function AprendizajesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const proyecto = await prisma.franProyecto.findUnique({
    where: { slug },
    include: {
      aprendizajes: {
        orderBy: { createdAt: "desc" },
        include: {
          bitacora: { select: { id: true, titulo: true } },
        },
      },
    },
  });
  if (!proyecto) notFound();

  return (
    <AprendizajesClient
      proyectoId={proyecto.id}
      aprendizajes={proyecto.aprendizajes}
    />
  );
}
