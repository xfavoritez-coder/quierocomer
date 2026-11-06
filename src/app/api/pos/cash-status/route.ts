import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET /api/pos/cash-status?restaurantId=X
 *  Consulta pos_events en Supabase para determinar si hay una caja abierta.
 *  Fallback server-side para cuando el Dexie local del browser no tiene la sesión
 *  (p.ej. primer acceso del owner desde un browser nuevo). */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  if (!supabase) return NextResponse.json({ open: false });

  // Traer los últimos eventos de caja del restaurante
  const { data, error } = await supabase
    .from("pos_events")
    .select("type, payload")
    .eq("restaurant_id", restaurantId)
    .in("type", ["cash_session_opened", "cash_session_closed", "cash_session_deleted"])
    .order("server_seq", { ascending: false })
    .limit(100);

  // Error de Supabase o sin ningún evento de caja → estado desconocido.
  // NO devolver open:false en este caso: si el evento cash_session_opened aún no
  // llegó a Supabase (abierta offline / sync pendiente en el terminal), el banner
  // mostraría "Caja cerrada" aunque esté abierta. Solo confirmamos cierre cuando
  // encontramos eventos Y todos tienen cierre.
  if (error) return NextResponse.json({ open: null });
  if (!data?.length) return NextResponse.json({ open: null });

  // Reconstruir estado: sesión abierta = tiene opened sin closed/deleted posterior
  const sessions = new Map<string, { opened: boolean; closed: boolean }>();
  for (const event of data) {
    const payload = event.payload as Record<string, unknown>;
    const sessionId = (payload?.session_id as string) || "";
    if (!sessionId) continue;
    if (!sessions.has(sessionId)) sessions.set(sessionId, { opened: false, closed: false });
    const s = sessions.get(sessionId)!;
    if (event.type === "cash_session_opened") s.opened = true;
    if (event.type === "cash_session_closed" || event.type === "cash_session_deleted") s.closed = true;
  }

  const open = Array.from(sessions.values()).some(s => s.opened && !s.closed);
  return NextResponse.json({ open });
}
