import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const query = process.argv[2] || "tres toques";

  const rest = await p.restaurant.findFirst({
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, slug: true, isDemo: true, plan: true, subscriptionStatus: true, createdAt: true, updatedAt: true },
  });
  if (!rest) { console.log("Not found"); await p.$disconnect(); return; }

  console.log("=== " + rest.name + " ===");
  console.log("Plan:", rest.plan, "| Status:", rest.subscriptionStatus, "| Demo:", rest.isDemo);
  console.log("Created:", rest.createdAt.toISOString());
  console.log("Updated:", rest.updatedAt.toISOString());

  // Owner last login
  const owner = await p.restaurantOwner.findFirst({
    where: { restaurants: { some: { id: rest.id } } },
    select: { name: true, email: true, lastLoginAt: true, updatedAt: true },
  });
  if (owner) {
    console.log("\nOwner:", owner.name, "|", owner.email);
    console.log("Last login:", owner.lastLoginAt?.toISOString() || "NEVER");
    console.log("Updated:", owner.updatedAt.toISOString());
  }

  // Recently modified dishes
  const recentDishes = await p.dish.findMany({
    where: { restaurantId: rest.id },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { name: true, updatedAt: true, createdAt: true },
  });
  console.log("\nDishes (last 5 modified):");
  for (const d of recentDishes) {
    const wasEdited = d.updatedAt.getTime() !== d.createdAt.getTime();
    console.log(`  ${d.name} | ${wasEdited ? "EDITADO " + d.updatedAt.toISOString() : "sin editar"}`);
  }

  // Total dishes and categories
  const dishCount = await p.dish.count({ where: { restaurantId: rest.id } });
  const catCount = await p.category.count({ where: { restaurantId: rest.id } });
  console.log(`\nTotal: ${dishCount} platos, ${catCount} categorías`);

  // Sessions (customer visits)
  const sessionCount = await p.session.count({ where: { restaurantId: rest.id } });
  const recentSessions = await p.session.findMany({
    where: { restaurantId: rest.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { createdAt: true, deviceType: true },
  });
  console.log(`\nCustomer sessions: ${sessionCount}`);
  for (const s of recentSessions) {
    console.log(`  ${s.createdAt.toISOString()} | ${s.deviceType || "unknown"}`);
  }

  // Stat events count
  const statCount = await p.statEvent.count({ where: { restaurantId: rest.id } });
  console.log(`Stat events: ${statCount}`);

  await p.$disconnect();
}
main();
