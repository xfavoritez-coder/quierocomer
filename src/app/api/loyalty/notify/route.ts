import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";
import { ensureProgram } from "@/lib/loyalty";
import { sendGoogleObjectMessage } from "@/lib/wallet/google";
import { notifyMemberListDevices } from "@/lib/wallet/apns";
import { getFilteredMemberIds, type MemberFilter } from "@/lib/loyalty/memberFilter";

export const runtime = "nodejs";

// POST /api/loyalty/notify  → envía notificación push a un segmento de tarjetas (iOS + Android).
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const restaurantId = body.restaurantId as string | undefined;
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
    const message = typeof body.body === "string" ? body.body.trim().slice(0, 300) : "";
    if (!message) return NextResponse.json({ error: "Escribe el mensaje" }, { status: 400 });

    const filter = (body.filter || "all") as MemberFilter;

    // Obtener IDs de miembros que cumplen el filtro
    const memberIds = await getFilteredMemberIds(restaurantId, filter);
    if (!memberIds.length) {
      return NextResponse.json({ ok: true, appleDevices: 0, google: false, googleMembers: 0, recipients: 0 });
    }

    const program = await ensureProgram(restaurantId);

    // 1) Apple: actualizar pushMessage en el programa y updatedAt solo de los miembros filtrados.
    // El timestamp invisible garantiza que el campo siempre cambie entre pushes con el mismo texto.
    const appleValue = title ? `${title}: ${message}` : message;
    const appleValueUniq = `${appleValue}\u200b${Date.now()}`;
    await prisma.loyaltyProgram.update({ where: { id: program.id }, data: { pushMessage: appleValueUniq } });
    await prisma.loyaltyMember.updateMany({
      where: { id: { in: memberIds } },
      data: { updatedAt: new Date() },
    });
    const appleDevices = await notifyMemberListDevices(memberIds);

    // 2) Google: un mensaje a cada objeto (tarjeta) → notificación en Android
    const googleCards = await prisma.loyaltyMember.findMany({
      where: { id: { in: memberIds }, googleObjectId: { not: null } },
      select: { googleObjectId: true },
    });
    let googleMembers = 0;
    for (const c of googleCards) {
      try {
        if (await sendGoogleObjectMessage(c.googleObjectId!, title || "Novedad", message)) googleMembers++;
      } catch (e) {
        console.error("[Loyalty notify] Google objeto:", e);
      }
    }
    const google = googleMembers > 0;

    const recipients = appleDevices + googleMembers;
    await prisma.loyaltyBroadcast.create({
      data: { restaurantId, title, body: message, recipients, filter },
    });

    return NextResponse.json({ ok: true, appleDevices, google, googleMembers, recipients });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty notify]", e);
    return NextResponse.json({ error: e.message || "Error al enviar" }, { status: 500 });
  }
}

// GET /api/loyalty/notify?restaurantId=xxx → historial de notificaciones
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const history = await prisma.loyaltyBroadcast.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ history });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty notify GET]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
