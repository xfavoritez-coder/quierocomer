import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { suggestPromotions } from "@/lib/genio/suggestPromotions";
import {
  checkAdminAuth,
  assertOwnsRestaurant,
  requireRestaurantForOwner,
  authErrorResponse,
  isSuperAdmin,
} from "@/lib/adminAuth";
import { logActivity } from "@/lib/admin/logActivity";
import { chileDayStart, chileDayEnd } from "@/lib/promoDates";
import { syncRestaurantDishDiscounts } from "@/lib/promos/syncDishDiscounts";
import { ensurePromoDish, removePromoDish, syncPromoStoreProductsActive } from "@/lib/promos/promoStoreProduct";

async function revalidateRestaurant(restaurantId: string) {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
  // { expire: 0 } = expiración inmediata (no stale-while-revalidate) — el próximo request obtiene datos frescos
  if (r?.slug) revalidateTag(`qr-restaurant-${r.slug}`, { expire: 0 } as any);
  revalidateTag("ecom-storefront", { expire: 0 } as any);
  if (r?.slug) revalidateTag(`ecom-storefront-slug-${r.slug}`, { expire: 0 } as any);
}

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    const validated = await requireRestaurantForOwner(req, restaurantId);

    const where: any = { status: { not: "DELETED" } };
    if (validated) where.restaurantId = validated;

    const promotions = await prisma.promotion.findMany({
      where,
      include: {
        restaurant: { select: { name: true, logoUrl: true } },
        modifierTemplates: { select: { id: true, name: true } },
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });

    // Collect all dish IDs: legacy dishIds array + new dishId field
    const allDishIds = [...new Set([
      ...promotions.flatMap((p) => p.dishIds),
      ...promotions.map((p) => (p as any).dishId).filter(Boolean),
    ])];
    const dishes = allDishIds.length
      ? await prisma.dish.findMany({
          where: { id: { in: allDishIds } },
          select: { id: true, name: true, price: true, photos: true },
        })
      : [];
    const dishMap = Object.fromEntries(dishes.map((d) => [d.id, d]));

    const enriched = promotions.map((p) => ({
      ...p,
      dishes: p.dishIds.map((id) => dishMap[id]).filter(Boolean),
      // new: single dish reference
      dish: (p as any).dishId ? dishMap[(p as any).dishId] || null : null,
    }));

    return NextResponse.json({ promotions: enriched });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("Promotions GET error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();

    // Generate AI suggestions
    if (body.action === "suggest") {
      await assertOwnsRestaurant(req, body.restaurantId);
      const suggestions = await suggestPromotions(body.restaurantId);

      const created = [];
      for (const s of suggestions) {
        const promo = await prisma.promotion.create({
          data: {
            restaurantId: body.restaurantId,
            name: s.name,
            description: s.description,
            dishIds: s.dishIds,
            originalPrice: s.originalPrice,
            promoPrice: s.promoPrice,
            discountPct: s.discountPct,
            status: "SUGGESTED",
            generatedBy: "ai",
            aiJustification: s.justification,
          },
        });
        created.push({ ...promo, targetSegment: s.targetSegment, emailCopy: s.emailCopy, dishNames: s.dishNames });
      }

      return NextResponse.json({ ok: true, promotions: created });
    }

    // Copiar una promoción a otras sucursales. Los platos y plantillas de
    // modificadores se buscan POR NOMBRE en cada sucursal destino (cada sucursal
    // tiene sus propios IDs). Si la sucursal ya tiene una promo con el mismo nombre,
    // se reemplaza para que quede igual a la de origen.
    if (body.action === "copy") {
      const src = await prisma.promotion.findUnique({
        where: { id: String(body.promoId || "") },
        include: { modifierTemplates: { select: { name: true } } },
      });
      if (!src || src.status === "DELETED") return NextResponse.json({ error: "Promoción no encontrada" }, { status: 404 });
      await assertOwnsRestaurant(req, src.restaurantId);
      const targets: string[] = (Array.isArray(body.targetRestaurantIds) ? body.targetRestaurantIds : []).map(String).filter((id: string) => id && id !== src.restaurantId);
      if (!targets.length) return NextResponse.json({ error: "Elige al menos una sucursal destino" }, { status: 400 });

      const srcDishIds = [...new Set([...src.dishIds, ...(src.dishId ? [src.dishId] : [])])];
      const srcDishes = srcDishIds.length ? await prisma.dish.findMany({ where: { id: { in: srcDishIds } }, select: { id: true, name: true } }) : [];
      const srcNameById = new Map(srcDishes.map((d) => [d.id, d.name]));
      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

      const results: { restaurantId: string; ok: boolean; replaced?: boolean; missing?: string[]; error?: string }[] = [];
      for (const targetId of targets) {
        try {
          await assertOwnsRestaurant(req, targetId);
          // Si hay varios platos con el mismo nombre, preferir el VISIBLE en la tienda
          // (activo y no oculto de pedidos online); si no, se avisa.
          const tDishes = await prisma.dish.findMany({ where: { restaurantId: targetId, deletedAt: null }, select: { id: true, name: true, isActive: true, hideFromOrdering: true } });
          const visible = (d: { isActive: boolean; hideFromOrdering: boolean | null }) => d.isActive && d.hideFromOrdering !== true;
          tDishes.sort((a, b) => Number(visible(b)) - Number(visible(a)));
          const byName = new Map<string, string>();
          const hiddenIds = new Set(tDishes.filter((d) => !visible(d)).map((d) => d.id));
          for (const d of tDishes) if (!byName.has(norm(d.name))) byName.set(norm(d.name), d.id);
          const mapId = (id: string) => { const n = srcNameById.get(id); return n ? byName.get(norm(n)) : undefined; };

          const missing = srcDishIds.filter((id) => !mapId(id)).map((id) => srcNameById.get(id) || id);
          // Platos encontrados pero ocultos en la tienda: la oferta no se vería.
          for (const id of srcDishIds) { const m = mapId(id); if (m && hiddenIds.has(m)) missing.push(`${srcNameById.get(id)} (existe pero está oculto en la tienda)`); }
          const mainDish = src.dishId ? mapId(src.dishId) : null;
          if (src.dishId && !mainDish) { results.push({ restaurantId: targetId, ok: false, missing, error: `No existe el plato "${srcNameById.get(src.dishId) || "?"}" en esta sucursal` }); continue; }
          const dishIds = [...new Set(src.dishIds.map(mapId).filter((x): x is string => !!x))];
          if (mainDish && !dishIds.includes(mainDish)) dishIds.push(mainDish);

          const tTemplates = src.modifierTemplates.length
            ? await prisma.modifierTemplate.findMany({ where: { restaurantId: targetId, name: { in: src.modifierTemplates.map((m) => m.name) } }, select: { id: true } })
            : [];

          const data = {
            name: src.name, description: src.description, promoType: src.promoType,
            imageUrl: src.imageUrl, thumbUrl: src.thumbUrl,
            dishIds, dishId: mainDish ?? null, promoName: src.promoName,
            originalPrice: src.originalPrice, promoPrice: src.promoPrice, discountPct: src.discountPct,
            validFrom: src.validFrom, validUntil: src.validUntil, daysOfWeek: src.daysOfWeek,
            featured: src.featured, hideOriginalWhenActive: src.hideOriginalWhenActive,
            status: src.status, generatedBy: "manual",
          };
          const existing = await prisma.promotion.findFirst({ where: { restaurantId: targetId, name: src.name, status: { not: "DELETED" } }, select: { id: true, dishIds: true } });
          const saved = existing
            ? await prisma.promotion.update({ where: { id: existing.id }, data: { ...data, modifierTemplates: { set: tTemplates.map((t) => ({ id: t.id })) } } })
            : await prisma.promotion.create({ data: { ...data, restaurantId: targetId, modifierTemplates: tTemplates.length ? { connect: tTemplates.map((t) => ({ id: t.id })) } : undefined } });

          // Mismos pasos que al guardar desde el panel: precios del día, producto en tienda, caché.
          await syncRestaurantDishDiscounts(targetId, [...new Set([...saved.dishIds, ...(existing?.dishIds ?? [])])]);
          if (src.linkedDishId) { try { await ensurePromoDish(saved.id); await syncPromoStoreProductsActive(targetId); } catch (e) { console.error("[promo copy store product]", e); } }
          await revalidateRestaurant(targetId);
          logActivity(targetId, "promo_copy", { fromPromoId: src.id, promoId: saved.id, name: src.name });
          results.push({ restaurantId: targetId, ok: true, replaced: !!existing, missing });
        } catch (e: any) {
          results.push({ restaurantId: targetId, ok: false, error: e?.message || "Error" });
        }
      }
      return NextResponse.json({ ok: results.every((r) => r.ok), results });
    }

    // Create manual promotion
    const { restaurantId, name, description, promoType, imageUrl, thumbUrl, dishIds, dishId, promoName, originalPrice, promoPrice, discountPct, validFrom, validUntil, daysOfWeek, modifierTemplateIds } = body;
    if (!restaurantId || !name) return NextResponse.json({ error: "restaurantId and name required" }, { status: 400 });

    await assertOwnsRestaurant(req, restaurantId);

    // Normalizar: dishId siempre presente en dishIds
    const normalizedDishIds = [...(dishIds || [])];
    if (dishId && !normalizedDishIds.includes(dishId)) normalizedDishIds.push(dishId);
    const promoData: any = {
      restaurantId, name, description: description || null,
      promoType: promoType || "product",
      imageUrl: imageUrl || null,
      thumbUrl: thumbUrl || null,
      dishIds: normalizedDishIds,
      dishId: dishId || null,
      promoName: promoName || null,
      originalPrice, promoPrice, discountPct,
      validFrom: chileDayStart(validFrom), // inicio del día en hora de Chile
      validUntil: chileDayEnd(validUntil), // fin del día en hora de Chile
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
      status: "ACTIVE", generatedBy: "manual",
      modifierTemplates: Array.isArray(modifierTemplateIds) && modifierTemplateIds.length
        ? { connect: modifierTemplateIds.map((id: string) => ({ id })) }
        : undefined,
    };
    const promo = await prisma.promotion.create({ data: promoData, include: { modifierTemplates: { select: { id: true, name: true } } } });

    // Sincroniza Dish.discountPrice respetando el día/rango de la promo.
    await syncRestaurantDishDiscounts(restaurantId, promo.dishIds);

    // "Vender también en la tienda": crea el producto (Dish) vinculado.
    if (body.sellInStore) { try { await ensurePromoDish(promo.id); await syncPromoStoreProductsActive(restaurantId); } catch (e) { console.error("[promo store product]", e); } }

    await revalidateRestaurant(restaurantId);
    logActivity(restaurantId, "promo_create", { promoId: promo.id, name, promoPrice, originalPrice });
    return NextResponse.json({ promotion: promo });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Promotion error:", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();

    // Bulk reorder
    if (body.action === "reorder" && Array.isArray(body.order)) {
      const restaurantId = await requireRestaurantForOwner(req, body.restaurantId);
      for (let i = 0; i < body.order.length; i++) {
        await prisma.promotion.update({ where: { id: body.order[i] }, data: { position: i } });
      }
      return NextResponse.json({ ok: true });
    }

    const { id, status, modifierTemplateIds, ...data } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Ownership check
    const existing = await prisma.promotion.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "Promoción no encontrada" }, { status: 404 });
    await assertOwnsRestaurant(req, existing.restaurantId);

    // Normalizar: si se actualiza dishId o dishIds, sincronizar ambos
    let updDishIds = Array.isArray(data.dishIds) ? [...data.dishIds] : undefined;
    const updDishId = data.dishId !== undefined ? (data.dishId || null) : undefined;
    if (updDishId && updDishIds && !updDishIds.includes(updDishId)) updDishIds.push(updDishId);
    if (updDishId && !updDishIds) {
      // dishId cambia pero dishIds no se envió — cargar dishIds actual y agregar
      const cur = await prisma.promotion.findUnique({ where: { id }, select: { dishIds: true } });
      if (cur && !cur.dishIds.includes(updDishId)) updDishIds = [...cur.dishIds, updDishId];
    }

    const promo = await prisma.promotion.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.promoPrice !== undefined && { promoPrice: data.promoPrice }),
        ...(data.originalPrice !== undefined && { originalPrice: data.originalPrice }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.validFrom !== undefined && { validFrom: chileDayStart(data.validFrom) }),
        ...(data.validUntil !== undefined && { validUntil: chileDayEnd(data.validUntil) }),
        ...(data.daysOfWeek !== undefined && { daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek : [] }),
        ...(data.hideOriginalWhenActive !== undefined && { hideOriginalWhenActive: !!data.hideOriginalWhenActive }),
        ...(updDishIds && { dishIds: updDishIds }),
        ...(updDishId !== undefined && { dishId: updDishId }),
        ...(data.promoName !== undefined && { promoName: data.promoName || null }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.featured !== undefined && { featured: data.featured }),
        ...(Array.isArray(modifierTemplateIds) && { modifierTemplates: { set: modifierTemplateIds.map((mid: string) => ({ id: mid })) } }),
      },
      include: { modifierTemplates: { select: { id: true, name: true } } },
    });

    // Sync isHero on promo dishes when featured flag changes
    if (data.featured !== undefined && promo.dishIds.length > 0) {
      await prisma.dish.updateMany({
        where: { id: { in: promo.dishIds } },
        data: { isHero: data.featured },
      });
    }

    // Sincroniza Dish.discountPrice respetando el día/rango y demás promos activas.
    await syncRestaurantDishDiscounts(existing.restaurantId, promo.dishIds);

    // Producto de tienda vinculado (Dish): crear/actualizar/quitar.
    try {
      const linked = await prisma.promotion.findUnique({ where: { id }, select: { linkedDishId: true } });
      if (status === "DELETED") {
        await removePromoDish(id); // al eliminar la promo, se quita su producto
      } else if (data.sellInStore === true) {
        await ensurePromoDish(id);
      } else if (data.sellInStore === false) {
        await removePromoDish(id);
      } else if (linked?.linkedDishId) {
        // Pausada → desactiva el producto; activa → lo mantiene sincronizado.
        if (status && status !== "ACTIVE") await removePromoDish(id);
        else await ensurePromoDish(id);
      }
      // Aplica día/rango de inmediato (mostrar solo días marcados y dentro del rango).
      await syncPromoStoreProductsActive(existing.restaurantId);
    } catch (e) { console.error("[promo store product]", e); }

    await revalidateRestaurant(existing.restaurantId);
    logActivity(existing.restaurantId, "promo_edit", { promoId: id, name: promo.name, status: promo.status });
    const fresh = await prisma.promotion.findUnique({ where: { id }, select: { linkedDishId: true } });
    return NextResponse.json({ promotion: { ...promo, linkedDishId: fresh?.linkedDishId ?? null } });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Promotion update error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
