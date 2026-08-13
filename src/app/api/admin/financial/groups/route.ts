import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

// PUT: renombrar un grupo (actualiza todas las categorías del grupo)
// Body: { restaurantId, oldName, newName }
export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { restaurantId, oldName, newName } = body;
  if (!restaurantId || !oldName || !newName?.trim()) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const result = await prisma.financialCategory.updateMany({
    where: { restaurantId, group: oldName },
    data: { group: newName.trim() },
  });
  return NextResponse.json({ updated: result.count });
}

// DELETE: disolver un grupo (mueve sus categorías a sin grupo)
// Body: { restaurantId, groupName }
export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { restaurantId, groupName } = body;
  if (!restaurantId || !groupName) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const result = await prisma.financialCategory.updateMany({
    where: { restaurantId, group: groupName },
    data: { group: null },
  });
  return NextResponse.json({ updated: result.count });
}
