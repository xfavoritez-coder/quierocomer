import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // Find "Carlos" restaurant with owner González
  const carlos = await p.restaurant.findFirst({
    where: { name: "Carlos" },
    select: { id: true, name: true, owner: { select: { id: true, name: true } } },
  });
  console.log("Carlos:", carlos);

  // Find ESQUINA DE TOME
  const esquina = await p.restaurant.findFirst({
    where: { name: { contains: "ESQUINA", mode: "insensitive" } },
    select: { id: true, name: true, owner: { select: { id: true, name: true } } },
  });
  console.log("Esquina:", esquina);

  // Check the leads too
  const carlosLead = await p.lead.findFirst({
    where: { OR: [{ localName: "Carlos" }, { ownerName: { contains: "González", mode: "insensitive" } }] },
    select: { id: true, localName: true, ownerName: true },
  });
  console.log("Carlos lead:", carlosLead);

  const esquinaLead = await p.lead.findFirst({
    where: { localName: { contains: "ESQUINA", mode: "insensitive" } },
    select: { id: true, localName: true, ownerName: true },
  });
  console.log("Esquina lead:", esquinaLead);

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
