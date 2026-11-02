import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { FROM_QC } from "@/lib/email/from";

/**
 * POST /api/qr/user/send-otp
 * Envía un código OTP de 6 dígitos al email del cliente (login del ecommerce /pedir).
 * Reutiliza QRUser + QRMagicToken + Resend (no duplica la identidad de cliente).
 */
export async function POST(request: Request) {
  try {
    const { email, name, storeName, logoUrl, primaryColor } = await request.json();
    const cleanEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
    // Nombre del local que solicita el código (opcional; el flujo QR no lo envía).
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
    const storePlain = typeof storeName === "string" && storeName.trim() ? storeName.trim().slice(0, 60) : null;
    const store = storePlain ? esc(storePlain) : null;
    const logo = typeof logoUrl === "string" && logoUrl.trim() ? logoUrl.trim() : null;
    const accent = typeof primaryColor === "string" && /^#[0-9a-fA-F]{3,6}$/.test(primaryColor.trim()) ? primaryColor.trim() : "#F4A623";
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
          from: storePlain ? `${storePlain} <hola@quierocomer.cl>` : FROM_QC,
          to: cleanEmail,
          subject: storePlain ? `${code} · tu código para pedir en ${storePlain}` : `${code} es tu código de acceso a QuieroComer`,
          html: `
            <div style="font-family:'DM Sans',Arial,sans-serif;background:#f5f5f5;padding:40px 16px;margin:0">
              <div style="max-width:460px;margin:0 auto">
                <div style="background:${accent};border-radius:12px 12px 0 0;padding:28px 32px;text-align:center">
                  ${logo
                    ? `<img src="${esc(logo)}" alt="${store || "Logo"}" style="height:52px;max-width:180px;object-fit:contain;display:block;margin:0 auto" />`
                    : `<p style="font-size:22px;font-weight:800;color:#fff;margin:0;letter-spacing:-0.5px">${store || "QuieroComer"}</p>`
                  }
                </div>
                <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px;text-align:center">
                  <h1 style="font-size:20px;font-weight:800;color:#0e0e0e;margin:0 0 8px">Tu código de acceso</h1>
                  <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 24px">${store ? `Úsalo para completar tu pedido en <b>${store}</b>.<br>Vence en 10 minutos.` : "Usa este código para iniciar sesión.<br>Vence en 10 minutos."}</p>
                  <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#0e0e0e;background:#f5f5f5;border-radius:10px;padding:18px 0;margin:0 0 24px">${code}</div>
                  <p style="color:#bbb;font-size:12px;margin:0">Si no solicitaste esto, ignora este correo.</p>
                </div>
                <p style="text-align:center;color:#bbb;font-size:11px;margin-top:16px">Powered by QuieroComer.cl</p>
              </div>
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
