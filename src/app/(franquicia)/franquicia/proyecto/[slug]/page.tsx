import { redirect } from "next/navigation";
import { requireFranAccess } from "@/lib/franAuth";

export const dynamic = "force-dynamic";

export default async function ProyectoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireFranAccess();
  const { slug } = await params;
  redirect(`/franquicia/proyecto/${slug}/etapas`);
}
