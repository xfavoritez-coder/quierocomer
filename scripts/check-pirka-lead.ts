import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  // Search lead by name
  const leads = await p.lead.findMany({
    where: { localName: { contains: "pirka", mode: "insensitive" } },
  });

  if (leads.length === 0) {
    console.log("No leads found with 'pirka' in name");
    // Try broader search
    const all = await p.lead.findMany({
      where: { localName: { contains: "pirk", mode: "insensitive" } },
    });
    if (all.length > 0) {
      console.log("Found with broader search:");
      for (const l of all) console.log(`  ${l.localName} — ${l.cartaStatus}`);
    }
    await p.$disconnect();
    return;
  }

  for (const lead of leads) {
    console.log("══════ Lead Found ══════");
    console.log(`Name: ${lead.localName}`);
    console.log(`Owner: ${lead.ownerName}`);
    console.log(`Email: ${lead.email}`);
    console.log(`WhatsApp: ${lead.whatsapp || "N/A"}`);
    console.log(`Status: ${lead.cartaStatus}`);
    console.log(`Type: ${lead.cartaType}`);
    console.log(`URL: ${lead.cartaUrl || "N/A"}`);
    console.log(`File URL: ${lead.cartaFileUrl || "N/A"}`);
    console.log(`Provider: ${lead.detectedProviderId || "N/A"}`);
    console.log(`Error: ${lead.errorLog || "none"}`);
    console.log(`Generated slug: ${lead.generatedSlug || "N/A"}`);
    console.log(`Created: ${lead.createdAt}`);
    console.log(`Step2 at: ${lead.step2At || "N/A"}`);
    console.log(`Completed at: ${lead.completedAt || "N/A"}`);
    console.log(`Ready at: ${lead.readyAt || "N/A"}`);
    console.log(`Delivered at: ${lead.deliveredAt || "N/A"}`);
    console.log(`City: ${lead.city || "N/A"}`);
    console.log(`IP: ${lead.ip || "N/A"}`);

    // Events
    const events = (lead as any).events;
    if (events && Array.isArray(events) && events.length > 0) {
      console.log(`\nEvents (${events.length}):`);
      for (const ev of events) {
        console.log(`  ${JSON.stringify(ev)}`);
      }
    } else {
      console.log("\nNo events logged");
    }

    // Check if restaurant was created
    if (lead.generatedSlug) {
      const r = await p.restaurant.findFirst({ where: { slug: lead.generatedSlug } });
      if (r) {
        console.log(`\nRestaurant exists: ${r.name} (slug: ${lead.generatedSlug})`);
        const dishCount = await p.dish.count({ where: { restaurantId: r.id, deletedAt: null } });
        console.log(`  Dishes: ${dishCount}`);
      } else {
        console.log(`\nRestaurant NOT found for slug: ${lead.generatedSlug}`);
      }
    }
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
