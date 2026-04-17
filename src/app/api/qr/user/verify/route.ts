import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
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
    return new NextResponse("Ya verificado. Puedes cerrar esta página.", { status: 200 });
  }

  // Mark as used
  await prisma.qRMagicToken.update({
    where: { id: magicToken.id },
    data: { usedAt: new Date() },
  });

  // Set cookie and redirect
  const response = NextResponse.redirect(new URL("/qr?verified=true", request.url));
  response.cookies.set("qr_user_id", magicToken.userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return response;
}
