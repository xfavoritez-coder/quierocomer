import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, getLeadDemoRestaurant, addLeadEvent } from "@/lib/ventas/leads";
import { notifyMemberListDevices } from "@/lib/wallet/apns";
import { sendGoogleObjectMessage } from "@/lib/wallet/google";

export const runtime = "nodejs";

/** POST /api/ventas/leads/[id]/loyalty-push  Body: { kind: "near" | "birthday" }
 *  Durante la demo: envía al celular de quien se inscribió en la tarjeta (últimas 3 h) el aviso
 *  de "estás cerca" o el saludo de cumpleaños, igual que los envíos reales (Apple/Google Wallet).
 *  Solo locales demo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const r = await getLeadDemoRestaurant(lead.generatedSlug);
  if (!r) return NextResponse.json({ error: "Este local no tiene tarjeta de demo" }, { status: 409 });
  if (!rateLimit(`ventas-loyalty-push:${id}`, { limit: 10, windowMs: 10 * 60_000 }).success) return NextResponse.json({ error: "Espera un momento antes de enviar otra" }, { status: 429 });

  const b = await req.json().catch(() => ({}));
  const kind = b?.kind === "birthday" ? "birthday" : b?.kind === "near" ? "near" : null;
  if (!kind) return NextResponse.json({ error: "Tipo no válido" }, { status: 400 });

  const program = await prisma.loyaltyProgram.findUnique({ where: { restaurantId: r.id }, select: { id: true, rewards: true, geoMessage: true, birthdayTitle: true, birthdayMessage: true } });
  if (!program) return NextResponse.json({ error: "La tarjeta aún no está lista" }, { status: 409 });
  const members = await prisma.loyaltyMember.findMany({
    where: { restaurantId: r.id, revoked: false, enrolledAt: { gt: new Date(Date.now() - 3 * 3600_000) } },
    orderBy: { enrolledAt: "desc" }, take: 5, select: { id: true, name: true, googleObjectId: true },
  });
  if (!members.length) return NextResponse.json({ error: "Primero inscríbete en la tarjeta desde tu celular (paso anterior)" }, { status: 409 });

  const reward = Array.isArray(program.rewards) ? String(((program.rewards as unknown[])[0] as { reward?: string } | undefined)?.reward ?? "") : "";
  const first = (members[0].name || "").split(" ")[0];
  const title = kind === "near" ? r.name : (program.birthdayTitle || `¡Feliz cumpleaños${first ? `, ${first}` : ""}! 🎂`);
  const message = kind === "near"
    ? (program.geoMessage || `¡Estás a pasos de ${r.name}! Pasa a sumar tu sello${reward ? ` y acércate a tu ${reward.toLowerCase()}` : ""}.`)
    : (program.birthdayMessage || `Hoy ${r.name} te regala ${reward ? reward.toLowerCase() : "un premio"}. ¡Te esperamos!`);

  // Apple Wallet: el aviso aparece cuando cambia el mensaje del pase (igual que el cumpleaños real).
  await prisma.loyaltyProgram.update({ where: { id: program.id }, data: { pushMessage: `${title}: ${message}​${Date.now()}` } });
  await prisma.loyaltyMember.updateMany({ where: { id: { in: members.map((m) => m.id) } }, data: { updatedAt: new Date() } });
  const apple = await notifyMemberListDevices(members.map((m) => m.id));
  // Google Wallet: mensaje a cada tarjeta.
  let google = 0;
  for (const m of members.filter((x) => x.googleObjectId)) {
    if (await sendGoogleObjectMessage(m.googleObjectId!, title, message).catch(() => false)) google++;
  }
  await addLeadEvent(id, kind === "near" ? "loyalty_push_near" : "loyalty_push_birthday", "seller", seller.id, { payload: { apple, google, members: members.length } });
  if (!apple && !google) return NextResponse.json({ error: "Tu tarjeta aún no está en Apple Wallet o Google Wallet. Agrégala desde la página de inscripción." }, { status: 409 });
  return NextResponse.json({ ok: true, apple, google });
}
