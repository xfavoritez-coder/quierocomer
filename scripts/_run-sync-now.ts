import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const { syncPromoStoreProductsActive } = await import("../src/lib/promos/promoStoreProduct");

  const cl = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  console.log(`Hoy: día ${cl.getDay()} (${["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][cl.getDay()]})`);

  const slugs = ["kojo-sushi-la-florida", "kojo-sushi-recoleta"];
  const restaurants = await prisma.restaurant.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });

  for (const r of restaurants) {
    await syncPromoStoreProductsActive(r.id);
    console.log(`✓ sync: ${r.slug}`);
  }

  // Verificar estado final
  const ids = [
    "cmubc0yv50006jv0414yml2b9", // Suprema La Florida
    "cmvcjbx9n0015jn07w1mz3w14", // Suprema Recoleta
    "cmw0s38sv0003enjkdd0xpxfe", // Martes La Florida
    "cmw0s3hqv000denjkvx3egjs7", // Martes Recoleta
  ];
  const dishes = await prisma.dish.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, price: true, discountPrice: true, isActive: true } });
  for (const d of dishes) {
    console.log(`  ${d.isActive ? "✅" : "⛔"} ${d.name}: price=${d.price} discountPrice=${d.discountPrice}`);
  }

  console.log("\n✅ Listo");
}

main().catch(console.error).finally(() => prisma.$disconnect());
