import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const leads = await p.lead.findMany({
    where: {
      OR: [
        { localName: { contains: "bravazzo", mode: "insensitive" } },
        { cartaUrl: { contains: "bravazzo", mode: "insensitive" } },
        { cartaUrl: { contains: "socialreacts", mode: "insensitive" } },
      ],
    },
    include: { detectedProvider: true },
  });
  for (const l of leads) {
    console.log({
      id: l.id,
      name: l.localName,
      url: l.cartaUrl,
      status: l.cartaStatus,
      provider: l.detectedProvider?.name,
      errorLog: l.errorLog,
    });
  }
  await p.$disconnect();
}
main();
