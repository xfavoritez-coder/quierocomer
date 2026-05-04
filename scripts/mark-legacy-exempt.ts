/**
 * Lista todos los Restaurants y marca los legacy (especificados manualmente)
 * como billingExempt para que no se les pida suscripcion.
 *
 * Uso: npx tsx scripts/mark-legacy-exempt.ts [--list]
 *      npx tsx scripts/mark-legacy-exempt.ts --mark "slug1,slug2"
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const all = await prisma.restaurant.findMany({
    select: {
      id: true, name: true, slug: true, plan: true,
      subscriptionStatus: true, billingExempt: true,
      flowSubscriptionId: true, isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("\nTodos los locales:\n");
  console.log("ID                                | Slug                       | Plan    | Status   | Exempt | Sub");
  console.log("-".repeat(120));
  for (const r of all) {
    console.log(
      `${r.id.padEnd(33)} | ${(r.slug || "").padEnd(26)} | ${r.plan.padEnd(7)} | ${(r.subscriptionStatus || "NONE").padEnd(8)} | ${r.billingExempt ? "SI" : "no".padEnd(6)} | ${r.flowSubscriptionId || "-"}`
    );
  }

  const arg = process.argv.find((a) => a.startsWith("--mark="));
  if (arg) {
    const slugs = arg.replace("--mark=", "").split(",").map((s) => s.trim()).filter(Boolean);
    if (slugs.length === 0) {
      console.log("\nNo se especificaron slugs.");
    } else {
      console.log(`\nMarcando como exempt: ${slugs.join(", ")}`);
      const result = await prisma.restaurant.updateMany({
        where: { slug: { in: slugs } },
        data: { billingExempt: true },
      });
      console.log(`Actualizados: ${result.count}`);
    }
  } else {
    console.log("\nPara marcar legacy como exempt:");
    console.log('  npx tsx scripts/mark-legacy-exempt.ts --mark="slug1,slug2,slug3"');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
