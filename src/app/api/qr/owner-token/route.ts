import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/qr/owner-token
 * Body: { slug: string, token: string }
 *
 * Validates the ownerViewToken for a restaurant.
 * If valid and unused → marks as used, returns { valid: true, panelUrl: string }
 * If invalid or already used → returns { valid: false }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, token } = body as { slug?: string; token?: string };

    if (!slug || !token) {
      return NextResponse.json({ valid: false });
    }

    // Find restaurant where slug + ownerViewToken match and token hasn't been used yet
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        slug,
        ownerViewToken: token,
        ownerViewTokenUsedAt: null,
      },
      select: { id: true, slug: true },
    });

    if (!restaurant) {
      return NextResponse.json({ valid: false });
    }

    // Mark token as used
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { ownerViewTokenUsedAt: new Date() },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
    const panelUrl = `${baseUrl}/api/panel/demo-auth?slug=${slug}`;

    return NextResponse.json({ valid: true, panelUrl });
  } catch (err) {
    console.error("[owner-token] Error:", err);
    return NextResponse.json({ valid: false });
  }
}
