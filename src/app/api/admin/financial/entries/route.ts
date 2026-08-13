import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const month = req.nextUrl.searchParams.get("month"); // "2026-08"
  if (!restaurantId || !month) return NextResponse.json({ error: "restaurantId y month requeridos" }, { status: 400 });
  try {
    await assertOwnsRestaurant(req, restaurantId);
  } catch (e: any) { return authErrorResponse(e); }

  const [year, mon] = month.split("-").map(Number);
  const from = new Date(year, mon - 1, 1);
  const to = new Date(year, mon, 1);

  const entries = await prisma.financialEntry.findMany({
    where: { restaurantId, date: { gte: from, lt: to } },
    include: { category: { select: { id: true, name: true, type: true, color: true, icon: true } } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { restaurantId, categoryId, amount, type, date, description } = body;
  if (!restaurantId || !categoryId || !amount || !type || !date) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }
  try {
    await assertOwnsRestaurant(req, restaurantId);
  } catch (e: any) { return authErrorResponse(e); }

  const entry = await prisma.financialEntry.create({
    data: {
      restaurantId,
      categoryId,
      amount: Math.round(Math.abs(amount)),
      type,
      date: new Date(date),
      description: description?.trim() || null,
      source: "MANUAL",
    },
    include: { category: { select: { id: true, name: true, type: true, color: true, icon: true } } },
  });
  return NextResponse.json(entry);
}

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { id, restaurantId } = body;
  if (!id || !restaurantId) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try {
    await assertOwnsRestaurant(req, restaurantId);
  } catch (e: any) { return authErrorResponse(e); }

  await prisma.financialEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
