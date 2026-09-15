import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const restaurants = await prisma.$queryRaw`
  SELECT id, name, slug, "logoUrl" FROM "Restaurant"
  WHERE "isActive" = true AND slug IS NOT NULL
  ORDER BY "createdAt" ASC
  LIMIT 40
`;

for (const r of restaurants) {
  if (r.logoUrl) console.log(`{ name: "${r.name.trim()}", slug: "${r.slug}", logo: "${r.logoUrl}" },`);
}

await prisma.$disconnect();
