import { prisma } from "@/lib/prisma";

export interface CompiledProfile {
  dietType: string | null;
  restrictions: string[];
  likedIngredients: Record<string, number>;
  dislikedIngredients: string[];
  viewHistory: { dishId: string; dwellMs: number }[];
  visitCount: number;
  visitedCategoryIds: string[];
  lastSessionDate: Date | null;
}

export async function compileProfile(
  qrUserId: string | null,
  guestId: string | null,
  restaurantId: string
): Promise<CompiledProfile | null> {
  if (!qrUserId && !guestId) return null;

  // Build parallel queries
  const queries: [
    Promise<any | null>,
    Promise<any | null>,
    Promise<any[]>
  ] = [
    qrUserId
      ? prisma.qRUser.findUnique({
          where: { id: qrUserId },
          select: { dietType: true, restrictions: true, dislikes: true },
        })
      : Promise.resolve(null),

    guestId || qrUserId
      ? prisma.guestProfile.findFirst({
          where: qrUserId
            ? { OR: [
                ...(guestId ? [{ id: guestId }] : []),
                { linkedQrUserId: qrUserId },
              ]}
            : { id: guestId! },
          orderBy: { lastSeenAt: "desc" },
          select: {
            favoriteIngredients: true,
            preferences: true,
            visitCount: true,
          },
        })
      : Promise.resolve(null),

    prisma.session.findMany({
      where: {
        restaurantId,
        ...(qrUserId && guestId
          ? { OR: [{ guestId }, { qrUserId }] }
          : qrUserId
          ? { qrUserId }
          : { guestId: guestId! }),
      },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        dishesViewed: true,
        categoriesViewed: true,
        startedAt: true,
      },
    }),
  ];

  const [qrUser, guest, sessions] = await Promise.all(queries);

  // If no data at all, return null
  if (!qrUser && !guest && sessions.length === 0) return null;

  const guestPrefs = (guest?.preferences as any) || {};
  const favIngredients = (guest?.favoriteIngredients as Record<string, number>) || {};

  // Merge: QRUser takes priority over GuestProfile
  const dietType = qrUser?.dietType || guestPrefs.dietType || null;

  const restrictions = [
    ...new Set([
      ...(qrUser?.restrictions || []),
      ...(guestPrefs.restrictions || []),
    ]),
  ];

  const dislikedIngredients = [
    ...new Set([
      ...(qrUser?.dislikes || []),
      ...(guestPrefs.dislikes || []),
    ]),
  ];

  // Flatten viewHistory from sessions, deduplicate keeping max dwellMs
  const viewMap = new Map<string, number>();
  for (const session of sessions) {
    const viewed = (session.dishesViewed as any[]) || [];
    for (const v of viewed) {
      if (v?.dishId) {
        const existing = viewMap.get(v.dishId) || 0;
        viewMap.set(v.dishId, Math.max(existing, v.dwellMs || 0));
      }
    }
  }
  const viewHistory = Array.from(viewMap, ([dishId, dwellMs]) => ({ dishId, dwellMs }));

  // Extract visited category IDs from sessions
  const catSet = new Set<string>();
  for (const session of sessions) {
    const cats = (session.categoriesViewed as any[]) || [];
    for (const c of cats) {
      if (c?.categoryId) catSet.add(c.categoryId);
    }
  }

  const lastSessionDate = sessions.length > 0 ? sessions[0].startedAt : null;

  return {
    dietType,
    restrictions,
    likedIngredients: favIngredients,
    dislikedIngredients,
    viewHistory,
    visitCount: guest?.visitCount || 0,
    visitedCategoryIds: Array.from(catSet),
    lastSessionDate,
  };
}
