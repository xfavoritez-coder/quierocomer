import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // Find the ESQUINA DE TOME restaurant specifically
  const esquina = await p.restaurant.findFirst({
    where: { name: { contains: "ESQUINA DE TOME", mode: "insensitive" } },
    select: { id: true, name: true, owner: { select: { id: true, name: true } } },
  });
  console.log("Esquina de Tome:", esquina);

  // Fix owner name: "González" → need to check the lead for real name
  const carlosLead = await p.lead.findFirst({
    where: { localName: "Carlos" },
    select: { id: true, localName: true, ownerName: true, email: true, whatsapp: true },
  });
  console.log("Carlos lead full:", carlosLead);

  // The lead says ownerName is "González" — that's likely the last name
  // The restaurant name is "Carlos" — maybe that's the owner's first name?
  // Let's check if there's more info

  if (esquina) {
    // Fix LUIS → Luis for the ESQUINA owner
    const esquinaOwner = await p.restaurantOwner.findFirst({
      where: { restaurants: { some: { name: { contains: "ESQUINA DE TOME", mode: "insensitive" } } } },
      select: { id: true, name: true },
    });
    console.log("Esquina owner:", esquinaOwner);
    if (esquinaOwner && esquinaOwner.name === esquinaOwner.name.toUpperCase()) {
      // Title case it
      const fixed = esquinaOwner.name.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      console.log("Fixing owner name:", esquinaOwner.name, "→", fixed);
      await p.restaurantOwner.update({ where: { id: esquinaOwner.id }, data: { name: fixed } });
    }
    // Also fix restaurant name
    const fixedName = "Restaurant La Esquina de Tomé";
    console.log("Fixing restaurant name:", esquina.name, "→", fixedName);
    await p.restaurant.update({ where: { id: esquina.id }, data: { name: fixedName } });
  }

  // Fix "Carlos" — owner is "González", should be "Carlos González"
  if (carlosLead) {
    console.log("Fixing Carlos owner: González → Carlos González");
    await p.restaurantOwner.update({ where: { id: "cmpozxwod0002jv0478z6fje3" }, data: { name: "Carlos González" } });
    await p.lead.update({ where: { id: carlosLead.id }, data: { ownerName: "Carlos González" } });
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
