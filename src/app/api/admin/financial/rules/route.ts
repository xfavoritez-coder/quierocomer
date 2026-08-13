import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const rules = await prisma.categorizationRule.findMany({
    where: { restaurantId },
    orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }],
    include: { splits: { select: { categoryId: true, ratio: true, label: true } } },
  });

  return NextResponse.json(rules);
}

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { id, restaurantId } = body;
  if (!id || !restaurantId) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  await prisma.categorizationRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
