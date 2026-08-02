import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { buildAutoLoginUrl } from "@/lib/email/autoLoginUrl";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ownerId, email: rawEmail } = body;
    if (!ownerId && !rawEmail) return NextResponse.json({ error: "missing ownerId or email" }, { status: 400 });

    const owner = ownerId
      ? await prisma.restaurantOwner.findUnique({
          where: { id: ownerId },
          select: { id: true, email: true, name: true, status: true },
        })
      : await prisma.restaurantOwner.findFirst({
          where: { email: rawEmail.trim().toLowerCase() },
          select: { id: true, email: true, name: true, status: true },
        });

    if (!owner || owner.status !== "ACTIVE") {
      // Return ok to avoid email enumeration
      return NextResponse.json({ ok: true });
    }

    const autoLoginUrl = buildAutoLoginUrl(BASE_URL, owner.id);
    const firstName = owner.name.split(" ")[0];

    const html = `<html><head><meta charset="UTF-8"></head>
<body style="background:#0f0d0a;font-family:'Segoe UI',system-ui,sans-serif;margin:0;padding:24px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:420px;margin:0 auto;">
<tr><td style="text-align:center;padding-bottom:20px;">
  <span style="font-family:Georgia,serif;font-size:16px;color:#e8930a;">QuieroComer</span>
</td></tr>
<tr><td style="background:#1a1710;border:1px solid #3a3020;border-radius:24px;padding:32px 24px;">
  <h1 style="font-family:Georgia,serif;font-size:22px;color:#f5f0e8;text-align:center;margin:0 0 16px;">
    ${firstName ? `${firstName}, verifica` : "Verifica"} tu correo
  </h1>
  <p style="font-size:14px;color:#9a8a70;text-align:center;margin:0 0 24px;line-height:1.6;">
    Haz clic en el botón para verificar tu correo y acceder a tu panel de QuieroComer.
  </p>
  <a href="${autoLoginUrl}" style="display:block;background:#e8930a;color:#fff;font-size:15px;font-weight:800;padding:18px;border-radius:14px;text-decoration:none;text-align:center;margin:0 auto;max-width:320px;">
    Verificar mi correo →
  </a>
  <p style="font-size:11px;color:#5a4a35;text-align:center;margin:20px 0 0;">
    Este link expira en 7 días. Si no creaste esta cuenta, ignora este email.
  </p>
</td></tr>
</table>
</body></html>`;

    await sendAdminEmail({
      to: owner.email,
      subject: "Verifica tu correo — QuieroComer",
      html,
      purpose: "email_verification",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[resend-verification] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
