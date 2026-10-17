import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

export const runtime = "nodejs";

/**
 * GET /api/admin/locales/[id]/branches  (solo superadmin)
 * Devuelve la marca (brandSlug) del local y sus sucursales hermanas:
 * mismos ownerId y brandSlug. Incluye al propio local marcándolo con self:true.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const source = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true, ownerId: true, ecommerceStoreConfig: true },
  });
  if (!source) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });

  const brandSlug = parseStoreConfig(source.ecommerceStoreConfig).brandSlug;
  if (!brandSlug || !source.ownerId) {
    return NextResponse.json({ brandSlug: brandSlug || null, branches: [] });
  }

  const rows = await prisma.restaurant.findMany({
    where: { ownerId: source.ownerId, ecommerceStoreConfig: { path: ["brandSlug"], equals: brandSlug } },
    select: { id: true, name: true, slug: true, isActive: true, ecommerceEnabled: true, ecommerceStoreConfig: true },
    orderBy: { createdAt: "asc" },
  });

  const branches = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    isActive: r.isActive,
    ecommerceEnabled: r.ecommerceEnabled,
    branchName: parseStoreConfig(r.ecommerceStoreConfig).branchName,
    self: r.id === source.id,
  }));

  return NextResponse.json({ brandSlug, branches });
}

/**
 * PATCH /api/admin/locales/[id]/branches  (solo superadmin)
 * Body: { branchId, branchName }
 * Fija el nombre de sucursal (branchName) de una sucursal de la marca. El
 * branchId debe ser hermano del local [id] (mismo dueño + mismo brandSlug).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const branchId = (body?.branchId || "").toString();
  const branchName = ((body?.branchName ?? "").toString().trim().slice(0, 60)) || null;
  if (!branchId) return NextResponse.json({ error: "Falta branchId" }, { status: 400 });

  const source = await prisma.restaurant.findUnique({ where: { id }, select: { ownerId: true, ecommerceStoreConfig: true } });
  if (!source) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
  const brandSlug = parseStoreConfig(source.ecommerceStoreConfig).brandSlug;
  if (!brandSlug || !source.ownerId) return NextResponse.json({ error: "El local no pertenece a una marca" }, { status: 400 });

  const branch = await prisma.restaurant.findUnique({ where: { id: branchId }, select: { id: true, ownerId: true, ecommerceStoreConfig: true } });
  if (!branch) return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  const branchCfg = parseStoreConfig(branch.ecommerceStoreConfig);
  if (branch.ownerId !== source.ownerId || branchCfg.brandSlug !== brandSlug) {
    return NextResponse.json({ error: "Esa sucursal no pertenece a esta marca" }, { status: 403 });
  }

  await prisma.restaurant.update({
    where: { id: branchId },
    data: { ecommerceStoreConfig: { ...(branchCfg as unknown as object), branchName } as unknown as object },
  });

  return NextResponse.json({ ok: true, branchId, branchName });
}
