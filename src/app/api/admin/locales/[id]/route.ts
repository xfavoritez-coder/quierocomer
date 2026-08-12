import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse, isSuperAdmin } from "@/lib/adminAuth";
import crypto from "crypto";
import { extractCommune } from "@/lib/communeUtils";

const OWNER_EDITABLE_FIELDS = [
  "name", "description", "logoUrl", "bannerUrl",
  "phone", "whatsapp", "address",
  "instagram", "website", "scheduleJson",
  "waiterPanelActive",
  "showCategoryLobby",
  "birthdayPerk",
  "cartaColorMode",
  "cartaAccentColor",
  "sectionTitleMenu",
  "sectionTitleRecomendados",
  "sectionTitleCraving",
  "allPhotosReferential",
  "defaultView",
  "weeklyEmailEnabled",
  "genioFabEnabled",
  "multiMenuEnabled",
  "mpPayerEmail",
  // Datos de facturacion (los maneja el dueño desde /panel/facturacion)
  "billingCompanyName", "billingRut", "billingGiro",
  "billingAddress", "billingCity", "billingEmail",
  "billingContactName", "billingPhone",
  // Pedidos online
  "orderingEnabled", "orderingPhone", "orderingDelivery",
  "orderingMinAmount", "orderingWaitTime", "orderingNote",
  "orderingPaymentMethods", "orderingMode",
  "orderingBannerUrl", "orderingTheme", "orderingAccentColor",
  "orderingBusinessHours",
  "filterBarEnabled",
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
      owner: { select: { id: true, name: true, email: true, whatsapp: true } },
      categories: { orderBy: { position: "asc" }, select: { id: true, name: true, position: true, isActive: true } },
      _count: { select: { dishes: true, statEvents: true, sessions: true, waiterCalls: true, categories: true } },
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
        ...(body.showCategoryLobby !== undefined && { showCategoryLobby: body.showCategoryLobby }),
        ...(body.cartaColorMode !== undefined && { cartaColorMode: body.cartaColorMode }),
        ...(body.cartaAccentColor !== undefined && { cartaAccentColor: body.cartaAccentColor }),
        ...(body.allPhotosReferential !== undefined && { allPhotosReferential: body.allPhotosReferential }),
        ...(body.birthdayPerk !== undefined && { birthdayPerk: body.birthdayPerk }),
        ...(body.dietType !== undefined && { dietType: body.dietType }),
        ...(body.enabledLangs !== undefined && { enabledLangs: body.enabledLangs }),
        ...(body.plan !== undefined && { plan: body.plan }),
        ...(body.billingExempt !== undefined && { billingExempt: body.billingExempt }),
        ...(body.mpPayerEmail !== undefined && { mpPayerEmail: body.mpPayerEmail || null }),
        // Toteat POS integration fields (super-admin only)
        ...(body.toteatRestaurantId !== undefined && { toteatRestaurantId: body.toteatRestaurantId || null }),
        ...(body.toteatLocalId !== undefined && { toteatLocalId: body.toteatLocalId === null || body.toteatLocalId === "" ? null : Number(body.toteatLocalId) }),
        ...(body.toteatUserId !== undefined && { toteatUserId: body.toteatUserId === null || body.toteatUserId === "" ? null : Number(body.toteatUserId) }),
        ...(body.toteatApiToken !== undefined && { toteatApiToken: body.toteatApiToken || null }),
        ...(body.isDemo !== undefined && { isDemo: body.isDemo }),
        ...(body.genioFabEnabled !== undefined && { genioFabEnabled: body.genioFabEnabled }),
        ...(body.multiMenuEnabled !== undefined && { multiMenuEnabled: body.multiMenuEnabled }),
        ...(body.filterBarEnabled !== undefined && { filterBarEnabled: body.filterBarEnabled }),
        ...(body.weeklyEmailEnabled !== undefined && { weeklyEmailEnabled: body.weeklyEmailEnabled }),
        // Google Places fields (super-admin only)
        ...(body.googlePlaceId !== undefined && { googlePlaceId: body.googlePlaceId || null }),
        ...(body.googleMapsUrl !== undefined && { googleMapsUrl: body.googleMapsUrl || null }),
        ...(body.googleRating !== undefined && { googleRating: body.googleRating === null ? null : Number(body.googleRating) }),
        ...(body.googleRatingCount !== undefined && { googleRatingCount: body.googleRatingCount === null ? null : Number(body.googleRatingCount) }),
        ...(body.primaryCategory !== undefined && { primaryCategory: body.primaryCategory || null }),
        ...(body.isShowcase !== undefined && { isShowcase: body.isShowcase }),
        ...(body.lat !== undefined && { lat: body.lat === null ? null : Number(body.lat) }),
        ...(body.lng !== undefined && { lng: body.lng === null ? null : Number(body.lng) }),
        ...(body.cartaProvider !== undefined && { cartaProvider: body.cartaProvider || null }),
        ...(body.websiteIsOrderUrl !== undefined && { websiteIsOrderUrl: body.websiteIsOrderUrl }),
        ...(body.sectionTitleMenu !== undefined && { sectionTitleMenu: body.sectionTitleMenu || null }),
        ...(body.sectionTitleRecomendados !== undefined && { sectionTitleRecomendados: body.sectionTitleRecomendados || null }),
        ...(body.sectionTitleCraving !== undefined && { sectionTitleCraving: body.sectionTitleCraving || null }),
        ...(body.orderingBusinessHours !== undefined && { orderingBusinessHours: body.orderingBusinessHours }),
      };
    } else {
      // Owner: silently filter to allowed fields only
      data = pickFields(body, OWNER_EDITABLE_FIELDS);
      // Lat/lng: owners need to set their coordinates for geo notifications
      if (body.lat !== undefined) data.lat = body.lat === null ? null : Number(body.lat);
      if (body.lng !== undefined) data.lng = body.lng === null ? null : Number(body.lng);
      // Plan checks: some fields require SILVER+ or PREMIUM
      const needsPlanCheck = data.defaultView !== undefined || body.toteatRestaurantId !== undefined || body.toteatLocalId !== undefined || body.toteatUserId !== undefined || body.toteatApiToken !== undefined;
      if (needsPlanCheck) {
        const r = await prisma.restaurant.findUnique({ where: { id }, select: { plan: true, toteatWebhookSecret: true } });
        // Vista por defecto: solo SILVER+ (FREE solo puede tener "lista")
        if (data.defaultView !== undefined && r?.plan === "FREE") {
          delete data.defaultView;
        }
        // Toteat credentials: solo owners de locales PREMIUM pueden editarlos
        const wantsToteat = body.toteatRestaurantId !== undefined || body.toteatLocalId !== undefined || body.toteatUserId !== undefined || body.toteatApiToken !== undefined;
        if (wantsToteat && r?.plan === "PREMIUM") {
          if (body.toteatRestaurantId !== undefined) data.toteatRestaurantId = body.toteatRestaurantId || null;
          if (body.toteatLocalId !== undefined) data.toteatLocalId = body.toteatLocalId === null || body.toteatLocalId === "" ? null : Number(body.toteatLocalId);
          if (body.toteatUserId !== undefined) data.toteatUserId = body.toteatUserId === null || body.toteatUserId === "" ? null : Number(body.toteatUserId);
          if (body.toteatApiToken !== undefined) data.toteatApiToken = body.toteatApiToken || null;
          // Generar secret de webhook la primera vez
          if (!r.toteatWebhookSecret && body.toteatApiToken) {
            data.toteatWebhookSecret = crypto.randomBytes(24).toString("hex");
          }
        }
      }
    }

    // Auto-fill commune fields whenever address is being updated
    if (data.address !== undefined) {
      const communeData = data.address ? extractCommune(data.address) : null
      data.commune = communeData?.commune ?? null
      data.communeSlug = communeData?.communeSlug ?? null
    }

    const restaurant = await prisma.restaurant.update({ where: { id }, data });
    // Invalidar cache del feed si cambiaron campos visibles al usuario
    const feedFields = ['name','phone','website','websiteIsOrderUrl','cartaProvider','instagram','googleMapsUrl','address','logoUrl','isActive'];
    if (feedFields.some(f => data[f] !== undefined)) revalidateTag('feed-dishes', { expire: 0 });
    // Invalidar cache QR si cambiaron ajustes de la carta
    const qrFields = ['showCategoryLobby','cartaColorMode','cartaAccentColor','defaultView','genioFabEnabled','multiMenuEnabled','filterBarEnabled','bannerUrl','logoUrl','name','description','orderingEnabled','orderingPhone','orderingDelivery','orderingMinAmount','orderingWaitTime','orderingNote','orderingPaymentMethods','orderingBannerUrl','orderingTheme','orderingAccentColor','sectionTitleMenu','sectionTitleRecomendados','sectionTitleCraving'];
    if (qrFields.some(f => data[f] !== undefined)) {
      revalidateTag(`qr-restaurant-${restaurant.slug}`, { expire: 0 });
    }
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
