import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  // Keep one lead, update its URL to the real menu, reset it for reprocessing
  const leadId = "cmpomqfyg000ajo04xwv8fyhv"; // first lead

  const updated = await p.lead.update({
    where: { id: leadId },
    data: {
      cartaUrl: "https://socialreacts.com/buenamesa/elbravazzogolf-carta3",
      cartaStatus: "PENDING",
      errorLog: null,
    },
  });

  console.log("Updated lead:", {
    id: updated.id,
    name: updated.localName,
    url: updated.cartaUrl,
    status: updated.cartaStatus,
  });

  await p.$disconnect();
}
main();
