import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * POST /api/qr/user/send-otp
 * Envía un código OTP de 6 dígitos al email del cliente (login del ecommerce /pedir).
 * Reutiliza QRUser + QRMagicToken + Resend (no duplica la identidad de cliente).
 */
export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();
    const cleanEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    // Rate limit por email + IP (5 códigos cada 15 min)
    const ip = getClientIp(request);
    const rl = rateLimit(`otp:${cleanEmail}:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
    }

    // Reutiliza / crea el QRUser
    const user = await prisma.qRUser.upsert({
      where: { email: cleanEmail },
      update: name ? { name } : {},
      create: { email: cleanEmail, name: name || null },
    });

    // Código de 6 dígitos, expira en 10 minutos
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.qRMagicToken.create({
      data: { userId: user.id, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || "QuieroComer <noreply@quierocomer.com>",
          to: cleanEmail,
          subject: `${code} es tu código de acceso a QuieroComer`,
          html: `
            <div style="font-family:'DM Sans',sans-serif;background:#faf6ee;padding:40px 20px">
              <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px;text-align:center">
                <p style="font-size:18px;font-weight:700;color:#0e0e0e;margin:0 0 4px">Quiero<span style="color:#F4A623">Comer</span>.cl</p>
                <h1 style="font-size:22px;font-weight:800;color:#0e0e0e;margin:24px 0 8px">Tu código de acceso</h1>
                <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px">Usa este código para iniciar sesión. Vence en 10 minutos.</p>
                <div style="font-size:38px;font-weight:800;letter-spacing:8px;color:#0e0e0e;background:#faf6ee;border-radius:12px;padding:16px 0;margin:0 0 20px">${code}</div>
                <p style="color:#aaa;font-size:13px;margin:0">Si no solicitaste esto, ignora este correo.</p>
              </div>
              <p style="text-align:center;color:#ccc;font-size:12px;margin-top:20px">© QuieroComer.cl · Santiago, Chile</p>
            </div>
          `,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!emailRes.ok) console.error("Resend OTP error:", await emailRes.json().catch(() => ({})));
    } else {
      console.log(`[OTP dev] ${cleanEmail} -> ${code}`);
    }

    // Sin RESEND_API_KEY (entorno local) devolvemos el código para poder probar el flujo.
    return NextResponse.json({ ok: true, ...(!resendKey && { devCode: code }) });
  } catch (e) {
    console.error("send-otp error:", e);
    return NextResponse.json({ error: "Error al enviar el código" }, { status: 500 });
  }
}
