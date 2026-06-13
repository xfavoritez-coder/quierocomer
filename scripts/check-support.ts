import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Find Rodrigo Falcon and Orlando
  const owners = await prisma.restaurantOwner.findMany({
    where: { OR: [
      { name: { contains: "Rodrigo", mode: "insensitive" } },
      { name: { contains: "Orlando", mode: "insensitive" } },
      { name: { contains: "Falcon", mode: "insensitive" } },
    ] },
    select: { id: true, name: true, email: true, whatsapp: true, restaurants: { select: { name: true, slug: true, plan: true } } },
  });
  console.log("Owners found:", owners.length);
  for (const o of owners) console.log(JSON.stringify(o, null, 2));

  // Check support messages
  const msgs = await prisma.supportMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, source: true, name: true, email: true, phone: true, message: true, read: true, repliedAt: true, restaurantSlug: true, createdAt: true },
  });
  console.log("\nRecent support messages:", msgs.length);
  for (const m of msgs) {
    console.log(`  ${m.read ? "✓" : "●"} [${m.source}] ${m.name || "anon"} <${m.email}> ${m.phone || ""} - "${m.message?.slice(0, 80)}..." (${m.createdAt.toISOString().slice(0, 10)}) ${m.repliedAt ? "REPLIED" : ""} slug=${m.restaurantSlug || "-"}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
