import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { buildAutoLoginUrl } from "@/lib/email/autoLoginUrl";
import bcrypt from "bcryptjs";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

const BLOCKED_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwam.com",
  "yopmail.com", "trashmail.com", "sharklasers.com", "guerrillamailblock.com",
  "grr.la", "dispostable.com", "mailnull.com", "spamgourmet.com",
  "10minutemail.com", "fakeinbox.com",
];

export async function POST(req: NextRequest) {
  try {
    const { ownerId, newEmail } = await req.json();
    if (!ownerId || !newEmail) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    const email = newEmail.trim().toLowerCase();
    if (!email.includes("@") || !email.includes(".")) {
      return NextResponse.json({ message: "Email inválido" }, { status: 400 });
    }

    const domain = email.split("@")[1];
    if (BLOCKED_DOMAINS.includes(domain)) {
      return NextResponse.json({ message: "No se permiten emails temporales" }, { status: 400 });
    }

    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: ownerId },
      select: { id: true, email: true, name: true, status: true, restaurants: { select: { slug: true } } },
    });

    if (!owner || owner.status !== "ACTIVE") {
      return NextResponse.json({ error: "Owner no encontrado" }, { status: 404 });
    }

    // Check email not taken by another owner
    const existing = await prisma.restaurantOwner.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: ownerId } },
    });
    if (existing) {
      return NextResponse.json({ message: "Ese email ya está registrado en otra cuenta" }, { status: 409 });
    }

    // Update email — also regenerate password hash since password is based on slug
    const slug = owner.restaurants[0]?.slug;
    const newPasswordHash = slug ? await bcrypt.hash(`${slug}2026`, 10) : undefined;

    await prisma.restaurantOwner.update({
      where: { id: ownerId },
      data: {
        email,
        emailVerificado: false,
        emailVerificadoAt: null,
        ...(newPasswordHash && { passwordHash: newPasswordHash }),
      },
    });

    // Send verification email to new address
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
    ${firstName ? `${firstName}, verifica` : "Verifica"} tu nuevo correo
  </h1>
  <p style="font-size:14px;color:#9a8a70;text-align:center;margin:0 0 24px;line-height:1.6;">
    Actualizamos tu correo a <strong style="color:#c9b89a;">${email}</strong>.<br/>
    Haz clic para verificar y acceder a tu panel.
  </p>
  <a href="${autoLoginUrl}" style="display:block;background:#e8930a;color:#fff;font-size:15px;font-weight:800;padding:18px;border-radius:14px;text-decoration:none;text-align:center;margin:0 auto;max-width:320px;">
    Verificar mi correo →
  </a>
  <p style="font-size:11px;color:#5a4a35;text-align:center;margin:20px 0 0;">
    Este link expira en 7 días.
  </p>
</td></tr>
</table>
</body></html>`;

    await sendAdminEmail({
      to: email,
      subject: "Verifica tu nuevo correo — QuieroComer",
      html,
      purpose: "email_verification",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[change-email] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
