import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProyectoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/franquicia/proyecto/${slug}/etapas`);
}
