import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { email, name, birthDate, dietType, restrictions, restaurantId, source, bannerVariantId } = await request.json();

    if (!email || !restaurantId) {
      return NextResponse.json({ error: "Email y restaurantId son requeridos" }, { status: 400 });
    }

    // Upsert user
    const user = await prisma.qRUser.upsert({
      where: { email },
      update: {
        ...(name && { name }),
        ...(birthDate && { birthDate: new Date(birthDate) }),
        ...(dietType && { dietType }),
        ...(restrictions && { restrictions }),
      },
      create: {
        email,
        name: name || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        dietType: dietType || null,
        restrictions: restrictions || [],
      },
    });

    // Generate magic token
    const token = await prisma.qRMagicToken.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Get restaurant name
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });

    // Send verification email
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://quierocomer.cl"}/api/qr/user/verify?token=${token.token}`;
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: process.env.FROM_EMAIL || "QuieroComer <noreply@quierocomer.cl>",
            to: email,
            subject: `Confirma tu registro en ${restaurant?.name || "QuieroComer"}`,
            html: `
              <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px 20px">
                <h2 style="color:#0e0e0e;font-size:1.4rem;margin-bottom:8px">${restaurant?.name || "QuieroComer"}</h2>
                <p style="color:#666;font-size:0.95rem;line-height:1.6">Hola ${name || ""}! Confirma tu cuenta tocando el botón:</p>
                <a href="${verifyUrl}" style="display:inline-block;background:#F4A623;color:#0e0e0e;text-decoration:none;padding:14px 28px;border-radius:50px;font-weight:700;font-size:0.95rem;margin:20px 0">Confirmar mi cuenta</a>
                <p style="color:#999;font-size:0.8rem">Este link expira en 7 días.</p>
              </div>
            `,
          }),
        });
      } catch (e) {
        console.error("Email send error:", e);
      }
    }

    // Record interaction
    await prisma.qRUserInteraction.create({
      data: {
        userId: user.id,
        restaurantId,
        type: `${source || "unknown"}_CONVERTED`,
        bannerVariantId: bannerVariantId || null,
      },
    });

    return NextResponse.json({ ok: true, message: "Revisa tu correo" });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Error al registrar" }, { status: 500 });
  }
}
