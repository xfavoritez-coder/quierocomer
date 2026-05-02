import { NextRequest, NextResponse } from "next/server";
import {
  checkAdminAuth,
  requireRestaurantForOwner,
  authErrorResponse,
} from "@/lib/adminAuth";
import { getVisitorMetrics, getFunnelConversion, getFailedSearches, getGenioImpact, getAverageTicketByWeek, getPersonalizationMetrics, getTopAttentionDishes, getLeastViewedDishes, getClientesAnalytics, getTopCategoriesByDwell } from "@/lib/admin/analyticsQueries";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const type = req.nextUrl.searchParams.get("type") || "metrics";
    const restaurantIdParam = req.nextUrl.searchParams.get("restaurantId") || null;
    const fromStr = req.nextUrl.searchParams.get("from");
    const toStr = req.nextUrl.searchParams.get("to");

    // OWNER must provide restaurantId; SUPERADMIN can pass null for global
    const restaurantId = await requireRestaurantForOwner(req, restaurantIdParam);

    const to = toStr ? new Date(toStr + "T23:59:59.999Z") : new Date();
    const from = fromStr ? new Date(fromStr + "T00:00:00.000Z") : new Date(to.getTime() - 28 * 24 * 60 * 60 * 1000);

    if (type === "metrics") {
      const data = await getVisitorMetrics(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "funnel") {
      const data = await getFunnelConversion(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "searches") {
      const data = await getFailedSearches(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "genio") {
      const data = await getGenioImpact(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "clientes") {
      const data = await getClientesAnalytics(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "personalization") {
      const data = await getPersonalizationMetrics(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "attention" || type === "dishes") {
      const data = await getTopAttentionDishes(restaurantId, from, to);
      if (type === "dishes") {
        // Reshape for the Platos tab
        const dishes = data.dishes || [];
        const byViews = [...dishes].sort((a: any, b: any) => b.uniqueSessions - a.uniqueSessions).slice(0, 10).map((d: any) => ({ name: d.name, photo: d.photo, count: d.uniqueSessions }));
        const byDetail = [...dishes]
          .filter((d: any) => d.opens > 0 && d.avgDetailMs >= 1000)
          .sort((a: any, b: any) => b.avgDetailMs - a.avgDetailMs)
          .slice(0, 10)
          .map((d: any) => ({ name: d.name, photo: d.photo, count: Math.round(d.avgDetailMs / 1000) + "s" }));
        const [leastViewed, topCategories] = await Promise.all([
          getLeastViewedDishes(restaurantId, from, to),
          getTopCategoriesByDwell(restaurantId, from, to),
        ]);
        return NextResponse.json({ mostViewed: byViews, mostDetailed: byDetail, leastViewed, topCategories });
      }
      return NextResponse.json(data);
    }
    if (type === "ticket-trend" && restaurantId) {
      const weeks = parseInt(req.nextUrl.searchParams.get("weeks") || "12");
      const data = await getAverageTicketByWeek(restaurantId, weeks);
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Analytics]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
