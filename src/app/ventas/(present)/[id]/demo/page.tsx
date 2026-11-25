import { notFound } from "next/navigation";
import { getCurrentSeller } from "@/lib/ventas/session";
import { getSellerLead } from "@/lib/ventas/leads";
import { buildDemoData } from "@/lib/ventas/demoData";
import DemoShell from "@/components/ventas/demo/DemoShell";
import { ensureDemoLoyalty, ensureDemoStore } from "@/lib/ventas/demoLive";
import { demoPrize } from "@/components/ventas/demo/dishes";

export const dynamic = "force-dynamic";

export default async function VentasDemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = (await getCurrentSeller())!;
  const lead = await getSellerLead(seller, id);
  if (!lead) notFound();
  const data = await buildDemoData(lead);
  // Programa de fidelidad de demostración (solo locales demo) para el momento interactivo.
  // Para los momentos interactivos: tarjeta de fidelidad y tienda de prueba (solo locales demo).
  await Promise.all([
    ensureDemoLoyalty(data.slug, { color: data.color, prize: demoPrize(data)?.name ?? null }),
    ensureDemoStore(data.slug, data.color),
  ]);
  return <DemoShell data={data} mode="seller" exitHref={`/ventas/${id}`} seller={{ email: lead.email ?? "", whatsapp: lead.whatsapp ?? "", interests: lead.interestModules ?? [] }} />;
}
