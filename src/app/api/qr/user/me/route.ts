import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("qr_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.qRUser.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, birthDate: true,
      dietType: true, restrictions: true, dislikes: true,
    },
  });

  if (!user) return NextResponse.json({ user: null });

  // Visited restaurants from Session (more complete than QRUserInteraction)
  const sessions = await prisma.session.findMany({
    where: { qrUserId: userId },
    select: { restaurantId: true, startedAt: true, restaurant: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    orderBy: { startedAt: "desc" },
  });

  const seen = new Set<string>();
  const visitedRestaurants = sessions
    .filter((s) => { if (seen.has(s.restaurantId)) return false; seen.add(s.restaurantId); return true; })
    .map((s) => ({ restaurant: s.restaurant, lastVisit: s.startedAt, visitCount: sessions.filter((x) => x.restaurantId === s.restaurantId).length }));

  // Favorite ingredients from linked GuestProfile
  const guest = await prisma.guestProfile.findFirst({
    where: { linkedQrUserId: userId },
    select: { favoriteIngredients: true },
    orderBy: { lastSeenAt: "desc" },
  });

  const favoriteIngredients = guest?.favoriteIngredients as Record<string, number> | null;
  // Top 10 ingredients sorted by score
  const topIngredients = favoriteIngredients
    ? Object.entries(favoriteIngredients).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name]) => name)
    : [];

  // Experience results
  const experienceResults = await prisma.experienceSubmission.findMany({
    where: { qrUserId: userId },
    orderBy: { submittedAt: "desc" },
    select: {
      userName: true,
      submittedAt: true,
      assignedResult: { select: { name: true, traits: true, description: true } },
      experience: { include: { template: { select: { name: true, iconEmoji: true, accentColor: true } } } },
    },
  });

  // Deduplicate by experience (keep latest per experience)
  const seenExp = new Set<string>();
  const experiences = experienceResults
    .filter((e) => { if (seenExp.has(e.experience.id)) return false; seenExp.add(e.experience.id); return true; })
    .map((e) => ({
      experienceName: e.experience.template.name,
      iconEmoji: e.experience.template.iconEmoji,
      accentColor: e.experience.template.accentColor,
      resultName: e.assignedResult?.name || "",
      resultTraits: e.assignedResult?.traits || [],
      date: e.submittedAt,
    }));

  return NextResponse.json({ user, visitedRestaurants, topIngredients, experiences });
}
