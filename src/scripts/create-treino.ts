import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  // Crear restaurante Treino
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Treino",
      slug: "treino",
      profileType: "STORE",
      plan: "PREMIUM",
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true,
      cartaTheme: "PREMIUM",
      defaultView: "lista",
      billingExempt: false,
    },
  });

  console.log("Restaurant created:", restaurant.id, restaurant.slug);

  // Crear loyalty program para Treino
  await prisma.loyaltyProgram.create({
    data: {
      restaurantId: restaurant.id,
      name: "Tarjeta Treino",
      active: true,
      stampGoal: 8,
      stampIcon: "⭐",
      rewards: [{ stamp: 8, reward: "Premio especial" }],
    },
  });

  console.log("Loyalty program created");

  // Crear owner Alejandro Gebert
  const passwordHash = await bcrypt.hash("DEBUENASAGRANDIOSAS777", 10);
  const owner = await prisma.restaurantOwner.create({
    data: {
      email: "janogebert@treinoficial.cl",
      passwordHash,
      name: "Alejandro Gebert",
      whatsapp: "+56931135644",
      status: "ACTIVE",
      mustChangePassword: false,
      emailVerificado: true,
      restaurants: { connect: { id: restaurant.id } },
    },
  });

  console.log("Owner created:", owner.id, owner.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
