import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Buscar usuario
  const user = await prisma.restaurantOwner.findUnique({
    where: { email: "jaime@handroll.cl" },
    select: { id: true, email: true, name: true },
  });
  if (!user) { console.log("❌ Usuario no encontrado"); return; }
  console.log(`✅ Usuario: ${user.name} (${user.email})`);

  // Verificar que no exista ya
  const existing = await prisma.restaurant.findUnique({ where: { slug: "test-autocobro" } });
  if (existing) { console.log(`ℹ️ Ya existe: ${existing.name} (${existing.id})`); await prisma.$disconnect(); return; }

  // Crear local de prueba
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Test Autocobro",
      slug: "test-autocobro",
      ownerId: user.id,
      plan: "FREE",
      subscriptionStatus: "TRIALING",
      isActive: true,
      isDemo: false,
      billingExempt: false,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días trial
    },
  });

  console.log(`✅ Local creado: ${restaurant.name}`);
  console.log(`   ID: ${restaurant.id}`);
  console.log(`   Slug: ${restaurant.slug}`);
  console.log(`\n👉 Entra al panel: https://quierocomer.com/panel`);
  console.log(`   (con jaime@handroll.cl, selecciona "Test Autocobro")`);

  await prisma.$disconnect();
}
main();
