import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, categoryIds } = await req.json();
    if (!restaurantId || !categoryIds?.length) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

    await assertOwnsRestaurant(req, restaurantId);

    const updates = categoryIds.map((id: string, index: number) =>
      prisma.category.update({ where: { id }, data: { position: index } })
    );
    await prisma.$transaction(updates);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Categories reorder]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
