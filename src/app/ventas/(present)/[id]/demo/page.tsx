import { notFound } from "next/navigation";
import { getCurrentSeller } from "@/lib/ventas/session";
import { getSellerLead } from "@/lib/ventas/leads";
import { buildDemoData } from "@/lib/ventas/demoData";
import DemoShell from "@/components/ventas/demo/DemoShell";

export const dynamic = "force-dynamic";

export default async function VentasDemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = (await getCurrentSeller())!;
  const lead = await getSellerLead(seller, id);
  if (!lead) notFound();
  const data = await buildDemoData(lead);
  // La tarjeta, la tienda y el garzón de la demo se preparan al abrirla (POST .../prepare, desde DemoShell).
  // Ya registrado: la demo se puede volver a mostrar, pero sin barra de cierre.
  const closed = ["registrado", "activo"].includes(lead.crmStatus || "");
  return <DemoShell data={data} mode="seller" exitHref={`/ventas/${id}`} seller={closed ? undefined : { email: lead.email ?? "", whatsapp: lead.whatsapp ?? "", interests: lead.interestModules ?? [] }} />;
}
