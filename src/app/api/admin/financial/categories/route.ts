import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  try {
    await assertOwnsRestaurant(req, restaurantId);
  } catch (e: any) { return authErrorResponse(e); }

  const all = req.nextUrl.searchParams.get("all") === "true";
  const categories = await prisma.financialCategory.findMany({
    where: { restaurantId, ...(all ? {} : { isActive: true }) },
    orderBy: [{ type: "asc" }, { group: "asc" }, { position: "asc" }],
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { restaurantId, name, type, color, icon } = body;
  if (!restaurantId || !name || !type) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try {
    await assertOwnsRestaurant(req, restaurantId);
  } catch (e: any) { return authErrorResponse(e); }

  const last = await prisma.financialCategory.findFirst({
    where: { restaurantId, type },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const category = await prisma.financialCategory.create({
    data: { restaurantId, name: name.trim(), type, color: color || null, icon: icon || null, position: (last?.position ?? -1) + 1 },
  });
  return NextResponse.json(category);
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { id, restaurantId, name, color, icon, position, isActive, group } = body;
  if (!id || !restaurantId) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try {
    await assertOwnsRestaurant(req, restaurantId);
  } catch (e: any) { return authErrorResponse(e); }

  const category = await prisma.financialCategory.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(color !== undefined && { color }),
      ...(icon !== undefined && { icon }),
      ...(position !== undefined && { position }),
      ...(isActive !== undefined && { isActive }),
      ...(group !== undefined && { group: group || null }),
    },
  });
  return NextResponse.json(category);
}
