import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // Find the most recent lead without email (orphan)
  const lead = await p.lead.findFirst({
    where: { email: "" },
    orderBy: { createdAt: "desc" },
  });

  if (!lead) { console.log("No orphan lead found"); await p.$disconnect(); return; }

  console.log("Found orphan lead:", lead.id, "| URL:", lead.cartaUrl?.slice(0, 60), "| Created:", lead.createdAt.toISOString());

  await p.lead.update({
    where: { id: lead.id },
    data: {
      localName: "Vida Boa",
      ownerName: "Vida Boa",
      email: "vidaboa.maipu@gmail.com",
      whatsapp: "56966328102",
      completedAt: new Date(),
    },
  });

  console.log("Updated: Vida Boa | vidaboa.maipu@gmail.com | +56966328102");
  console.log("Lead ID:", lead.id);
  await p.$disconnect();
}
main();
