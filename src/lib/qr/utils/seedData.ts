import { prisma } from "@/lib/prisma";

export async function seedRestaurant() {
  // Check if already seeded
  const existing = await prisma.restaurant.findUnique({
    where: { slug: "la-parrilla-de-nico" },
  });
  if (existing) return existing;

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "La Parrilla de Nico",
      slug: "la-parrilla-de-nico",
      description:
        "Carnes a la parrilla, recetas de la abuela y el mejor ambiente familiar de Santiago.",
      cartaTheme: "PREMIUM",
      phone: "+56912345678",
      address: "Av. Providencia 1234, Providencia",
      ownerId: "seed-owner-001",
      bannerUrl:
        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
      logoUrl: null,
      categories: {
        create: [
          { name: "Fondos", description: "Nuestros platos de fondo", position: 1 },
          { name: "Entradas", description: "Para empezar", position: 0 },
          { name: "Postres", description: "El toque final", position: 2 },
        ],
      },
      tables: {
        create: [
          { name: "Mesa 1 - Terraza", tableNumber: 1 },
          { name: "Mesa 2 - Interior", tableNumber: 2 },
        ],
      },
    },
    include: { categories: true },
  });

  const catMap: Record<string, string> = {};
  for (const cat of restaurant.categories) {
    catMap[cat.name] = cat.id;
  }

  // Fondos
  await prisma.dish.createMany({
    data: [
      {
        restaurantId: restaurant.id,
        categoryId: catMap["Fondos"],
        name: "Lomo Vetado a la Parrilla",
        description:
          "350g de lomo vetado madurado 21 días, acompañado de papas rústicas y ensalada fresca.",
        price: 18900,
        photos: [
          "https://images.unsplash.com/photo-1558030006-450675393462?w=400&q=80",
          "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80",
        ],
        tags: ["RECOMMENDED"],
        isHero: true,
        ingredients: "Lomo vetado, papas, lechuga, tomate, aceite de oliva",
        allergens: "Puede contener trazas de lácteos",
        position: 0,
        stockCountdown: 5,
      },
      {
        restaurantId: restaurant.id,
        categoryId: catMap["Fondos"],
        name: "Costillar BBQ",
        description: "Costillar de cerdo glaseado con salsa BBQ ahumada, coleslaw y corn bread.",
        price: 16500,
        discountPrice: 13900,
        photos: [
          "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
        ],
        tags: ["PROMOTION"],
        position: 1,
        ingredients: "Costillar de cerdo, salsa BBQ, repollo, zanahoria, pan de maíz",
      },
      {
        restaurantId: restaurant.id,
        categoryId: catMap["Fondos"],
        name: "Pollo a las Brasas",
        description: "Medio pollo marinado 24 horas, cocido lento sobre brasas de carbón.",
        price: 12900,
        photos: [
          "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&q=80",
        ],
        tags: ["MOST_ORDERED"],
        position: 2,
      },
      {
        restaurantId: restaurant.id,
        categoryId: catMap["Fondos"],
        name: "Salmón Grillado",
        description: "Filete de salmón atlántico con puré de coliflor y salsa de alcaparras.",
        price: 19500,
        photos: [
          "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80",
        ],
        tags: ["NEW"],
        position: 3,
        ingredients: "Salmón, coliflor, mantequilla, alcaparras, limón",
        allergens: "Contiene pescado y lácteos",
      },
    ],
  });

  // Entradas
  await prisma.dish.createMany({
    data: [
      {
        restaurantId: restaurant.id,
        categoryId: catMap["Entradas"],
        name: "Empanadas de Pino",
        description: "3 empanadas de horno con pino tradicional, aceitunas y huevo.",
        price: 6900,
        photos: [
          "https://images.unsplash.com/photo-1601000938259-9e92002320b2?w=400&q=80",
        ],
        tags: ["RECOMMENDED"],
        position: 0,
      },
      {
        restaurantId: restaurant.id,
        categoryId: catMap["Entradas"],
        name: "Provoleta a la Parrilla",
        description: "Queso provolone fundido con orégano y tomates cherry.",
        price: 7500,
        photos: [
          "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400&q=80",
        ],
        tags: [],
        position: 1,
        allergens: "Contiene lácteos",
      },
    ],
  });

  // Postres
  await prisma.dish.createMany({
    data: [
      {
        restaurantId: restaurant.id,
        categoryId: catMap["Postres"],
        name: "Volcán de Chocolate",
        description: "Bizcocho tibio de chocolate con centro líquido, helado de vainilla.",
        price: 7900,
        photos: [
          "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80",
        ],
        tags: ["MOST_ORDERED"],
        position: 0,
        allergens: "Contiene gluten, lácteos, huevo",
      },
      {
        restaurantId: restaurant.id,
        categoryId: catMap["Postres"],
        name: "Cheesecake de Maracuyá",
        description: "Base de galleta, crema de queso y coulis de maracuyá fresco.",
        price: 6500,
        discountPrice: 4900,
        photos: [
          "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&q=80",
        ],
        tags: ["PROMOTION"],
        position: 1,
      },
    ],
  });

  return restaurant;
}

export async function reseedRestaurant() {
  // Delete existing and recreate
  const existing = await prisma.restaurant.findUnique({
    where: { slug: "la-parrilla-de-nico" },
  });
  if (existing) {
    // Delete in order to respect FK constraints
    await prisma.review.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.statEvent.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.waiterCall.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurantPromotion.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.birthdayCampaign.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurantScheduleRule.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.customer.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.dish.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.category.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurantTable.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurant.delete({ where: { id: existing.id } });
  }
  return seedRestaurant();
}
