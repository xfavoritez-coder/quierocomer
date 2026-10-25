/**
 * _recover-flow-customer-ids.ts
 *
 * Para cada restaurante con plan activo pero sin flowCustomerId en BD,
 * busca en Flow si ya existe un cliente con ese externalId y lo guarda.
 *
 * Útil cuando flowCustomerId fue limpiado en BD pero el cliente aún existe en Flow.
 */
import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
import { flowGet } from "../src/lib/billing/flow";

const prisma = new PrismaClient();

async function main() {
  // Restaurantes con plan pagado pero sin flowCustomerId
  const restaurants = await prisma.restaurant.findMany({
    where: { flowCustomerId: null, isDemo: false, lastPaymentAt: { not: null } },
    select: {
      id: true, name: true, slug: true, plan: true, subscriptionStatus: true,
      owner: { select: { email: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  console.log(`\n🔍 Restaurantes con lastPaymentAt y sin flowCustomerId: ${restaurants.length}\n`);

  let found = 0, notFound = 0, errors = 0;

  for (const r of restaurants) {
    const email = r.owner?.email;
    if (!email) {
      console.log(`  ⚠️  ${r.name}: sin email de dueño, skip`);
      notFound++;
      continue;
    }

    try {
      const list = await flowGet<{ data: { customerId: string; externalId: string; email: string }[] }>(
        "/customer/getList",
        { filter: email, start: 0, limit: 50 }
      );

      const match = list.data?.find((c) => c.externalId === r.id);
      if (match) {
        await prisma.restaurant.update({
          where: { id: r.id },
          data: { flowCustomerId: match.customerId },
        });
        console.log(`  ✅ ${r.name}: flowCustomerId recuperado → ${match.customerId}`);
        found++;
      } else {
        console.log(`  ⬜ ${r.name}: no tiene cliente en Flow aún`);
        notFound++;
      }

      // Rate limit suave
      await new Promise(res => setTimeout(res, 300));
    } catch (err: any) {
      console.error(`  ❌ ${r.name}: error → ${err.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   Recuperados: ${found}`);
  console.log(`   Sin cliente en Flow (nuevos): ${notFound}`);
  console.log(`   Errores: ${errors}`);
}

main().finally(() => prisma.$disconnect());
