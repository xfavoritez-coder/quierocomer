import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/lead/[id]/nuke
 * Elimina completamente un lead y su cuenta asociada (owner + restaurant + todos los hijos).
 *
 * Usa SET LOCAL session_replication_role = replica dentro de una transacción para
 * deshabilitar todos los checks FK durante el borrado — así no hay que mantener un
 * orden exacto de dependencias ni actualizar esto cuando el schema cambie.
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

    await prisma.$transaction(async (tx) => {
      // Disable FK constraint checks for this transaction
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);

      if (lead.convertedToOwnerId) {
        const oid = lead.convertedToOwnerId;

        const restaurants = await tx.restaurant.findMany({
          where: { ownerId: oid },
          select: { id: true },
        });

        for (const r of restaurants) {
          const rid = r.id;

          // Delete all child tables (order doesn't matter with FK checks disabled)
          const childTables = [
            `DELETE FROM "_DishToModifierTemplate" WHERE "A" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "_ModifierTemplateToPromotion" WHERE "A" IN (SELECT id FROM "ModifierTemplate" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "Review" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "DishImpression" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "DishFavorite" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "DishTranslation" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "DishIngredient" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "FeedInteraction" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "FeedSaved" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "FeedRating" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "FeedComment" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "FeedDishStats" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "BadgeSnapshot" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "DishSuggestion" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Dish" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "CategoryTranslation" WHERE "categoryId" IN (SELECT id FROM "Category" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "Category" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "MenuGroup" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "StatEvent" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "QRUserInteraction" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "GenioInsight" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "LoyaltyBroadcast" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "BirthdayEmailLog" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "RestaurantClient" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Customer" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "TeamMember" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "CampaignRecipient" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "Campaign" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Promotion" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "RestaurantPromotion" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "HappyHour" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Segment" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Announcement" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "BirthdayCampaign" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "AutomationRule" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "ModifierTemplate" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "OnlineOrder" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "WaiterCall" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "WaiterPushSubscription" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "RestaurantTable" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "RestaurantScheduleRule" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "ToteatSale" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "WhatsAppMessage" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "ExperienceSubmission" WHERE "experienceId" IN (SELECT id FROM "Experience" WHERE "restaurantId" = '${rid}')`,
            `DELETE FROM "Experience" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Invoice" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "PrivateReview" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "RestaurantTicket" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Session" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Compra" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Conteo" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Merma" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "VentaDia" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "HojaImpresa" WHERE "restaurantId" = '${rid}'`,
            `DELETE FROM "Insumo" WHERE "restaurantId" = '${rid}'`,
          ];

          for (const sql of childTables) {
            await tx.$executeRawUnsafe(sql);
          }

          await tx.$executeRawUnsafe(`DELETE FROM "Restaurant" WHERE "id" = '${rid}'`);
        }

        await tx.$executeRawUnsafe(`DELETE FROM "PanelShortLink" WHERE "ownerId" = '${oid}'`);
        await tx.$executeRawUnsafe(`DELETE FROM "RestaurantOwner" WHERE "id" = '${oid}'`);
      }

      await tx.$executeRawUnsafe(`DELETE FROM "WhatsAppMessage" WHERE "leadId" = '${id}'`);
      await tx.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "id" = '${id}'`);
    }, { timeout: 30000 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[nuke] error:", err);
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
