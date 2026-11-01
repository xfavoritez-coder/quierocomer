import { NextRequest, NextResponse } from "next/server";
import { loadEcommerceStorefront } from "@/lib/ecommerce/storefront-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ecommerce/storefront/<slug>
 * Catálogo + tenant público de una sucursal (el mismo shape que usa la tienda).
 * Lo consume la vista de marca (/ecommerce/marca/<brand>) para, al elegir sucursal,
 * cargar su catálogo real y re-mapear el carrito sin cambiar de URL. Datos públicos
 * (iguales a los que ya expone la tienda de esa sucursal).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadEcommerceStorefront(slug);
  if (!data) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  return NextResponse.json(data);
}
