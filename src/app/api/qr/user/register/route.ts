import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackUserRegistration } from "@/lib/qr/userRegistration";
import { adminEmailTemplate } from "@/lib/email/sendAdminEmail";

export async function POST(request: Request) {
  try {
    const { email, name, birthDate, dietType, restrictions, dislikes, restaurantId, source, bannerVariantId, guestId, sessionId } = await request.json();

    if (!email || !name || !restaurantId) {
      return NextResponse.json({ error: "Nombre, email y restaurantId son requeridos" }, { status: 400 });
    }

    // Upsert user
    const user = await prisma.qRUser.upsert({
      where: { email },
      update: {
        ...(name && { name }),
        ...(birthDate && { birthDate: new Date(birthDate) }),
        ...(dietType && { dietType }),
        ...(restrictions && { restrictions }),
        ...(dislikes && { dislikes }),
      },
      create: {
        email,
        name: name || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        dietType: dietType || null,
        restrictions: restrictions || [],
        dislikes: dislikes || [],
      },
    });

    // Merge guest profile with registered user
    if (guestId) {
      // Link GuestProfile to this user
      await prisma.guestProfile.updateMany({
        where: { id: guestId, linkedQrUserId: null },
        data: { linkedQrUserId: user.id },
      });
      // Backfill qrUserId on all StatEvents from this guest
      await prisma.statEvent.updateMany({
        where: { guestId, qrUserId: null },
        data: { qrUserId: user.id },
      });
      // Backfill qrUserId on all Sessions from this guest
      await prisma.session.updateMany({
        where: { guestId, qrUserId: null },
        data: { qrUserId: user.id },
      });
    }

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
            from: process.env.FROM_EMAIL ? `QuieroComer <${process.env.FROM_EMAIL}>` : "QuieroComer <onboarding@resend.dev>",
            to: email,
            subject: `${name || ""}, confirma para recibir tu regalo 🎂`,
            html: adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:16px;text-align:center">¡Último paso, ${name || ""}! 🎂</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:24px;text-align:center">
  Confirma tu correo para recibir tu regalo de cumpleaños en <strong style="color:#FFD600">${restaurant?.name || "tu restaurante favorito"}</strong>
</p>
<div style="text-align:center;margin-bottom:20px">
  <a href="${verifyUrl}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px">
    Confirmar mi correo
  </a>
</div>
<p style="color:#5a4028;font-size:12px;text-align:center;margin-bottom:0">Este link expira en 7 días</p>`),
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

    // Track user registration (unified analytics)
    const triggeredByMap: Record<string, string> = {
      post_genio: "post_genio_capture",
      cta_post_genio: "conversion_cta",
      cta_repeat_dish: "conversion_cta",
      cta_promo_unlock: "conversion_cta",
      birthday_banner: "birthday_banner",
      favorites: "favorites_threshold",
    };
    await trackUserRegistration({
      qrUserId: user.id,
      guestId: guestId || null,
      restaurantId,
      sessionId: sessionId || null,
      triggeredBy: (triggeredByMap[source || ""] || "conversion_cta") as any,
    });

    // Migrate dish favorites from guest to user
    if (guestId) {
      await prisma.dishFavorite.updateMany({
        where: { guestId, qrUserId: null },
        data: { qrUserId: user.id, guestId: null },
      }).catch(() => {});
    }

    // Set cookie for immediate login
    const response = NextResponse.json({ ok: true, userId: user.id, message: "Revisa tu correo" });
    response.cookies.set("qr_user_id", user.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
      sameSite: "lax",
    });
    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Error al registrar" }, { status: 500 });
  }
}
