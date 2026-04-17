import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

    // Find or create user
    const user = await prisma.qRUser.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    // Generate magic token
    const token = await prisma.qRMagicToken.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://quierocomer.cl";
    const verifyUrl = `${baseUrl}/api/qr/user/verify?token=${token.token}`;

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || "QuieroComer <noreply@quierocomer.cl>",
          to: email,
          subject: "Tu link para ingresar a QuieroComer",
          html: `
            <div style="font-family:'DM Sans',sans-serif;background:#faf6ee;padding:40px 20px">
              <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px;text-align:center">
                <p style="font-size:18px;font-weight:700;color:#0e0e0e;margin:0 0 4px">Quiero<span style="color:#F4A623">Comer</span>.cl</p>
                <h1 style="font-size:22px;font-weight:800;color:#0e0e0e;margin:24px 0 8px">Tu link de acceso</h1>
                <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 24px">Toca el botón para ingresar. No necesitas contraseña.</p>
                <a href="${verifyUrl}" style="display:inline-block;background:#F4A623;color:#0e0e0e;text-decoration:none;padding:14px 28px;border-radius:50px;font-weight:700;font-size:16px">Ingresar a QuieroComer →</a>
                <p style="color:#aaa;font-size:13px;margin:24px 0 0">Si no solicitaste esto, ignora este correo.</p>
              </div>
              <p style="text-align:center;color:#ccc;font-size:12px;margin-top:20px">© QuieroComer.cl · Santiago, Chile</p>
            </div>
          `,
        }),
      });
      const emailData = await emailRes.json();
      if (!emailRes.ok) console.error("Resend error:", emailData);
    }

    return NextResponse.json({ ok: true, hasResendKey: !!resendKey });
  } catch (error) {
    console.error("Magic link error:", error);
    return NextResponse.json({ error: "Error al enviar" }, { status: 500 });
  }
}
