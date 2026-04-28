import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

/** GET — list announcements for a restaurant */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const announcements = await prisma.announcement.findMany({
      where: { restaurantId },
      orderBy: { position: "asc" },
    });

    return NextResponse.json({ announcements });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/** POST — create announcement (max 3 per restaurant) */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, text, linkUrl, daysOfWeek, startDate, endDate } = await req.json();
    if (!restaurantId || !text?.trim()) return NextResponse.json({ error: "restaurantId y texto requeridos" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const count = await prisma.announcement.count({ where: { restaurantId } });
    if (count >= 3) return NextResponse.json({ error: "Máximo 3 anuncios por local" }, { status: 400 });

    const announcement = await prisma.announcement.create({
      data: {
        restaurantId,
        text: text.trim(),
        linkUrl: linkUrl?.trim() || null,
        daysOfWeek: daysOfWeek || [],
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        position: count,
      },
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/** PATCH — update announcement */
export async function PATCH(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id, text, linkUrl, daysOfWeek, startDate, endDate, isActive } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.announcement.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    await requireRestaurantForOwner(req, existing.restaurantId);

    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        ...(text !== undefined && { text: text.trim() }),
        ...(linkUrl !== undefined && { linkUrl: linkUrl?.trim() || null }),
        ...(daysOfWeek !== undefined && { daysOfWeek }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/** DELETE — remove announcement */
export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.announcement.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    await requireRestaurantForOwner(req, existing.restaurantId);

    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
