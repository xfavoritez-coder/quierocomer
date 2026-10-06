import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EtapaTasksClient from "@/components/fran/EtapaTasksClient";

export const dynamic = "force-dynamic";

export default async function EtapaPage({
  params,
}: {
  params: Promise<{ slug: string; etapaId: string }>;
}) {
  const { slug, etapaId } = await params;
  const etapa = await prisma.franEtapa.findUnique({
    where: { id: etapaId },
    include: {
      proyecto: { select: { slug: true, nombre: true } },
      tareas: {
        orderBy: { orden: "asc" },
        include: { checklist: { orderBy: { orden: "asc" } } },
      },
    },
  });
  if (!etapa || etapa.proyecto.slug !== slug) notFound();

  return <EtapaTasksClient etapa={etapa} proyectoSlug={slug} />;
}
