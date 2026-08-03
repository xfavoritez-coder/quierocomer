import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, newPrivateReviewEmailHtml } from "@/lib/email/sendAdminEmail";

const BASE_URL = "https://quierocomer.com";

export async function POST(req: NextRequest) {
  let body: { restaurantId?: string; rating?: number; comment?: string | null; authorName?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, rating, comment, authorName } = body;
  if (!restaurantId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Only allow if restaurant has private mode
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      reviewMode: true,
      name: true,
      slug: true,
      owner: { select: { name: true, email: true } },
    },
  });
  if (!restaurant || restaurant.reviewMode !== "private") {
    return NextResponse.json({ error: "No disponible" }, { status: 403 });
  }

  await prisma.privateReview.create({
    data: { restaurantId, rating, comment: comment || null, authorName: authorName || null },
  });

  // Notify owner by email (fire-and-forget)
  if (restaurant.owner?.email) {
    const panelLink = `${BASE_URL}/panel/valoraciones/resenas`;
    sendAdminEmail({
      to: restaurant.owner.email,
      subject: `Nueva valoración en ${restaurant.name} — ${rating}/5 ⭐`,
      html: newPrivateReviewEmailHtml({
        ownerName: restaurant.owner.name,
        restaurantName: restaurant.name,
        rating,
        comment,
        authorName,
        panelLink,
      }),
      purpose: "new_private_review",
    }).catch(err => console.error("[resenas] email error:", err));
  }

  return NextResponse.json({ ok: true });
}
