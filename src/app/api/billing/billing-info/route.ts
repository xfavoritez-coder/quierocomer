import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  REQUIRED_BILLING_FIELDS,
  isValidRut,
  formatRut,
  missingBillingFields,
} from "@/lib/billing/plans-config";

/**
 * GET  /api/billing/billing-info?restaurantId=...
 * PUT  /api/billing/billing-info  body: { restaurantId, ...billingFields }
 *
 * Datos de facturacion del restaurant (razon social, RUT, giro, etc.).
 * Requeridos antes de iniciar una suscripcion via Flow para emitir factura.
 */

const FIELDS = [
  "billingCompanyName",
  "billingRut",
  "billingGiro",
  "billingAddress",
  "billingCity",
  "billingEmail",
  "billingContactName",
  "billingPhone",
] as const;

type BillingField = (typeof FIELDS)[number];

async function getOwnerRestaurant(req: NextRequest, restaurantId: string) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return { error: "No autorizado", status: 401 as const };
  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    include: { restaurants: { where: { id: restaurantId }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") return { error: "No autorizado", status: 403 as const };
  const restaurant = owner.restaurants[0];
  if (!restaurant) return { error: "Restaurant no encontrado", status: 404 as const };
  return { restaurant };
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  const result = await getOwnerRestaurant(req, restaurantId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const r = result.restaurant;

  const data = {
    billingCompanyName: r.billingCompanyName,
    billingRut: r.billingRut,
    billingGiro: r.billingGiro,
    billingAddress: r.billingAddress,
    billingCity: r.billingCity,
    billingEmail: r.billingEmail,
    billingContactName: r.billingContactName,
    billingPhone: r.billingPhone,
  };
  const missing = missingBillingFields(data);

  return NextResponse.json({ ...data, isComplete: missing.length === 0, missingFields: missing });
}

export async function PUT(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }
  const { restaurantId } = body;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  const result = await getOwnerRestaurant(req, restaurantId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const data: Partial<Record<BillingField, string | null>> = {};
  for (const f of FIELDS) {
    if (body[f] === undefined) continue;
    const v = body[f];
    data[f] = v === null || v === "" ? null : String(v).trim();
  }

  // Validar y normalizar RUT si viene
  if (data.billingRut) {
    if (!isValidRut(data.billingRut)) {
      return NextResponse.json({ error: "RUT invalido" }, { status: 400 });
    }
    data.billingRut = formatRut(data.billingRut);
  }

  // Validar email basico
  if (data.billingEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.billingEmail)) {
      return NextResponse.json({ error: "Email invalido" }, { status: 400 });
    }
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data,
    select: {
      billingCompanyName: true,
      billingRut: true,
      billingGiro: true,
      billingAddress: true,
      billingCity: true,
      billingEmail: true,
      billingContactName: true,
      billingPhone: true,
    },
  });

  const missing = missingBillingFields(updated);
  void REQUIRED_BILLING_FIELDS;

  return NextResponse.json({
    ...updated,
    isComplete: missing.length === 0,
    missingFields: missing,
  });
}
