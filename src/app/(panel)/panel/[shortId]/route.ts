import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPanelMagicToken } from "@/lib/magicLink";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

/**
 * GET /panel/[shortId]
 * Resuelve un link corto de acceso al panel (ej: quierocomer.com/panel/1)
 * y redirige al owner autenticado a su panel.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await params;
  const id = parseInt(shortId, 10);

  if (isNaN(id)) {
    return NextResponse.redirect(new URL("/panel/login", BASE));
  }

  const link = await prisma.panelShortLink.findUnique({ where: { id } });
  if (!link) {
    return NextResponse.redirect(new URL("/panel/login?error=invalid", BASE));
  }

  const token = createPanelMagicToken(link.ownerId);
  return NextResponse.redirect(
    new URL(`/api/panel/magic-entry?t=${token}&r=/panel`, BASE),
  );
}
