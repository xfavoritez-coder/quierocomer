import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/qr/owner-token
 * Body: { slug: string, token: string }
 *
 * Validates the ownerViewToken for a restaurant.
 * If valid and unused → returns { valid: true, restaurantName, logoUrl }
 * If invalid or already used → returns { valid: false }
 * Does NOT consume the token — token is consumed when the owner clicks into the panel.
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
      select: { id: true, slug: true, name: true, logoUrl: true },
    });

    if (!restaurant) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true, restaurantName: restaurant.name, logoUrl: restaurant.logoUrl });
  } catch (err) {
    console.error("[owner-token] Error:", err);
    return NextResponse.json({ valid: false });
  }
}
