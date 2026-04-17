import { prisma } from "@/lib/prisma";

const LOGO = "https://horusvegan.com/img/logo.png";

const IMG = "https://horusvegan.com/img/";

interface Item { name: string; desc: string | null; price: number; photo?: string; rec?: boolean }

const MENU: Record<string, Item[]> = {
  "Para compartir": [
    { name: "Gyozas de Hummus", desc: "Gyozas rellenas de hummus sobre mix de hojas con salsa acevichada y ajo flameado", price: 6990, photo: IMG+"dishes_6.jpg" },
    { name: "Edamame", desc: "Vainas de soja al vapor con sal marina", price: 4990, photo: IMG+"dishes_5.jpg" },
    { name: "Spring Rolls", desc: "Rolls de arroz rellenos de vegetales frescos con salsa sweet chili", price: 5990, photo: IMG+"dishes_1.jpg", rec: true },
    { name: "Tempura de Verduras", desc: "Mix de verduras tempurizadas con salsa tentsuyu", price: 6490, photo: IMG+"dishes_3.jpg" },
  ],
  "Sushi": [
    { name: "Manglar Roll", desc: "Roll premium envuelto en palta con topping de mango y salsa de maracuyá", price: 12990, photo: IMG+"manglar.jpg", rec: true },
    { name: "Pharaon Roll", desc: "Roll signature con champiñón tempura, queso vegano y salsa especial de la casa", price: 12990, photo: IMG+"pharaon.jpg" },
    { name: "Anubis Roll", desc: "Roll tempurizado relleno de palta y queso vegano con topping acevichado", price: 11990, photo: IMG+"anubis.jpg" },
    { name: "Seth Roll", desc: "Roll envuelto en salmón vegano con palta, pepino y salsa ponzu", price: 11490, photo: IMG+"seth.jpg" },
    { name: "Tartar Sake", desc: "Tartar de salmón vegano con palta, sésamo y salsa de soya trufa", price: 10990, photo: IMG+"tartarsake.jpg" },
    { name: "Olivo Trufado", desc: "Roll con aceitunas, queso vegano trufado y palta", price: 10990, photo: IMG+"olivo-trufado.jpg", rec: true },
  ],
  "Fondos": [
    { name: "Tofu Bowl", desc: "Base de arroz integral, tofu grillado, edamame, palta y aderezo de sésamo", price: 9990, photo: IMG+"tofu.jpg" },
    { name: "Seitán Ramen", desc: "Caldo miso con fideos, seitán, champiñones, pak choi y brotes", price: 10990, photo: IMG+"seitan-ramen.jpg", rec: true },
    { name: "Palta Parrillera", desc: "Palta a la parrilla rellena con quinoa, vegetales grillados y chimichurri vegano", price: 9490, photo: IMG+"palta-parrillera.jpg" },
    { name: "Curry Verde", desc: "Curry tailandés con leche de coco, tofu y vegetales de temporada", price: 10490, photo: IMG+"cf4ceec4c1ae6370452baf3fd754a052.jpeg" },
  ],
  "Mocktails": [
    { name: "Horus Sunset", desc: "Maracuyá, naranja, granadina y soda", price: 5990, photo: IMG+"dishes_11.jpg" },
    { name: "Tropical Zen", desc: "Mango, piña, jengibre y agua tónica", price: 5990, photo: IMG+"dishes_12.jpg" },
    { name: "Berry Temple", desc: "Frutos rojos, limón, albahaca y soda", price: 5990, photo: IMG+"IMG_9124.jpg" },
  ],
  "Bebidas": [
    { name: "Limonada Artesanal", desc: "Limonada natural con jengibre, menta o maracuyá", price: 3990, photo: IMG+"limonadas.jpg" },
    { name: "Jugo Natural", desc: "Naranja, zanahoria o verde detox", price: 3490, photo: IMG+"jugosnaturales.jpg" },
    { name: "Agua Mineral", desc: "Con o sin gas", price: 1990, photo: IMG+"IMG_2497.jpeg" },
  ],
  "Postres": [
    { name: "Tiramisú Vegano", desc: "Tiramisú artesanal con crema de anacardos y café", price: 5990, photo: IMG+"tiramisu.jpg" },
    { name: "Brownie de Chocolate", desc: "Brownie húmedo con helado vegano de vainilla", price: 5490, photo: IMG+"brownie.jpg" },
    { name: "Mochi Ice Cream", desc: "3 unidades de mochi helado vegano", price: 4990, photo: IMG+"IMG_4620.jpeg" },
  ],
  "Café": [
    { name: "Espresso", desc: "Café de especialidad", price: 2490, photo: IMG+"IMG_8726.jpeg" },
    { name: "Cappuccino", desc: "Con leche de avena", price: 3490, photo: IMG+"IMG_8728.jpeg" },
    { name: "Matcha Latte", desc: "Matcha ceremonial con leche de avena", price: 4490, photo: IMG+"IMG_8729.jpeg" },
  ],
};

export async function seedHorus() {
  const existing = await prisma.restaurant.findUnique({ where: { slug: "horusvegan" } });
  if (existing) return existing;

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Horus Vegan",
      slug: "horusvegan",
      description: "Restaurante 100% vegano inspirado en el antiguo Egipto. Sushi, fondos y cócteles sin alcohol.",
      cartaTheme: "PREMIUM",
      phone: "+56900000000",
      address: "Santiago, Chile",
      ownerId: "seed-owner-horus",
      bannerUrl: null,
      logoUrl: LOGO,
    },
  });

  const catNames = Object.keys(MENU);
  for (let i = 0; i < catNames.length; i++) {
    const catName = catNames[i];
    const items = MENU[catName];

    const category = await prisma.category.create({
      data: { restaurantId: restaurant.id, name: catName, position: i, isActive: true },
    });

    for (let j = 0; j < items.length; j++) {
      const it = items[j];
      await prisma.dish.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: category.id,
          name: it.name,
          description: it.desc,
          price: it.price,
          photos: it.photo ? [it.photo] : [],
          tags: it.rec ? ["RECOMMENDED"] : [],
          isHero: false,
          position: j,
        },
      });
    }
  }

  return restaurant;
}

export async function reseedHorus() {
  const existing = await prisma.restaurant.findUnique({ where: { slug: "horusvegan" } });
  if (existing) {
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
  return seedHorus();
}
