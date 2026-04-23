import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
/** GET — list all favorites for current user/guest */
export async function GET() {
  const cookieStore = await cookies();
  const qrUserId = cookieStore.get("qr_user_id")?.value;
  const guestId = cookieStore.get("quierocomer_guest_id")?.value;

  if (!qrUserId && !guestId) return NextResponse.json({ favorites: [], dishIds: [] });

  const favorites = await prisma.dishFavorite.findMany({
    where: qrUserId ? { qrUserId } : { guestId: guestId! },
    include: { dish: { select: { id: true, name: true, price: true, photos: true, restaurantId: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    favorites,
    dishIds: favorites.map((f) => f.dishId),
    count: favorites.length,
  });
}

/** POST — add a favorite */
export async function POST(request: NextRequest) {
  try {
    const { dishId, restaurantId } = await request.json();
    if (!dishId || !restaurantId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const cookieStore = await cookies();
    const qrUserId = cookieStore.get("qr_user_id")?.value || null;
    const guestId = cookieStore.get("quierocomer_guest_id")?.value || null;

    if (!qrUserId && !guestId) return NextResponse.json({ error: "No identity" }, { status: 400 });

    // Create favorite (upsert-like with try/catch for unique constraint)
    try {
      await prisma.dishFavorite.create({
        data: {
          dishId,
          restaurantId,
          ...(qrUserId ? { qrUserId } : { guestId: guestId! }),
        },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        // Already favorited — no-op
        const count = await prisma.dishFavorite.count({ where: qrUserId ? { qrUserId } : { guestId: guestId! } });
        return NextResponse.json({ success: true, totalFavorites: count, alreadyExists: true });
      }
      throw e;
    }

    const totalFavorites = await prisma.dishFavorite.count({ where: qrUserId ? { qrUserId } : { guestId: guestId! } });

    // Track event (non-blocking)
    prisma.statEvent.create({
      data: {
        eventType: "DISH_FAVORITED",
        dishId,
        restaurantId,
        sessionId: guestId || qrUserId || "",
        guestId,
        qrUserId,
        metadata: { favorites_count_after: totalFavorites },
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, totalFavorites });
  } catch (error) {
    console.error("Favorite add error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/** DELETE — remove a favorite by dishId (query param) */
export async function DELETE(request: NextRequest) {
  try {
    const dishId = request.nextUrl.searchParams.get("dishId");
    if (!dishId) return NextResponse.json({ error: "Missing dishId" }, { status: 400 });

    const cookieStore = await cookies();
    const qrUserId = cookieStore.get("qr_user_id")?.value || null;
    const guestId = cookieStore.get("quierocomer_guest_id")?.value || null;

    if (!qrUserId && !guestId) return NextResponse.json({ error: "No identity" }, { status: 400 });

    await prisma.dishFavorite.deleteMany({
      where: { dishId, ...(qrUserId ? { qrUserId } : { guestId: guestId! }) },
    });

    const totalFavorites = await prisma.dishFavorite.count({ where: qrUserId ? { qrUserId } : { guestId: guestId! } });

    // Track event (non-blocking)
    prisma.statEvent.create({
      data: {
        eventType: "DISH_UNFAVORITED",
        dishId,
        restaurantId: "",
        sessionId: guestId || qrUserId || "",
        guestId,
        qrUserId,
        metadata: { favorites_count_after: totalFavorites },
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, totalFavorites });
  } catch (error) {
    console.error("Favorite remove error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
