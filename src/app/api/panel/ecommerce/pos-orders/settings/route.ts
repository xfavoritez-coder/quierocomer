import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { parseCentroPedidosConfig, parseEcommerceConfig, effectivePosMode, effectivePaymentMethods, normalizePaymentKey, type CentroPedidosConfig, type PaymentMethodConfig, type SharkposEmisor } from "@/lib/ecommerce/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    return teamMemberCanAccess(panelId.slice(3), restaurantId);
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET /api/panel/ecommerce/pos-orders/settings?restaurantId=X → config del pilar. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { centroPedidosConfig: true, ecommerceConfig: true, ecommerceStoreConfig: true, sharkposEnabled: true } });
  const config = parseCentroPedidosConfig(r?.centroPedidosConfig);
  const ecom = parseEcommerceConfig(r?.ecommerceConfig);
  const hasPos = ecom.pos?.provider === "toteat";
  const store = (r?.ecommerceStoreConfig && typeof r.ecommerceStoreConfig === "object") ? (r.ecommerceStoreConfig as Record<string, unknown>) : {};
  return NextResponse.json({
    config,
    hasPos,
    posModeEffective: effectivePosMode(config, ecom),
    posShowDescriptions: store.posShowDescriptions === true,
    paymentMethods: effectivePaymentMethods(config),
    sharkposEnabled: r?.sharkposEnabled === true,
  });
}

/** PUT /api/panel/ecommerce/pos-orders/settings → guarda la config del pilar.
 *  Body: { restaurantId, config: { autoDeliverPickup } } */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const current = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { centroPedidosConfig: true, ecommerceStoreConfig: true } });
  const merged: CentroPedidosConfig = { ...parseCentroPedidosConfig(current?.centroPedidosConfig) };
  const incoming = parseCentroPedidosConfig(body?.config);
  if (typeof incoming.autoDeliverPickup === "boolean") merged.autoDeliverPickup = incoming.autoDeliverPickup;
  if (typeof incoming.posMode === "boolean") merged.posMode = incoming.posMode;
  if (typeof incoming.uberEnabled === "boolean") merged.uberEnabled = incoming.uberEnabled;
  if (typeof incoming.pedidosyaEnabled === "boolean") merged.pedidosyaEnabled = incoming.pedidosyaEnabled;
  if (typeof incoming.customerAbsorbsSurcharge === "boolean") merged.customerAbsorbsSurcharge = incoming.customerAbsorbsSurcharge;
  if (typeof incoming.prepAlertMinutes === "number" && Number.isFinite(incoming.prepAlertMinutes)) {
    merged.prepAlertMinutes = Math.min(600, Math.max(0, Math.round(incoming.prepAlertMinutes)));
  }
  if (typeof incoming.readyAlertMinutes === "number" && Number.isFinite(incoming.readyAlertMinutes)) {
    merged.readyAlertMinutes = Math.min(600, Math.max(0, Math.round(incoming.readyAlertMinutes)));
  }
  // Métodos de pago: se guarda la lista saneada (key normalizada, sin duplicados).
  if (Array.isArray(incoming.paymentMethods)) {
    const seen = new Set<string>();
    const clean: PaymentMethodConfig[] = [];
    for (const m of incoming.paymentMethods.slice(0, 30)) {
      if (!m || typeof m !== "object") continue;
      const key = normalizePaymentKey(String((m as PaymentMethodConfig).key || (m as PaymentMethodConfig).label || ""));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      clean.push({
        key,
        label: String((m as PaymentMethodConfig).label || key).trim().slice(0, 40) || key,
        emitsFiscal: (m as PaymentMethodConfig).emitsFiscal !== false,
      });
    }
    if (clean.length) merged.paymentMethods = clean;
  }
  // Datos del emisor para la boleta impresa.
  if (incoming.sharkposEmisor && typeof incoming.sharkposEmisor === "object") {
    const e = incoming.sharkposEmisor as SharkposEmisor;
    const s = (v: unknown, max: number) => { const t = String(v ?? "").trim().slice(0, max); return t || undefined; };
    merged.sharkposEmisor = {
      razonSocial: s(e.razonSocial, 100),
      giro: s(e.giro, 100),
      direccion: s(e.direccion, 120),
      siiOffice: s(e.siiOffice, 60),
      resolucion: s(e.resolucion, 60),
    };
  }

  const data: { centroPedidosConfig: object; ecommerceStoreConfig?: object } = { centroPedidosConfig: merged as unknown as object };
  // "Mostrar descripción en Tomar pedidos" vive en ecommerceStoreConfig (lo lee el tomador).
  if (typeof body?.posShowDescriptions === "boolean") {
    const store = (current?.ecommerceStoreConfig && typeof current.ecommerceStoreConfig === "object") ? { ...(current.ecommerceStoreConfig as Record<string, unknown>) } : {};
    store.posShowDescriptions = body.posShowDescriptions;
    data.ecommerceStoreConfig = store;
  }

  await prisma.restaurant.update({ where: { id: restaurantId }, data });
  return NextResponse.json({ ok: true, config: merged, posShowDescriptions: data.ecommerceStoreConfig ? body.posShowDescriptions : undefined });
}
