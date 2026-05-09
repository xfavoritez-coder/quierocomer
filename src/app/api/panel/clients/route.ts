import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    // Read from RestaurantClient (active only)
    const records = await prisma.restaurantClient.findMany({
      where: { restaurantId, isActive: true },
      include: {
        qrUser: {
          select: { id: true, name: true, email: true, birthDate: true, dietType: true, createdAt: true },
        },
      },
      orderBy: { registeredAt: "desc" },
    });

    const clients = records
      .filter(r => r.qrUser)
      .map(r => ({
        id: r.qrUser.id,
        name: r.qrUser.name,
        email: r.qrUser.email,
        birthDate: r.qrUser.birthDate?.toISOString() || null,
        dietType: r.qrUser.dietType,
        registeredAt: r.registeredAt.toISOString(),
        source: r.source,
      }));

    return NextResponse.json({ clients, total: clients.length });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Panel clients]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
