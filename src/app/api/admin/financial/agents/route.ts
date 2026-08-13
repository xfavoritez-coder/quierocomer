import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const agents = await prisma.cashAgent.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { restaurantId, name, bankPatterns } = body;
  if (!restaurantId || !name) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const agent = await prisma.cashAgent.create({
    data: {
      restaurantId,
      name: name.trim(),
      bankPatterns: (bankPatterns || []).map((p: string) => p.trim()).filter(Boolean),
    },
  });
  return NextResponse.json(agent, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { id, restaurantId, name, bankPatterns, isActive } = body;
  if (!id || !restaurantId) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const updated = await prisma.cashAgent.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(bankPatterns !== undefined && {
        bankPatterns: bankPatterns.map((p: string) => p.trim()).filter(Boolean),
      }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { id, restaurantId } = body;
  if (!id || !restaurantId) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  await prisma.cashAgent.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
