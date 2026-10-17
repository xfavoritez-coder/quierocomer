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
