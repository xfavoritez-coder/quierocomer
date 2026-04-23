import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const magicToken = await prisma.qRMagicToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!magicToken) {
      return new NextResponse("Link inválido o expirado", { status: 404 });
    }

    if (magicToken.expiresAt < new Date()) {
      return new NextResponse("Este link ha expirado", { status: 410 });
    }

    if (magicToken.usedAt) {
      // Already verified — still redirect gracefully
    } else {
      // Mark as used + verify user
      await prisma.qRMagicToken.update({
        where: { id: magicToken.id },
        data: { usedAt: new Date() },
      });
      await prisma.qRUser.update({
        where: { id: magicToken.userId },
        data: { verifiedAt: new Date() },
      });
    }

    // Find the restaurant slug from user's latest interaction
    const lastInteraction = await prisma.qRUserInteraction.findFirst({
      where: { userId: magicToken.userId },
      orderBy: { createdAt: "desc" },
      include: { restaurant: { select: { slug: true } } },
    });

    const slug = lastInteraction?.restaurant?.slug || null;
    const redirectUrl = slug ? `/qr/${slug}?verified=1` : "/qr?verified=1";

    const response = NextResponse.redirect(new URL(redirectUrl, request.url));
    response.cookies.set("qr_user_id", magicToken.userId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 year
    });

    return response;
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json({ error: "Error al verificar" }, { status: 500 });
  }
}
