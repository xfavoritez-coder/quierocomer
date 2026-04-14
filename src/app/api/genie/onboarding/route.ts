import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ onboardingDone: false });

  const profile = await prisma.userTasteProfile.findUnique({
    where: { userId },
    select: { onboardingDone: true, dietaryRestrictions: true, fitnessMode: true },
  });

  return NextResponse.json(profile ?? { onboardingDone: false });
}

export async function POST(req: NextRequest) {
  try {
    const { userId, sessionId, dietaryRestrictions, fitnessMode } = await req.json();
    if (!userId && !sessionId) {
      return NextResponse.json({ error: "userId o sessionId requerido" }, { status: 400 });
    }

    if (userId) {
      await prisma.userTasteProfile.upsert({
        where: { userId },
        update: {
          dietaryRestrictions: dietaryRestrictions ?? [],
          fitnessMode: fitnessMode || null,
          fitnessUpdatedAt: fitnessMode ? new Date() : undefined,
          onboardingDone: true,
        },
        create: {
          userId,
          sessionId,
          dietaryRestrictions: dietaryRestrictions ?? [],
          fitnessMode: fitnessMode || null,
          fitnessUpdatedAt: fitnessMode ? new Date() : undefined,
          onboardingDone: true,
          favoriteIngredients: [],
          avoidIngredients: [],
          coldWeatherPrefs: [],
          hotWeatherPrefs: [],
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Genie onboarding]", e);
    return NextResponse.json({ error: "Error al guardar onboarding" }, { status: 500 });
  }
}
