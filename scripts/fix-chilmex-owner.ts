import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();

async function main() {
  // Find or create owner for Chilmex
  const email = "orlando.jesus.cumare@gmail.com";
  
  let owner = await db.restaurantOwner.findUnique({ where: { email } });
  
  if (!owner) {
    const hash = await bcrypt.hash("chilmex2026", 10);
    owner = await db.restaurantOwner.create({
      data: {
        name: "Orlando Cumare",
        email,
        whatsapp: "+56976323134",
        passwordHash: hash,
        role: "OWNER",
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });
    console.log("✓ Owner creado:", owner.id);
  } else {
    await db.restaurantOwner.update({
      where: { id: owner.id },
      data: { name: "Orlando Cumare", whatsapp: "+56976323134" },
    });
    console.log("✓ Owner actualizado:", owner.id);
  }

  // Assign Chilmex to this owner
  await db.restaurant.update({
    where: { id: "cmpwtmx1o0000js043fylj5zc" },
    data: { ownerId: owner.id },
  });
  console.log("✓ Chilmex asignado a Orlando");

  // Update lead if exists
  await db.lead.updateMany({
    where: { generatedSlug: "chilmex" },
    data: { email, ownerName: "Orlando Cumare", whatsapp: "+56976323134" },
  });
  console.log("✓ Lead actualizado");
}

main().catch(console.error).finally(() => db.$disconnect());
