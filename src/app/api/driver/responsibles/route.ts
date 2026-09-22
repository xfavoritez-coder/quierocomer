import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authDriver } from "@/lib/driver/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/driver/responsibles → { ok, workers:[{id,name,role_label}] } */
export async function GET(req: NextRequest) {
  const driver = await authDriver(req);
  if (!driver) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

  const workers = await prisma.deliveryResponsible.findMany({
    where: { restaurantId: driver.restaurantId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, roleLabel: true },
  });
  return NextResponse.json({ ok: true, workers: workers.map((w) => ({ id: w.id, name: w.name, role_label: w.roleLabel || "" })) });
}
