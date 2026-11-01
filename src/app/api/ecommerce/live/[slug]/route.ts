import { NextRequest, NextResponse } from "next/server";
import { loadEcommerceLive } from "@/lib/ecommerce/storefront-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ecommerce/live/<slug>
 * Capa "en vivo" y liviana de una sucursal: estado abierto/cerrado, métodos
 * disponibles, agotados y precio de happy hour por horario. Siempre fresca
 * (no-store). El menú (catálogo) va cacheado aparte; esto es el equivalente al
 * "/disableds" de Mercat para refrescar disponibilidad sin recargar el menú.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const live = await loadEcommerceLive(slug);
  if (!live) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  return NextResponse.json(live, { headers: { "Cache-Control": "no-store" } });
}
