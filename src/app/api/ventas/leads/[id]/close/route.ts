import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, addLeadEvent } from "@/lib/ventas/leads";
import { createRegistration, registrationUrl, sendRegistrationEmail, whatsappLink } from "@/lib/ventas/registration";

export const runtime = "nodejs";

const LOST_REASONS = new Set(["precio", "ya_tiene_sistema", "no_es_el_momento", "otro"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/ventas/leads/[id]/close — resultado de la demo (barra de cierre del vendedor).
 *  Body: { result: "accepted"|"thinking"|"lost"|"register_now", email?, whatsapp?, followUpAt?, lostReason?, lostDetail?, planId? } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (lead.captureSource === "example") return NextResponse.json({ error: "El local de ejemplo no se puede cerrar ni registrar" }, { status: 409 });
  const b = await req.json().catch(() => ({}));
  const result = String(b?.result || "");
  const email = String(b?.email || "").trim().toLowerCase();
  const whatsapp = String(b?.whatsapp || "").trim().slice(0, 30);
  const planId = typeof b?.planId === "string" ? b.planId.slice(0, 60) : null;
  const now = new Date();
  const setStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    await prisma.lead.update({ where: { id }, data: { crmStatus: status, crmStatusHistory: { push: { status, ts: now.toISOString() } }, ...extra } });
    if (status !== lead.crmStatus) await addLeadEvent(id, "status_changed", "seller", seller.id, { payload: { from: lead.crmStatus, to: status, result } });
  };

  if (result === "lost") {
    const reason = String(b?.lostReason || "");
    if (!LOST_REASONS.has(reason)) return NextResponse.json({ error: "Elige el motivo" }, { status: 400 });
    const detail = String(b?.lostDetail || "").trim().slice(0, 300);
    if (reason === "otro" && !detail) return NextResponse.json({ error: "Cuéntanos el motivo" }, { status: 400 });
    await setStatus("perdido", { lostReason: detail ? `${reason}: ${detail}` : reason, crmFollowUpAt: new Date(now.getTime() + 90 * 86400000) });
    return NextResponse.json({ ok: true, status: "perdido" });
  }

  if (result === "thinking") {
    const follow = Date.parse(String(b?.followUpAt || ""));
    if (!Number.isFinite(follow)) return NextResponse.json({ error: "Elige la fecha de seguimiento" }, { status: 400 });
    if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: "Correo no válido" }, { status: 400 });
    await setStatus("interesado", { crmFollowUpAt: new Date(follow), ...(email ? { email } : {}), ...(whatsapp ? { whatsapp } : {}), ...(planId ? { recommendedPlan: planId } : {}) });
    return NextResponse.json({ ok: true, status: "interesado" });
  }

  if (result === "accepted" || result === "register_now") {
    if (result === "accepted") {
      if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Falta un correo válido del dueño" }, { status: 400 });
      if (!whatsapp || whatsapp.replace(/\D/g, "").length < 8) return NextResponse.json({ error: "Falta el WhatsApp del dueño" }, { status: 400 });
    }
    let reg;
    try { reg = await createRegistration(id, email || null); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 409 }); }
    const url = registrationUrl(req.nextUrl.origin, reg.token);
    await setStatus("registro_enviado", { ...(email ? { email } : {}), ...(whatsapp ? { whatsapp } : {}), ...(planId ? { recommendedPlan: planId } : {}) });
    if (result === "accepted") {
      const sellerRow = await prisma.seller.findUnique({ where: { id: seller.id }, select: { name: true } });
      await sendRegistrationEmail(email, url, lead.localName, sellerRow?.name ?? null).catch((e) => console.error("[ventas] email registro", e));
      await addLeadEvent(id, "email_sent", "system", seller.id, { payload: { kind: "registro", to: email } });
      // En desarrollo no hay envío real: el enlace se muestra en la consola.
      if (process.env.NODE_ENV !== "production") console.log(`[ventas registro] enlace para ${email}: ${url}`);
    }
    return NextResponse.json({ ok: true, status: "registro_enviado", registerUrl: url, whatsappUrl: whatsapp ? whatsappLink(whatsapp, lead.localName, url) : null, expiresAt: reg.expiresAt });
  }

  return NextResponse.json({ error: "Resultado no válido" }, { status: 400 });
}
