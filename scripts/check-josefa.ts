import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const owner = await p.restaurantOwner.findFirst({
    where: { email: "josefaavn@gmail.com" },
    include: {
      restaurants: { select: { id: true, name: true, slug: true, isActive: true, isDemo: true, plan: true } },
    },
  });

  if (!owner) { console.log("Owner not found"); await p.$disconnect(); return; }

  console.log("=== JOSEFA VERA ===");
  console.log("Email:", owner.email);
  console.log("Created:", owner.createdAt?.toISOString());
  console.log("Updated:", owner.updatedAt?.toISOString());
  console.log("Last login:", owner.lastLoginAt?.toISOString() || "NEVER");
  console.log("Force change pw:", (owner as any).forceChangePassword);
  console.log("Has password:", !!(owner as any).passwordHash);
  console.log("\nRestaurants:");
  for (const r of owner.restaurants) {
    console.log(`  ${r.name} (${r.slug}) | active: ${r.isActive} | demo: ${r.isDemo} | plan: ${r.plan}`);
  }

  // Check recent sessions/logins
  const lead = await p.lead.findFirst({
    where: { email: "josefaavn@gmail.com" },
    orderBy: { createdAt: "desc" },
  });
  if (lead) {
    console.log("\nLead timeline:");
    console.log("  Created:", lead.createdAt.toISOString());
    console.log("  Delivered:", lead.deliveredAt?.toISOString() || "—");
    console.log("  Email opened:", lead.emailOpenedAt?.toISOString() || "—");
    console.log("  Email clicked:", lead.emailClickedAt?.toISOString() || "—");
    console.log("  Onboarding:", lead.onboardingDoneAt?.toISOString() || "—");
    console.log("  Panel visited:", lead.panelVisitedAt?.toISOString() || "—");
    console.log("  Activar visited:", lead.activarVisitedAt?.toISOString() || "—");
    console.log("  Activated:", lead.activatedAt?.toISOString() || "—");
    console.log("  Opened via:", lead.openedVia || "—");
  }

  await p.$disconnect();
}
main();
