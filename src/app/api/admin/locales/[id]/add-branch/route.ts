import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, authErrorResponse } from "@/lib/adminAuth";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

export const runtime = "nodejs";

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "sucursal";
}

const DISH_FIELDS = [
  "name", "description", "detailedDescription", "price", "discountPrice", "photos", "tags",
  "isHero", "isActive", "stockCountdown", "soldOut", "ingredients", "allergens", "position",
  "dishDiet", "isSpicy", "flavorTags", "isHighMargin", "isPhotoReferential",
  "isGlutenFree", "isLactoseFree", "isSoyFree", "containsNuts", "hiddenFromFeed",
  "hideFromOrdering", "ecommerceOnly", "photoCredits",
  "txDishType", "txCuisine", "txMealSlot", "txIngredient", "txEstilo",
] as const;

/**
 * POST /api/admin/locales/[id]/add-branch  (solo superadmin)
 * Body: { branchName, address?, copyMenu?: boolean }
 * Crea una nueva sucursal: un local nuevo bajo el MISMO dueño, con el MISMO
 * brandSlug de la marca, ecommerce activo. Opcionalmente copia la carta del
 * local base (sin los códigos Toteat: la nueva sucursal usa los suyos).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const branchName = (body?.branchName || "").toString().trim().slice(0, 60);
    const address = (body?.address || "").toString().trim() || null;
    const copyMenu = body?.copyMenu === true;
    if (!branchName) return NextResponse.json({ error: "Falta el nombre de la sucursal" }, { status: 400 });

    const source = await prisma.restaurant.findUnique({
      where: { id },
      select: { id: true, name: true, ownerId: true, cartaAccentColor: true, ecommerceStoreConfig: true },
    });
    if (!source) return NextResponse.json({ error: "Local base no encontrado" }, { status: 404 });
    if (!source.ownerId) return NextResponse.json({ error: "El local base no tiene dueño asignado; asígnalo antes de crear sucursales." }, { status: 400 });

    // Marca: usa el brandSlug del local base; si no tiene, genera uno y lo fija en el base.
    const srcCfg = parseStoreConfig(source.ecommerceStoreConfig);
    let brandSlug = srcCfg.brandSlug;
    if (!brandSlug) {
      brandSlug = slugify(source.name);
      await prisma.restaurant.update({ where: { id: source.id }, data: { ecommerceStoreConfig: { ...(srcCfg as unknown as object), brandSlug } as unknown as object } });
    }

    // Slug único para el nuevo local.
    let base = slugify(`${source.name}-${branchName}`);
    let slug = base;
    for (let i = 0; i < 5 && (await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } })); i++) {
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // Config de tienda heredada (apariencia + marca), SIN dominio propio ni
    // credenciales. Cada sucursal tiene las suyas: se limpian el token del
    // agente de impresión (es por dispositivo/caja) y el correo de aviso.
    const branchStoreConfig = {
      ...(srcCfg as unknown as object),
      brandSlug, branchName, customDomain: null,
      printToken: null, printTokenAt: null, printTestAt: null, printTestAckAt: null,
      orderNotifyEmail: null,
    };

    const branch = await prisma.restaurant.create({
      data: {
        name: `${source.name} · ${branchName}`,
        slug,
        ownerId: source.ownerId,
        address,
        cartaAccentColor: source.cartaAccentColor,
        ecommerceEnabled: true,
        ecommerceStoreConfig: branchStoreConfig as unknown as object,
      },
      select: { id: true, name: true, slug: true },
    });

    let dishesCopied = 0;
    if (copyMenu) {
      const srcTemplates = await prisma.modifierTemplate.findMany({
        where: { restaurantId: source.id },
        select: { id: true, name: true, scope: true, groups: { orderBy: { position: "asc" }, select: { name: true, required: true, minSelect: true, maxSelect: true, position: true, options: { orderBy: { position: "asc" }, select: { name: true, priceAdjustment: true, isDefault: true, position: true, description: true, imageUrl: true, isHidden: true, soldOut: true } } } } },
      });
      const srcCats = await prisma.category.findMany({ where: { restaurantId: source.id }, orderBy: { position: "asc" }, select: { id: true, name: true, description: true, position: true, isActive: true, dishType: true, cuisineTag: true, normOverride: true, scheduleDays: true, scheduleStart: true, scheduleEnd: true } });
      const srcDishes = await prisma.dish.findMany({ where: { restaurantId: source.id, deletedAt: null }, orderBy: { position: "asc" }, select: { categoryId: true, modifierTemplates: { select: { id: true } }, ...Object.fromEntries(DISH_FIELDS.map((f) => [f, true])) } as any });

      await prisma.$transaction(async (tx) => {
        const tmplMap = new Map<string, string>();
        for (const t of srcTemplates) {
          const nt = await tx.modifierTemplate.create({ data: { restaurantId: branch.id, name: t.name, scope: t.scope }, select: { id: true } });
          tmplMap.set(t.id, nt.id);
          for (const g of t.groups) {
            const ng = await tx.modifierTemplateGroup.create({ data: { templateId: nt.id, name: g.name, required: g.required, minSelect: g.minSelect, maxSelect: g.maxSelect, position: g.position }, select: { id: true } });
            if (g.options.length) await tx.modifierTemplateOption.createMany({ data: g.options.map((o) => ({ groupId: ng.id, ...o })) });
          }
        }
        const catMap = new Map<string, string>();
        for (const c of srcCats) { const { id: cid, ...cf } = c; const nc = await tx.category.create({ data: { restaurantId: branch.id, ...cf }, select: { id: true } }); catMap.set(cid, nc.id); }
        for (const d of srcDishes as unknown as Array<Record<string, unknown> & { categoryId: string; modifierTemplates: { id: string }[] }>) {
          const { categoryId, modifierTemplates, ...fields } = d;
          const newCat = catMap.get(categoryId);
          if (!newCat) continue;
          await tx.dish.create({ data: { ...(fields as object), restaurantId: branch.id, categoryId: newCat, modifierTemplates: { connect: modifierTemplates.map((m) => ({ id: tmplMap.get(m.id)! })).filter((x) => x.id) } } as any });
          dishesCopied++;
        }
      }, { timeout: 120000, maxWait: 15000 });
    }

    return NextResponse.json({ ok: true, branch, brandSlug, dishesCopied });
  } catch (e: any) {
    if (e?.status === 400 || e?.status === 403) return authErrorResponse(e);
    console.error("[admin add-branch]", e);
    return NextResponse.json({ error: "Error al crear la sucursal" }, { status: 500 });
  }
}
