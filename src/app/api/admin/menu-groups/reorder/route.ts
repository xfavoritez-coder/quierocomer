import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, ids } = await req.json();
    if (!restaurantId || !Array.isArray(ids)) {
      return NextResponse.json({ error: "restaurantId y ids requeridos" }, { status: 400 });
    }

    await requireRestaurantForOwner(req, restaurantId);

    await Promise.all(
      ids.map((id: string, i: number) =>
        prisma.menuGroup.update({ where: { id }, data: { position: i } }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[menu-groups/reorder] error:", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}
