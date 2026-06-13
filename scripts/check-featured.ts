import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const slugs = ["hand-roll", "horusvegan", "juana-la-brava", "alleria-pizza", "el-menu-de-la-esquina"];
  const restaurants = await prisma.restaurant.findMany({
    where: { slug: { in: slugs } },
    select: { name: true, slug: true, logoUrl: true, isActive: true },
  });
  for (const slug of slugs) {
    const r = restaurants.find(x => x.slug === slug);
    if (r) {
      console.log(`${r.isActive ? "✅" : "❌"} ${r.slug} — ${r.name} — logo: ${r.logoUrl ? "YES" : "NO"}`);
    } else {
      console.log(`❌ ${slug} — NOT FOUND in DB`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
