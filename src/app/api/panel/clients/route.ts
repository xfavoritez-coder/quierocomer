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

    // Get all QRUsers who interacted with this restaurant
    const interactions = await prisma.qRUserInteraction.findMany({
      where: { restaurantId },
      select: {
        type: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            birthDate: true,
            dietType: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Deduplicate by user ID, keep first interaction (most recent)
    const seen = new Set<string>();
    const clients: {
      id: string;
      name: string | null;
      email: string;
      birthDate: string | null;
      dietType: string | null;
      registeredAt: string;
      source: string;
    }[] = [];

    for (const i of interactions) {
      if (!i.user || seen.has(i.user.id)) continue;
      seen.add(i.user.id);
      clients.push({
        id: i.user.id,
        name: i.user.name,
        email: i.user.email,
        birthDate: i.user.birthDate?.toISOString() || null,
        dietType: i.user.dietType,
        registeredAt: i.user.createdAt.toISOString(),
        source: i.type.replace("_CONVERTED", ""),
      });
    }

    // Also get users from sessions (linked via qrUserId)
    const sessionUsers = await prisma.session.findMany({
      where: { restaurantId, qrUserId: { not: null } },
      select: {
        qrUser: {
          select: { id: true, name: true, email: true, birthDate: true, dietType: true, createdAt: true },
        },
      },
      distinct: ["qrUserId"],
      orderBy: { startedAt: "desc" },
    });

    for (const s of sessionUsers) {
      if (!s.qrUser || seen.has(s.qrUser.id)) continue;
      seen.add(s.qrUser.id);
      clients.push({
        id: s.qrUser.id,
        name: s.qrUser.name,
        email: s.qrUser.email,
        birthDate: s.qrUser.birthDate?.toISOString() || null,
        dietType: s.qrUser.dietType,
        registeredAt: s.qrUser.createdAt.toISOString(),
        source: "session",
      });
    }

    // Sort by registeredAt desc
    clients.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());

    return NextResponse.json({ clients, total: clients.length });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Panel clients]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
