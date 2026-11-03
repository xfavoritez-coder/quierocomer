import * as dotenv from "dotenv";
dotenv.config({ path: ".env.prod" });
import { prisma } from "../src/lib/prisma";

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "Test Pago Flow", mode: "insensitive" } },
    select: { id: true, name: true, slug: true, ownerId: true },
  });
  if (!r) { console.log("No encontrado"); await prisma.$disconnect(); return; }
  console.log("Encontrado:", r);

  // Cancelar suscripción Flow si existe
  await prisma.restaurant.update({
    where: { id: r.id },
    data: { flowSubscriptionId: null, flowCustomerId: null, flowPlanId: null, pendingFlowPlanId: null },
  }).catch(() => {});

  // Eliminar lead asociado
  await prisma.lead.deleteMany({ where: { generatedSlug: r.slug } });
  console.log("Lead eliminado");

  // Eliminar restaurant (cascada limpia el resto)
  await prisma.restaurant.delete({ where: { id: r.id } });
  console.log("Restaurante eliminado:", r.name);

  // Eliminar owner si existe y no tiene otros restaurantes
  if (r.ownerId) {
    const otherRests = await prisma.restaurant.count({ where: { ownerId: r.ownerId } });
    if (otherRests === 0) {
      await prisma.restaurantOwner.delete({ where: { id: r.ownerId } }).catch(() => {});
      console.log("Owner eliminado");
    }
  }

  await prisma.$disconnect();
}
main();
