import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    // Get unique sessions with their latest interaction
    const interactions = await prisma.interaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        action: true,
        sessionId: true,
        userId: true,
        ctxCompany: true,
        ctxHunger: true,
        ctxBudget: true,
        ctxOccasion: true,
        weatherTemp: true,
        weatherCondition: true,
        weatherHumidity: true,
        userLat: true,
        userLng: true,
        hour: true,
        dayOfWeek: true,
        createdAt: true,
        visitId: true,
        menuItem: { select: { nombre: true, categoria: true, imagenUrl: true, ingredients: true, local: { select: { nombre: true } } } },
      },
    });

    // Group by visitId (or sessionId+time window as fallback)
    const sessions: Record<string, { sessionId: string; visitId: string | null; userId: string | null; firstSeen: string; lastSeen: string; actions: typeof interactions; context: any; weather: any; location: any; insight: any }> = {};

    for (const i of interactions) {
      // Use visitId if available, otherwise fallback to sessionId
      const sid = i.visitId || i.sessionId;
      if (!sessions[sid]) {
        sessions[sid] = {
          sessionId: i.sessionId,
          visitId: i.visitId,
          userId: i.userId,
          firstSeen: i.createdAt.toISOString(),
          lastSeen: i.createdAt.toISOString(),
          actions: [],
          context: null,
          weather: null,
          location: null,
          insight: null,
        };
      }
      sessions[sid].actions.push(i);
      if (i.createdAt.toISOString() < sessions[sid].firstSeen) sessions[sid].firstSeen = i.createdAt.toISOString();
      if (i.createdAt.toISOString() > sessions[sid].lastSeen) sessions[sid].lastSeen = i.createdAt.toISOString();

      // Capture context from SELECTED interactions
      if (i.action === "SELECTED" && i.ctxCompany) {
        sessions[sid].context = { ctxCompany: i.ctxCompany, ctxHunger: i.ctxHunger, ctxBudget: i.ctxBudget, ctxOccasion: i.ctxOccasion };
      }
      if (i.weatherTemp != null) {
        sessions[sid].weather = { temp: i.weatherTemp, condition: i.weatherCondition, humidity: i.weatherHumidity };
      }
      if (i.userLat != null) {
        sessions[sid].location = { lat: i.userLat, lng: i.userLng };
      }
    }

    // Generate insights per session
    for (const s of Object.values(sessions)) {
      const selected = s.actions.filter(a => a.action === "SELECTED");
      const viewed = s.actions.filter(a => a.action === "VIEWED");
      const ignored = s.actions.filter(a => a.action === "IGNORED");

      // Categories selected
      const catCounts: Record<string, number> = {};
      const ingCounts: Record<string, number> = {};
      const localCounts: Record<string, number> = {};

      for (const a of selected) {
        catCounts[a.menuItem.categoria] = (catCounts[a.menuItem.categoria] ?? 0) + 1;
        localCounts[a.menuItem.local.nombre] = (localCounts[a.menuItem.local.nombre] ?? 0) + 1;
        for (const ing of a.menuItem.ingredients ?? []) {
          ingCounts[ing] = (ingCounts[ing] ?? 0) + 1;
        }
      }

      const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const topIngs = Object.entries(ingCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
      const topLocal = Object.entries(localCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const selectRate = viewed.length > 0 ? Math.round((selected.length / viewed.length) * 100) : 0;

      // Build readable conclusion
      const conclusions: string[] = [];
      if (topCat) conclusions.push(`Prefiere ${topCat.toLowerCase()}`);
      if (topIngs.length > 0) conclusions.push(`Le gusta: ${topIngs.join(", ")}`);
      if (topLocal) conclusions.push(`Atrae ${topLocal}`);
      if (selectRate > 0) conclusions.push(`Selecciono ${selected.length} de ${viewed.length} platos vistos (${selectRate}%)`);
      if (s.context?.ctxHunger) conclusions.push(`Hambre: ${s.context.ctxHunger}`);
      if (s.context?.ctxCompany) conclusions.push(`Con: ${s.context.ctxCompany}`);

      s.insight = {
        topCategory: topCat,
        topIngredients: topIngs,
        topLocal,
        selectRate,
        totalViewed: viewed.length,
        totalSelected: selected.length,
        totalIgnored: ignored.length,
        conclusion: conclusions.join(" · "),
      };
    }

    const sessionList = Object.values(sessions).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

    // Stats
    const totalInteractions = await prisma.interaction.count();
    const totalProfiles = await prisma.userTasteProfile.count();
    const totalRatings = await prisma.dishRating.count();
    const actionCounts = await prisma.interaction.groupBy({ by: ["action"], _count: true });

    return NextResponse.json({
      stats: { totalInteractions, totalSessions: sessionList.length, totalProfiles, totalRatings, actionCounts },
      sessions: sessionList,
    });
  } catch (e) {
    console.error("[Admin genie]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
