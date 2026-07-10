import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // Verify carta is correct first
  const rest = await p.restaurant.findFirst({
    where: { slug: "alto-gourmet" },
    select: { id: true, name: true, _count: { select: { dishes: true, categories: true } } },
  });
  console.log("Alto Gourmet:", rest?.name, "| dishes:", rest?._count.dishes, "| categories:", rest?._count.categories);

  if (rest && rest._count.dishes >= 100 && rest._count.categories >= 10) {
    console.log("Carta verified OK. Sending email via production API...");
    
    const BASE = "https://quierocomer.com";
    const SEED = process.env.SEED_SECRET || "qr-seed-2024-secreto";
    
    // Use send-message API to send carta_lista email
    // But we need a custom email, not a template. Let's check if we can send via the cron endpoint
    console.log("Carta is correct. Ready to send apology email.");
    console.log("Restaurant ID:", rest.id);
  } else {
    console.log("ERROR: Carta not properly set up yet!");
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
