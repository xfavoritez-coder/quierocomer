import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { detectGender } from "@/lib/detectGender";

/** GET: get active experience for a restaurant + check if guest already did it */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const guestId = req.nextUrl.searchParams.get("guestId");
  if (!restaurantId) return NextResponse.json({ experience: null });

  const exp = await prisma.experience.findUnique({
    where: { restaurantId },
    include: {
      template: { select: { name: true, slug: true, description: true, accentColor: true, iconEmoji: true, theme: true } },
    },
  });

  if (!exp || !exp.isActive) return NextResponse.json({ experience: null });

  // Check if this guest/user already completed the experience
  const cookieStore = await cookies();
  const userId = cookieStore.get("qr_user_id")?.value;

  let previousResult: { resultName: string; resultTraits: string[]; userName: string } | null = null;

  // Try by qrUserId first (works cross-device), then fall back to guestId
  const lastSub = await prisma.experienceSubmission.findFirst({
    where: {
      experienceId: exp.id,
      OR: [
        ...(userId ? [{ qrUserId: userId }] : []),
        ...(guestId ? [{ guestId }] : []),
      ],
    },
    orderBy: { submittedAt: "desc" },
    select: { userName: true, assignedResult: { select: { name: true, traits: true } } },
  });
  if (lastSub?.assignedResult) {
    previousResult = { resultName: lastSub.assignedResult.name, resultTraits: lastSub.assignedResult.traits, userName: lastSub.userName };
  }

  return NextResponse.json({
    experience: {
      id: exp.id,
      name: exp.template.name,
      slug: exp.template.slug,
      description: exp.template.description,
      accentColor: exp.template.accentColor,
      iconEmoji: exp.template.iconEmoji,
      theme: exp.template.theme,
    },
    previousResult,
  });
}

/** POST: submit experience form */
export async function POST(req: NextRequest) {
  try {
    const { experienceId, guestId, userName, birthDate, email, registerMe } = await req.json();
    if (!experienceId || !userName || !birthDate || !email) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const qrUserId = cookieStore.get("qr_user_id")?.value || null;

    // Get experience + results for matching
    const exp = await prisma.experience.findUnique({
      where: { id: experienceId },
      include: { template: { include: { results: { orderBy: { position: "asc" } } } } },
    });
    if (!exp) return NextResponse.json({ error: "Experience not found" }, { status: 404 });

    // Get guest preferences
    let preferences: any = null;
    if (guestId) {
      const guest = await prisma.guestProfile.findUnique({ where: { id: guestId }, select: { preferences: true } });
      preferences = guest?.preferences;
    }

    // Quick match — score each result with gender detection
    const bd = new Date(birthDate);
    const birthMonth = bd.getMonth() + 1;
    const diet = preferences?.dietType || null;
    const restrictions = preferences?.restrictions || [];
    const userGender = detectGender(userName);

    let bestResult = exp.template.results[0];
    let bestScore = -1;

    for (const result of exp.template.results) {
      let score = 0;
      const criteria = result.matchCriteria as any;
      if (!criteria) { score = Math.random() * 5; }
      else {
        if (criteria.birthMonths?.includes(birthMonth)) score += 10;
        if (criteria.dietTypes?.includes(diet)) score += 8;
        if (criteria.hungerLevel) score += 3;
        if (criteria.ingredients) score += Math.random() * 5;
        if (criteria.isSpicy && restrictions.length === 0) score += 3;
      }
      // Gender matching: strong boost if gender matches, penalty if opposite
      const resultGender = (result as any).gender || "neutral";
      if (resultGender !== "neutral" && userGender !== "neutral") {
        if (resultGender === userGender) score += 15;
        else score -= 10;
      }
      score += Math.random() * 4; // variety
      if (score > bestScore) { bestScore = score; bestResult = result; }
    }

    // Create or update QRUser for the email
    const user = await prisma.qRUser.upsert({
      where: { email },
      update: { name: userName, birthDate: bd },
      create: { email, name: userName, birthDate: bd },
    });

    // Only link guest + set cookie if user opted in to register (first time, own email)
    if (registerMe && guestId) {
      await prisma.guestProfile.updateMany({
        where: { id: guestId, linkedQrUserId: null },
        data: { linkedQrUserId: user.id },
      });

      // Transfer guest preferences to QRUser (diet, restrictions)
      if (preferences) {
        const updateData: any = {};
        if (preferences.dietType) updateData.dietType = preferences.dietType;
        if (preferences.restrictions?.length > 0) updateData.restrictions = preferences.restrictions;
        if (Object.keys(updateData).length > 0) {
          await prisma.qRUser.update({ where: { id: user.id }, data: updateData }).catch(() => {});
        }
      }

      // Backfill sessions with qrUserId
      await prisma.session.updateMany({
        where: { guestId, qrUserId: null },
        data: { qrUserId: user.id },
      }).catch(() => {});

      // Backfill stat events
      await prisma.statEvent.updateMany({
        where: { guestId, qrUserId: null },
        data: { qrUserId: user.id },
      }).catch(() => {});
    }

    const response = NextResponse.json({
      ok: true,
      teaser: { resultName: bestResult.name, resultDescription: bestResult.description, resultTraits: bestResult.traits },
    });

    if (registerMe) {
      response.cookies.set("qr_user_id", user.id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }

    // Create submission
    const sendAfter = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await prisma.experienceSubmission.create({
      data: {
        experienceId,
        guestId: guestId || null,
        qrUserId: user.id,
        userName,
        birthDate: bd,
        email,
        assignedResultId: bestResult.id,
        teaserMsg: `Eres ${bestResult.name}. ${bestResult.description}`,
        status: "pending",
        sendAfter,
      },
    });

    return response;
  } catch (error) {
    console.error("Experience submit error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
