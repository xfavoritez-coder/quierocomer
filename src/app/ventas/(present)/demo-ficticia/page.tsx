import { redirect } from "next/navigation";
import { getCurrentSeller } from "@/lib/ventas/session";
import { ensureExampleRestaurant, getExampleLead } from "@/lib/ventas/example";

export const dynamic = "force-dynamic";

/** "Demo de ejemplo": abre la demo del local de ejemplo (Dulce Aroma), que es un local demo real
 *  con carta QR, tienda y tarjeta funcionando para probar en vivo. */
export default async function VentasDemoEjemploPage() {
  const seller = (await getCurrentSeller())!;
  await ensureExampleRestaurant();
  const lead = await getExampleLead(seller.id);
  redirect(`/ventas/${lead.id}/demo`);
}
