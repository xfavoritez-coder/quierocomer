import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const GOLD = "#e8930a";
const BASE_URL = "https://quierocomer.cl";

async function main() {
  const lead = await prisma.lead.findFirst({
    where: { generatedSlug: "taranta-chicureo" },
    select: { ownerName: true, email: true },
  });
  if (!lead) { console.log("Lead not found"); return; }
  console.log("Will send to:", lead.email, "| Owner:", lead.ownerName);

  const r = await prisma.restaurant.findFirst({ where: { slug: "taranta-chicureo" }, select: { id: true } });
  const dishes = await prisma.dish.findMany({ where: { restaurantId: r!.id }, select: { id: true, photos: true } });
  const withPhotos = dishes.filter(d => (d.photos as any[])?.length > 0).length;
  console.log("Dishes:", dishes.length, "| With photos:", withPhotos);

  // Trigger the one-time endpoint
  const res = await fetch(`${BASE_URL}/api/internal/send-taranta-email`);
  const json = await res.json();
  console.log("Response:", json);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
