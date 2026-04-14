import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "@/lib/genie-recommendations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { selectedDishIds, ctxCompany, ctxHunger, ctxBudget, ctxOccasion, userLat, userLng, userId, sessionId, weatherTemp, weatherCondition } = body;

    if (!selectedDishIds?.length) {
      return NextResponse.json({ error: "Selecciona al menos un plato" }, { status: 400 });
    }

    const recommendations = await getRecommendations(
      { selectedDishIds, ctxCompany, ctxHunger, ctxBudget, ctxOccasion, userLat, userLng, weatherTemp, weatherCondition },
      userId,
      sessionId,
    );

    return NextResponse.json(recommendations);
  } catch (e) {
    console.error("[Genie recommend]", e);
    return NextResponse.json({ error: "Error al generar recomendaciones" }, { status: 500 });
  }
}
