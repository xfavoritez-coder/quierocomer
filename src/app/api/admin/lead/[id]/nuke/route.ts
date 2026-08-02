import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/lead/[id]/nuke
 * Elimina completamente un lead y su cuenta asociada (owner + restaurant + cascades).
 * Usado en funnel admin para eliminar registros de spam o competencia.
 *
 * Borra manualmente en orden de dependencia FK porque Prisma no hace cascade automático.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { convertedToOwnerId: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    }

    if (lead.convertedToOwnerId) {
      const restaurants = await prisma.restaurant.findMany({
        where: { ownerId: lead.convertedToOwnerId },
        select: { id: true },
      });

      for (const r of restaurants) {
        const rid = r.id;

        // ── Leaf-level children of Dish ──────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "DishRating" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);
        await prisma.$executeRawUnsafe(`DELETE FROM "DishImpression" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "DishFavorite" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "DishTranslation" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);
        await prisma.$executeRawUnsafe(`DELETE FROM "DishIngredient" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);

        // ── Tickets (references Session and RestaurantTable) ─────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "RestaurantTicket" WHERE "restaurantId" = '${rid}'`);

        // ── Sessions ─────────────────────────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "Session" WHERE "restaurantId" = '${rid}'`);

        // ── Dishes (after leaf deps removed) ─────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "Dish" WHERE "restaurantId" = '${rid}'`);

        // ── Categories ───────────────────────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "CategoryTranslation" WHERE "categoryId" IN (SELECT id FROM "Category" WHERE "restaurantId" = '${rid}')`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Category" WHERE "restaurantId" = '${rid}'`);

        // ── Menu groups ──────────────────────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "MenuGroup" WHERE "restaurantId" = '${rid}'`);

        // ── Analytics / stats ────────────────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "StatEvent" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "QRUserInteraction" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "GenioInsight" WHERE "restaurantId" = '${rid}'`);

        // ── Loyalty / customers ──────────────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "LoyaltyBroadcast" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "BirthdayEmailLog" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "RestaurantClient" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Customer" WHERE "restaurantId" = '${rid}'`);

        // ── Team ─────────────────────────────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "TeamMember" WHERE "restaurantId" = '${rid}'`);

        // ── Marketing / promotions ───────────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "Campaign" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Promotion" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "RestaurantPromotion" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "HappyHour" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Segment" WHERE "restaurantId" = '${rid}'`);

        // ── Operations ───────────────────────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "OnlineOrder" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "WaiterCall" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "WaiterPushSubscription" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "RestaurantTable" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "RestaurantScheduleRule" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "ToteatSale" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "WhatsAppMessage" WHERE "restaurantId" = '${rid}'`);

        // ── Billing / reviews / misc ─────────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "Review" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Invoice" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "DishSuggestion" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Experience" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "ModifierTemplate" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Ingredient" WHERE "restaurantId" = '${rid}'`);

        // ── Control module ───────────────────────────────────────────────────
        await prisma.$executeRawUnsafe(`DELETE FROM "Insumo" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Compra" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Conteo" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Merma" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "VentaDia" WHERE "restaurantId" = '${rid}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM "HojaImpresa" WHERE "restaurantId" = '${rid}'`);

        // ── Finally delete the restaurant ────────────────────────────────────
        await prisma.restaurant.delete({ where: { id: rid } });
      }

      await prisma.restaurantOwner.delete({
        where: { id: lead.convertedToOwnerId },
      });
    }

    // WhatsApp messages linked to the lead (not to a restaurant)
    await prisma.$executeRawUnsafe(`DELETE FROM "WhatsAppMessage" WHERE "leadId" = '${id}'`);

    await prisma.lead.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[nuke] error:", err);
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
