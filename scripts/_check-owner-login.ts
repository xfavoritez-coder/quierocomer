import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const owner = await prisma.restaurantOwner.findUnique({
    where: { email: "jaime@handroll.cl" },
    select: { id: true, email: true, name: true, passwordHash: true, role: true },
  });
  if (!owner) { console.log("No encontrado"); return; }
  console.log(`Nombre: ${owner.name}`);
  console.log(`Role: ${owner.role}`);
  console.log(`Tiene password: ${!!owner.passwordHash}`);
  // Listar sus restaurantes
  const restaurants = await prisma.restaurant.findMany({
    where: { ownerId: owner.id },
    select: { name: true, slug: true, plan: true },
  });
  console.log(`Restaurantes: ${restaurants.map(r => r.name).join(", ")}`);
  await prisma.$disconnect();
}
main();
