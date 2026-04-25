import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse, isSuperAdmin } from "@/lib/adminAuth";

const OWNER_EDITABLE_FIELDS = [
  "name", "description", "logoUrl", "bannerUrl",
  "phone", "whatsapp", "address",
  "instagram", "website", "scheduleJson",
  "waiterPanelActive",
];

function pickFields(body: Record<string, any>, allowed: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) result[key] = body[key];
  }
  return result;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const { id } = await params;

  try {
    await assertOwnsRestaurant(req, id);
  } catch (e: any) {
    return authErrorResponse(e);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      categories: { orderBy: { position: "asc" }, select: { id: true, name: true, position: true, isActive: true } },
      _count: { select: { dishes: true, statEvents: true, sessions: true, waiterCalls: true } },
    },
  });
  if (!restaurant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(restaurant);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const { id } = await params;

  try {
    await assertOwnsRestaurant(req, id);
    const body = await req.json();

    // Filter fields based on role
    let data: Record<string, any>;
    if (isSuperAdmin(req)) {
      // Superadmin can edit everything
      data = {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.slug !== undefined && { slug: body.slug }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
        ...(body.bannerUrl !== undefined && { bannerUrl: body.bannerUrl }),
        ...(body.cartaTheme !== undefined && { cartaTheme: body.cartaTheme }),
        ...(body.defaultView !== undefined && { defaultView: body.defaultView || null }),
        ...(body.qrActivatedAt !== undefined && { qrActivatedAt: body.qrActivatedAt ? new Date(body.qrActivatedAt) : null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.ownerId !== undefined && { ownerId: body.ownerId || null }),
        ...(body.instagram !== undefined && { instagram: body.instagram }),
        ...(body.website !== undefined && { website: body.website }),
        ...(body.whatsapp !== undefined && { whatsapp: body.whatsapp }),
        ...(body.scheduleJson !== undefined && { scheduleJson: body.scheduleJson }),
        ...(body.waiterPanelActive !== undefined && { waiterPanelActive: body.waiterPanelActive }),
      };
    } else {
      // Owner: silently filter to allowed fields only
      data = pickFields(body, OWNER_EDITABLE_FIELDS);
    }

    const restaurant = await prisma.restaurant.update({ where: { id }, data });
    return NextResponse.json(restaurant);
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("[Admin restaurant PUT]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const { id } = await params;

  try {
    if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    // Delete all related data in order
    await prisma.dishImpression.deleteMany({ where: { session: { restaurantId: id } } });
    await prisma.dishFavorite.deleteMany({ where: { restaurantId: id } });
    await prisma.review.deleteMany({ where: { dish: { restaurantId: id } } });
    await prisma.dishIngredient.deleteMany({ where: { dish: { restaurantId: id } } });
    await prisma.dishTranslation.deleteMany({ where: { dish: { restaurantId: id } } });
    await prisma.modifierTemplateOption.deleteMany({ where: { group: { template: { restaurantId: id } } } });
    await prisma.modifierTemplateGroup.deleteMany({ where: { template: { restaurantId: id } } });
    await prisma.modifierTemplate.deleteMany({ where: { restaurantId: id } });
    await prisma.dish.deleteMany({ where: { restaurantId: id } });
    await prisma.category.deleteMany({ where: { restaurantId: id } });
    await prisma.waiterCall.deleteMany({ where: { restaurantId: id } });
    await prisma.waiterPushSubscription.deleteMany({ where: { restaurantId: id } });
    await prisma.statEvent.deleteMany({ where: { restaurantId: id } });
    await prisma.session.deleteMany({ where: { restaurantId: id } });
    await prisma.promotion.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurantScheduleRule.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurantTable.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurant.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[Admin restaurant DELETE]", e);
    return NextResponse.json({ error: e.message || "Error al eliminar" }, { status: 500 });
  }
}
