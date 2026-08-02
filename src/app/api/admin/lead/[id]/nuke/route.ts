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
      const ex = (sql: string) => prisma.$executeRawUnsafe(sql);

      const restaurants = await prisma.restaurant.findMany({
        where: { ownerId: lead.convertedToOwnerId },
        select: { id: true },
      });

      for (const r of restaurants) {
        const rid = r.id;

        // ── Junction tables (implicit M2M — must clear before either side) ──
        await ex(`DELETE FROM "_DishToModifierTemplate" WHERE "A" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);
        await ex(`DELETE FROM "_ModifierTemplateToPromotion" WHERE "A" IN (SELECT id FROM "ModifierTemplate" WHERE "restaurantId" = '${rid}')`);

        // ── Review: FK to Dish AND Customer (no cascade) — must come first ──
        await ex(`DELETE FROM "Review" WHERE "restaurantId" = '${rid}'`);

        // ── Leaf children of Dish (before Dish) ─────────────────────────────
        await ex(`DELETE FROM "DishImpression" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "DishFavorite" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "DishTranslation" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);
        await ex(`DELETE FROM "DishIngredient" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);
        await ex(`DELETE FROM "FeedInteraction" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);
        await ex(`DELETE FROM "FeedSaved" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);
        await ex(`DELETE FROM "FeedRating" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);
        await ex(`DELETE FROM "FeedComment" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);
        await ex(`DELETE FROM "FeedDishStats" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`);
        // BadgeSnapshot: onDelete: Cascade from Dish ✓
        // DishSuggestion: onDelete: Cascade from Dish ✓

        // ── Tickets + Sessions ───────────────────────────────────────────────
        await ex(`DELETE FROM "RestaurantTicket" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "Session" WHERE "restaurantId" = '${rid}'`);

        // ── Dishes ───────────────────────────────────────────────────────────
        await ex(`DELETE FROM "Dish" WHERE "restaurantId" = '${rid}'`);

        // ── Categories ───────────────────────────────────────────────────────
        await ex(`DELETE FROM "CategoryTranslation" WHERE "categoryId" IN (SELECT id FROM "Category" WHERE "restaurantId" = '${rid}')`);
        await ex(`DELETE FROM "Category" WHERE "restaurantId" = '${rid}'`);

        // ── Menu groups ──────────────────────────────────────────────────────
        await ex(`DELETE FROM "MenuGroup" WHERE "restaurantId" = '${rid}'`);

        // ── Analytics ────────────────────────────────────────────────────────
        await ex(`DELETE FROM "StatEvent" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "QRUserInteraction" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "GenioInsight" WHERE "restaurantId" = '${rid}'`);

        // ── Loyalty / customers ──────────────────────────────────────────────
        await ex(`DELETE FROM "LoyaltyBroadcast" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "BirthdayEmailLog" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "RestaurantClient" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "Customer" WHERE "restaurantId" = '${rid}'`);

        // ── Team ─────────────────────────────────────────────────────────────
        await ex(`DELETE FROM "TeamMember" WHERE "restaurantId" = '${rid}'`);

        // ── Campaigns (CampaignRecipient BEFORE Campaign) ────────────────────
        await ex(`DELETE FROM "CampaignRecipient" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE "restaurantId" = '${rid}')`);
        await ex(`DELETE FROM "Campaign" WHERE "restaurantId" = '${rid}'`);

        // ── Marketing ────────────────────────────────────────────────────────
        await ex(`DELETE FROM "Promotion" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "RestaurantPromotion" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "HappyHour" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "Segment" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "Announcement" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "BirthdayCampaign" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "AutomationRule" WHERE "restaurantId" = '${rid}'`);

        // ── Modifier templates (after junction tables cleared above) ─────────
        await ex(`DELETE FROM "ModifierTemplate" WHERE "restaurantId" = '${rid}'`);

        // ── Operations ───────────────────────────────────────────────────────
        await ex(`DELETE FROM "OnlineOrder" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "WaiterCall" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "WaiterPushSubscription" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "RestaurantTable" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "RestaurantScheduleRule" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "ToteatSale" WHERE "restaurantId" = '${rid}'`); // ToteatSaleProduct cascades
        await ex(`DELETE FROM "WhatsAppMessage" WHERE "restaurantId" = '${rid}'`);

        // ── Experience (ExperienceSubmission BEFORE Experience) ───────────────
        await ex(`DELETE FROM "ExperienceSubmission" WHERE "experienceId" IN (SELECT id FROM "Experience" WHERE "restaurantId" = '${rid}')`);
        await ex(`DELETE FROM "Experience" WHERE "restaurantId" = '${rid}'`);

        // ── Billing / misc ───────────────────────────────────────────────────
        await ex(`DELETE FROM "Invoice" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "PrivateReview" WHERE "restaurantId" = '${rid}'`);

        // ── Control module (Compra/Conteo/Merma BEFORE Insumo) ───────────────
        // CompraLinea/ConteoLinea/MermaLinea cascade from their parents, but
        // ConteoLinea.insumoId is a required FK — must delete parents first.
        await ex(`DELETE FROM "Compra" WHERE "restaurantId" = '${rid}'`);   // CompraLinea cascades
        await ex(`DELETE FROM "Conteo" WHERE "restaurantId" = '${rid}'`);   // ConteoLinea cascades
        await ex(`DELETE FROM "Merma" WHERE "restaurantId" = '${rid}'`);    // MermaLinea cascades
        await ex(`DELETE FROM "VentaDia" WHERE "restaurantId" = '${rid}'`); // VentaLinea cascades
        await ex(`DELETE FROM "HojaImpresa" WHERE "restaurantId" = '${rid}'`);
        await ex(`DELETE FROM "Insumo" WHERE "restaurantId" = '${rid}'`);

        // ── Finally delete the restaurant ────────────────────────────────────
        await prisma.restaurant.delete({ where: { id: rid } });
      }

      await ex(`DELETE FROM "PanelShortLink" WHERE "ownerId" = '${lead.convertedToOwnerId}'`);
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
