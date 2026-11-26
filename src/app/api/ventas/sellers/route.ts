import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest, hashLoginToken } from "@/lib/ventas/session";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import crypto from "crypto";

const INVITE_DAYS = 7;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Correo de invitación con un enlace de entrada válido por 7 días (un solo uso). */
async function sendInvite(seller: { id: string; name: string; email: string }, origin: string, inviter: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.seller.update({ where: { id: seller.id }, data: { loginTokenHash: hashLoginToken(token), loginTokenExpiresAt: new Date(Date.now() + INVITE_DAYS * 86400000) } });
  const link = `${origin}/api/ventas/login/verify?sid=${encodeURIComponent(seller.id)}&t=${encodeURIComponent(token)}`;
  if (process.env.NODE_ENV !== "production") console.log(`[ventas invitación] enlace para ${seller.email}: ${link}`);
  await sendAdminEmail({
    to: seller.email,
    subject: "Te invitaron a QuieroComer Ventas",
    purpose: "ventas_invitacion",
    skipLog: true,
    html: `<!DOCTYPE html><html><body style="margin:0;background:#fbfaf7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
<div style="max-width:440px;margin:0 auto;padding:40px 24px;text-align:center">
  <div style="font-size:22px;font-weight:800;color:#111">¡Hola ${esc(seller.name.split(" ")[0])}!</div>
  <p style="font-size:15px;color:#555;line-height:1.6;margin:14px 0 26px">${esc(inviter)} te agregó al equipo de <b>QuieroComer Ventas</b>. Desde ahí capturas locales, les muestras su demo y los registras.</p>
  <a href="${esc(link)}" style="display:inline-block;background:#DE7C00;color:#fff;font-weight:700;font-size:16px;padding:14px 30px;border-radius:12px;text-decoration:none">Entrar a Ventas</a>
  <p style="font-size:13px;color:#777;margin:22px 0 0;line-height:1.5">El botón sirve una vez y vence en ${INVITE_DAYS} días. Después entras en <b>${esc(origin.replace(/^https?:\/\//, ""))}/ventas</b> con tu correo.</p>
</div></body></html>`,
  });
}

export const runtime = "nodejs";

/** POST /api/ventas/sellers  (solo ADMIN)  Body: { name, email, role? }  → agrega un vendedor. */
export async function POST(req: NextRequest) {
  const me = await getSellerFromRequest(req);
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim().slice(0, 80);
  const email = String(body?.email || "").trim().toLowerCase();
  const role = body?.role === "ADMIN" ? "ADMIN" : "SELLER";
  if (!name) return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Correo no válido" }, { status: 400 });
  const exists = await prisma.seller.findUnique({ where: { email }, select: { id: true } });
  if (exists) return NextResponse.json({ error: "Ese correo ya está en el equipo" }, { status: 409 });
  const seller = await prisma.seller.create({ data: { name, email, role }, select: { id: true, name: true, email: true, role: true, active: true } });
  let invited = true;
  try { await sendInvite(seller, req.nextUrl.origin, me.name); } catch (e) { invited = false; console.error("[ventas invitación]", e); }
  return NextResponse.json({ seller, invited });
}

/** PATCH /api/ventas/sellers  (solo ADMIN)  Body: { id, active?, role? } */
export async function PATCH(req: NextRequest) {
  const me = await getSellerFromRequest(req);
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  if (id === me.id) return NextResponse.json({ error: "No puedes cambiar tu propia cuenta" }, { status: 400 });
  const data: { active?: boolean; role?: "ADMIN" | "SELLER" } = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.role === "ADMIN" || body.role === "SELLER") data.role = body.role;
  const seller = await prisma.seller.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, active: true } });
  return NextResponse.json({ seller });
}

/** PUT /api/ventas/sellers  (solo ADMIN)  Body: { id } → reenvía la invitación. */
export async function PUT(req: NextRequest) {
  const me = await getSellerFromRequest(req);
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const seller = await prisma.seller.findUnique({ where: { id: String(body?.id || "") }, select: { id: true, name: true, email: true, active: true } });
  if (!seller) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!seller.active) return NextResponse.json({ error: "Está desactivado: actívalo primero" }, { status: 409 });
  try { await sendInvite(seller, req.nextUrl.origin, me.name); } catch (e) { console.error("[ventas invitación]", e); return NextResponse.json({ error: "No se pudo enviar el correo" }, { status: 502 }); }
  return NextResponse.json({ ok: true });
}
