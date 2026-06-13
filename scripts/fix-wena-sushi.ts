import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  for (const slug of ["wena-pizza", "sushi-austral"]) {
    const r = await prisma.restaurant.findFirst({
      where: { slug },
      select: {
        id: true, name: true, slug: true, defaultView: true, isDemo: true, plan: true,
        allPhotosReferential: true,
        owner: { select: { email: true, name: true } },
      },
    });
    if (!r) { console.log(`${slug}: NOT FOUND`); continue; }
    console.log(`\n=== ${r.name} (${r.slug}) ===`);
    console.log(`  plan=${r.plan}, isDemo=${r.isDemo}, defaultView=${r.defaultView}, allPhotosRef=${r.allPhotosReferential}`);
    console.log(`  owner: ${r.owner?.name} <${r.owner?.email}>`);

    const totalDishes = await prisma.dish.count({ where: { restaurantId: r.id } });
    const withPhotos = await prisma.dish.count({ where: { restaurantId: r.id, photos: { isEmpty: false } } });
    console.log(`  ${totalDishes} dishes, ${withPhotos} with photos`);

    // Categories
    const categories = await prisma.category.findMany({
      where: { restaurantId: r.id },
      select: { id: true, name: true, _count: { select: { dishes: true } } },
      orderBy: { position: "asc" },
    });
    console.log(`  Categories:`, categories.map(c => `${c.name}(${c._count.dishes})`).join(", "));

    // Promotions
    const promos = await prisma.promotion.findMany({
      where: { restaurantId: r.id },
      select: { id: true, name: true, status: true, promoType: true },
    });
    console.log(`  Promotions:`, promos.length > 0 ? promos.map(p => `${p.id}: ${p.name} (status=${p.status})`).join(", ") : "none");

    // Lead info
    const lead = await prisma.lead.findFirst({
      where: { generatedSlug: slug },
      select: { id: true, cartaUrl: true, cartaFileUrl: true, cartaType: true, detectedProviderId: true, cartaStatus: true },
    });
    console.log(`  Lead:`, lead ? JSON.stringify(lead) : "not found");
  }
}

main().finally(() => prisma.$disconnect());
