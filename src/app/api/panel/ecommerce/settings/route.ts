import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess, demoSessionCanAccess } from "@/lib/ecommerce/panelAuth";
import { parseStoreConfig, ALL_PAYMENT_METHODS } from "@/lib/ecommerce/store-config";
import { revalidateEcommerceCache } from "@/lib/ecommerce/revalidate";
import { getPanelId } from "@/lib/session";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = getPanelId(req);
  if (!panelId) return false;
  if (panelId === "demo") return demoSessionCanAccess(req, restaurantId);
  if (panelId.startsWith("tm_")) {
    return teamMemberCanAccess(panelId.slice(3), restaurantId);
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

function fallbackFor(r: { cartaAccentColor: string | null; orderingPaymentMethods: string | null }) {
  return {
    accent: r.cartaAccentColor,
    paymentMethods: (r.orderingPaymentMethods || "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

/** GET → config de tienda (colores, métodos de pago, notas) con defaults resueltos. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceStoreConfig: true, cartaAccentColor: true, orderingPaymentMethods: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ config: parseStoreConfig(r.ecommerceStoreConfig, fallbackFor(r)), allMethods: ALL_PAYMENT_METHODS });
}

/** PUT → guarda la config de tienda. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = body?.restaurantId as string | undefined;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { cartaAccentColor: true, orderingPaymentMethods: true, ecommerceStoreConfig: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const config = parseStoreConfig(body?.config, fallbackFor(r));
  // IMPORTANTE: parseStoreConfig solo conserva los campos del esquema conocido y
  // descarta cualquier clave extra. Hay datos que viven en este mismo JSON pero
  // NO están en el form de la tienda (ej. recoveryImportedClients = los correos
  // importados de clientes perdidos). Si guardáramos solo `config` se perderían al
  // guardar la Configuración de la tienda. Por eso superponemos los campos del form
  // sobre el JSON existente, preservando esas claves extra.
  const prevRaw = (r.ecommerceStoreConfig && typeof r.ecommerceStoreConfig === "object" && !Array.isArray(r.ecommerceStoreConfig))
    ? (r.ecommerceStoreConfig as Record<string, unknown>) : {};
  const merged = { ...prevRaw, ...(config as unknown as Record<string, unknown>) };
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceStoreConfig: merged as object } });
  revalidateEcommerceCache({ id: restaurantId });
  return NextResponse.json({ ok: true, config });
}
