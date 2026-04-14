import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getUserId(req: NextRequest): string | null {
  return req.nextUrl.searchParams.get("userId") || req.headers.get("x-user-id");
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const profile = await prisma.userTasteProfile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ onboardingDone: false, dietaryRestrictions: [], fitnessMode: null, riskProfile: "BALANCED", favoriteIngredients: [], avoidIngredients: [] });

  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const { dietaryRestrictions, fitnessMode, riskProfile } = await req.json();

    const data: Record<string, unknown> = {};
    if (dietaryRestrictions !== undefined) data.dietaryRestrictions = dietaryRestrictions;
    if (fitnessMode !== undefined) {
      data.fitnessMode = fitnessMode || null;
      data.fitnessUpdatedAt = new Date();
    }
    if (riskProfile !== undefined) data.riskProfile = riskProfile;

    const profile = await prisma.userTasteProfile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        onboardingDone: true,
        dietaryRestrictions: dietaryRestrictions ?? [],
        fitnessMode: fitnessMode || null,
        fitnessUpdatedAt: fitnessMode ? new Date() : null,
        riskProfile: riskProfile ?? "BALANCED",
        favoriteIngredients: [],
        avoidIngredients: [],
        coldWeatherPrefs: [],
        hotWeatherPrefs: [],
      },
    });

    return NextResponse.json(profile);
  } catch (e) {
    console.error("[Perfil preferencias PUT]", e);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    await prisma.userTasteProfile.update({
      where: { userId },
      data: { favoriteIngredients: [], avoidIngredients: [] },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  }
}
