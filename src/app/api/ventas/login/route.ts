import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS, getClientIp } from "@/lib/rateLimit";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { newLoginToken, LOGIN_LINK_MINUTES } from "@/lib/ventas/session";

export const runtime = "nodejs";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** POST /api/ventas/login  Body: { email }
 *  Envía un enlace de ingreso de un solo uso. Responde siempre igual (no revela
 *  si el correo pertenece a un vendedor). */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`ventas-login:${ip}`, RATE_LIMITS.forgotPassword).success) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un rato e inténtalo de nuevo." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Correo no válido" }, { status: 400 });

  const seller = await prisma.seller.findUnique({ where: { email }, select: { id: true, name: true, active: true } });
  if (seller?.active && rateLimit(`ventas-login-email:${email}`, RATE_LIMITS.forgotPassword).success) {
    const { token, hash, expiresAt } = newLoginToken();
    await prisma.seller.update({ where: { id: seller.id }, data: { loginTokenHash: hash, loginTokenExpiresAt: expiresAt } });
    const link = `${req.nextUrl.origin}/api/ventas/login/verify?sid=${encodeURIComponent(seller.id)}&t=${encodeURIComponent(token)}`;
    // En desarrollo no hay envío real de correos: el enlace se muestra en la consola del servidor.
    if (process.env.NODE_ENV !== "production") console.log(`[ventas login] enlace para ${email}: ${link}`);
    await sendAdminEmail({
      to: email,
      subject: "Tu acceso a QuieroComer Ventas",
      purpose: "ventas_login",
      skipLog: true,
      html: `<!DOCTYPE html><html><body style="margin:0;background:#fbfaf7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
<div style="max-width:440px;margin:0 auto;padding:40px 24px;text-align:center">
  <div style="font-size:22px;font-weight:800;color:#111">Hola ${esc(seller.name)}</div>
  <p style="font-size:15px;color:#555;line-height:1.6;margin:14px 0 26px">Toca el botón para entrar a QuieroComer Ventas. El enlace sirve una sola vez y vence en ${LOGIN_LINK_MINUTES} minutos.</p>
  <a href="${esc(link)}" style="display:inline-block;background:#DE7C00;color:#fff;font-weight:700;font-size:16px;padding:14px 30px;border-radius:12px;text-decoration:none">Entrar a Ventas</a>
  <p style="font-size:12px;color:#999;margin-top:26px">Si no pediste este acceso, ignora este correo.</p>
</div></body></html>`,
    }).catch((e) => console.error("[ventas login] email", e));
  }
  return NextResponse.json({ ok: true });
}
