/**
 * Crea el local "Isekai Ramen" con la carta completa migrada del PDF
 * que envió el dueño (myqrcode.mobi). Plan PREMIUM, multilenguaje ES/EN/PT.
 *
 * Uso:
 *   npx tsx scripts/seed-isekai-ramen.ts
 *
 * Idempotente: si el slug ya existe, agrega sufijo numérico.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient, type DishDietType } from "@prisma/client";
import crypto from "crypto";
import { detectDishFlags } from "../src/lib/utils/detectDishFlags";

const prisma = new PrismaClient();

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type DishSeed = {
  name: string;
  description?: string;
  price: number;
  diet?: DishDietType;
  isSpicy?: boolean;
};

type CategorySeed = {
  name: string;
  type: "food" | "drink" | "entry" | "dessert";
  dishes: DishSeed[];
};

const CATEGORIES: CategorySeed[] = [
  {
    name: "Entradas",
    type: "entry",
    dishes: [
      { name: "Karaage", price: 7800, description: "Pollo frito estilo japonés, con ensalada mixta" },
      { name: "Edamame", price: 7500, description: "Vaina de poroto de soya, asadas, sazonadas con sal de mar y aceite de sésamo", diet: "VEGAN" },
      { name: "Gyosa de cerdo", price: 7800, description: "Empanada tradicional de cerdo y verduras al vapor" },
      { name: "Gyosa de verdura", price: 7800, description: "Empanada tradicional de verduras al vapor", diet: "VEGETARIAN" },
      { name: "Gyosa de Camarón", price: 8500, description: "Empanada tradicional de camarón, pescado y verduras" },
      { name: "Isekai-Kyuri", price: 6500, description: "Láminas de pepino aderezado con salsa picante y sésamo", diet: "VEGAN", isSpicy: true },
      { name: "Tonkatsu", price: 7800, description: "Cerdo sazonado y apanado al estilo japonés, con ensalada mixta" },
      { name: "Tebasaki Karaage", price: 7500, description: "Alitas de pollo marinada y fritas al estilo japonés con ensalada mixta" },
      { name: "Okonomiyaki", price: 7800, description: "Tortilla de repollo y carne de cerdo, cubierta con salsa okonomiyaki, mayonesa y copos de bonito seco" },
      { name: "Takoyaki", price: 7900, description: "6 bolitas rellenas de pulpo y verduras, con salsa takoyaki, katsubushi y mayonesa" },
    ],
  },
  {
    name: "Donburi",
    type: "food",
    dishes: [
      { name: "Mini-Unadon", price: 7500, description: "Cuenco de arroz cubierto con anguila a la parrilla y salsa" },
      { name: "Mini-Karaagedon", price: 7000, description: "Cuenco de arroz cubierto con karaage crujiente y cebollín" },
      { name: "Mini-Chashudon", price: 7000, description: "Cuenco de arroz cubierto con cerdo asado, mayonesa y cebollín" },
      { name: "Mini-Veggiedon", price: 5500, description: "Cuenco de arroz cubierto con croqueta de zapallo, gari, cebollín y salsa teriyaki", diet: "VEGETARIAN" },
      { name: "Mini-Tamagodon", price: 7500, description: "Cuenco de arroz de sushi cubierto de tamagoyaki y sésamo", diet: "VEGETARIAN" },
      { name: "Ensalada Mixta", price: 2500, description: "Mix de lechugas, zanahoria y cebolla con su aderezo", diet: "VEGAN" },
      { name: "Gohan", price: 3000, description: "Cuenco de arroz", diet: "VEGAN" },
      { name: "Papas Fritas", price: 4000, description: "Papas fritas", diet: "VEGAN" },
    ],
  },
  {
    name: "Principales",
    type: "food",
    dishes: [
      { name: "Shoyu Ramen", price: 9500, description: "Caldo Asari (base de pollo y almeja) con salsa de soja, acompañado de fideos ramen, cerdo chashu, wakame, cebollín y huevo marinado" },
      { name: "Shio Ramen", price: 9500, description: "Caldo Asari y sal marina, servido con fideos ramen, cerdo chashu, wakame, cebollín y huevo marinado" },
      { name: "Miso Ramen", price: 9900, description: "Caldo Asari con pasta de miso, servido con fideos ramen, cerdo chashu, diente de dragón, cebollín y huevo marinado" },
      { name: "Miso Vegano Ramen", price: 9900, description: "Caldo vegano con pasta de miso, servido con fideos ramen, tofu, diente de dragón, cebollín y tomate cherry", diet: "VEGAN" },
      { name: "Isekai Veggie", price: 9900, description: "Caldo vegano a base de soya, servido con fideos ramen, croqueta de zapallo italiano, wakame, cebollín y diente de dragón", diet: "VEGAN" },
      { name: "Isekai Tan-Tan", price: 9900, description: "Caldo de pollo picante y sésamo, fideos ramen, carne de cerdo picada, pak choy, cebollín y huevo marinado", isSpicy: true },
      { name: "Tonkotsu Ramen", price: 13000, description: "Caldo espeso de hueso de cerdo con fideos ramen, cerdo chashu, huevo marinado, kikurage, cebollín y mayu (aceite de ajo rostizado)" },
      { name: "Isekai Paitan", price: 12000, description: "Caldo espeso de hueso de pollo con fideos ramen, cerdo chashu, huevo marinado, kikurage, brotes de bambú, cebollín y sésamo" },
    ],
  },
  {
    name: "Ramen Niños",
    type: "food",
    dishes: [
      { name: "Shio Ramen Niños", price: 6500, description: "Caldo Asari y sal marina, servido con fideos ramen, cerdo chashu, wakame, cebollín y 1/2 huevo marinado. Hasta 10 años." },
      { name: "Shoyu Ramen Niños", price: 6500, description: "Caldo Asari con salsa de soja, fideos ramen, cerdo chashu, wakame, cebollín y 1/2 huevo marinado. Hasta 10 años." },
      { name: "Miso Ramen Niños", price: 6500, description: "Caldo Asari con pasta de miso, fideos ramen, cerdo chashu, diente de dragón, cebollín y 1/2 huevo marinado. Hasta 10 años." },
      { name: "Isekai Paitan Niños", price: 8000, description: "Caldo espeso de hueso de pollo con fideos ramen, cerdo chashu, 1/2 huevo marinado, cebolla verde, kikurage, brotes de bambú, cebollín y sésamo. Hasta 10 años." },
    ],
  },
  {
    name: "Yakimeshi",
    type: "food",
    dishes: [
      { name: "Buta Yakimeshi", price: 9500, description: "Arroz frito japonés con cebollín, zanahoria, pimentón y carne de cerdo" },
      { name: "Tori Yakimeshi", price: 9500, description: "Arroz frito japonés con cebollín, zanahoria, pimentón y carne de pollo" },
      { name: "Ebi Yakimeshi", price: 10900, description: "Arroz frito japonés con cebollín, zanahoria, pimentón y camarones" },
      { name: "Veggie Yakimeshi", price: 9500, description: "Arroz frito japonés con zanahoria, cebollín, pimentón, tofu y choclo", diet: "VEGETARIAN" },
    ],
  },
  {
    name: "Picantes",
    type: "food",
    dishes: [
      { name: "Isekai Spicy", price: 1500, description: "Pasta de ají con ajo y jengibre estilo Isekai", diet: "VEGAN", isSpicy: true },
      { name: "Aceite Spicy", price: 1500, description: "Aceite picante estilo Isekai", diet: "VEGAN", isSpicy: true },
    ],
  },
  {
    name: "Toppings",
    type: "food",
    dishes: [
      { name: "Extra Fideo", price: 2500, description: "Porción de extra fideo", diet: "VEGAN" },
      { name: "Omori", price: 1500, description: "Media porción de extra fideo", diet: "VEGAN" },
      { name: "Chashu", price: 2000, description: "Porción de carne de cerdo marinada" },
      { name: "Karaage Topping", price: 1500, description: "Porción de karaage" },
      { name: "Tofu", price: 1500, description: "Porción de tofu", diet: "VEGAN" },
      { name: "Itabocha Furai", price: 1500, description: "Porción de zapallo apanado y frito", diet: "VEGETARIAN" },
      { name: "Soboro", price: 1500, description: "Porción de carne molida picante de cerdo", isSpicy: true },
      { name: "Camarón Topping", price: 2500, description: "Porción de camarón" },
      { name: "Ajitama", price: 1500, description: "Porción de huevo marinado", diet: "VEGETARIAN" },
      { name: "Nori", price: 1000, description: "Porción de alga nori", diet: "VEGAN" },
      { name: "Wakame", price: 1000, description: "Porción de alga wakame", diet: "VEGAN" },
      { name: "Naruto", price: 1000, description: "Porción de 3 unidades de naruto" },
      { name: "Kikurage", price: 1000, description: "Porción de hongo de madera", diet: "VEGAN" },
      { name: "Gari", price: 1000, description: "Porción de jengibre rosado", diet: "VEGAN" },
      { name: "Moyashi", price: 1000, description: "Porción de diente de dragón (brotes)", diet: "VEGAN" },
      { name: "Negi-Mashi", price: 1000, description: "Porción de cebollín", diet: "VEGAN" },
      { name: "Tomate Cherry", price: 1000, description: "Porción de tomate cherry salteado", diet: "VEGAN" },
      { name: "Mayu", price: 1000, description: "Porción de aceite de ajo rostizado", diet: "VEGAN" },
      { name: "Pak Choi", price: 1000, description: "Porción de pak choi salteada", diet: "VEGAN" },
      { name: "Choclo", price: 1000, description: "Porción de choclo", diet: "VEGAN" },
    ],
  },
  {
    name: "Sushi",
    type: "food",
    dishes: [
      { name: "Sashimi de Salmón", price: 12900, description: "9 cortes de salmón" },
      { name: "Sashimi Mixto", price: 15900, description: "12 cortes entre salmón, atún, pescados del día y pulpo" },
      { name: "Chirashi", price: 9500, description: "Base de arroz de sushi, cortes de salmón, pescado del día, atún, tamagoyaki y camarón" },
      { name: "Uzuzukuri", price: 9500, description: "Finas láminas de pescado del día con una salsa cítrica a base de soya" },
      { name: "Isekai Mix", price: 17900, description: "Tabla de cortes de pescados del chef, acompañados de niguiris y hosomaki" },
    ],
  },
  {
    name: "Nigiri",
    type: "food",
    dishes: [
      { name: "Nigiri Camarón", price: 4000, description: "2 nigiri de camarón" },
      { name: "Nigiri Salmón", price: 3500, description: "2 nigiri de salmón" },
      { name: "Nigiri Atún", price: 4000, description: "2 nigiri de atún" },
      { name: "Nigiri Pulpo", price: 3800, description: "2 nigiri de pulpo" },
      { name: "Nigiri Unagi", price: 4500, description: "2 nigiri de anguila" },
      { name: "Nigiri Tamago", price: 3500, description: "2 nigiri de huevo", diet: "VEGETARIAN" },
    ],
  },
  {
    name: "Hosomaki",
    type: "food",
    dishes: [
      { name: "Kyuri-Maki", price: 3000, description: "Hosomaki de pepino. 8 cortes.", diet: "VEGAN" },
      { name: "Tamago-Maki", price: 3300, description: "Hosomaki de tortilla de huevo. 8 cortes.", diet: "VEGETARIAN" },
      { name: "Salmón Maki", price: 4000, description: "Hosomaki de salmón. 8 cortes." },
      { name: "Tuna Maki", price: 4000, description: "Hosomaki de atún. 8 cortes." },
      { name: "Camarón-Maki", price: 4000, description: "Hosomaki de camarón. 8 cortes." },
    ],
  },
  {
    name: "Gunkan",
    type: "food",
    dishes: [
      { name: "Gunkan Isekai", price: 4500, description: "Gunkan de pescado del día sazonado" },
      { name: "Gunkan Unagi", price: 5000, description: "Gunkan de anguila" },
    ],
  },
  {
    name: "Postres",
    type: "dessert",
    dishes: [
      { name: "Mochi Ice Cream", price: 5500, description: "2 unidades por porción. Sabores a elección: maracuyá, frutilla, matcha, mango, oreo o yuzu.", diet: "VEGETARIAN" },
      { name: "Taiyaki + Helado Matcha", price: 6500, description: "Un dorayaki más una porción de helado de matcha casero. Sabores a elección: anko, matcha u oreo.", diet: "VEGETARIAN" },
    ],
  },
  {
    name: "Mocktails (sin alcohol)",
    type: "drink",
    dishes: [
      { name: "Isekai Virgin", price: 5500, description: "Delicioso mocktail de autor a base de maracuyá y té de trigo" },
      { name: "Mango Colado", price: 5500, description: "Mocktail a base de mango y coco" },
      { name: "Piña Colada", price: 5500, description: "Mocktail a base de piña y coco" },
      { name: "Isekai Tsumi", price: 5500, description: "Delicioso mocktail a base de maracuyá, plátano y mango" },
      { name: "Isekai Yokubo", price: 5500, description: "Delicioso mocktail a base de naranja, piña y mango" },
    ],
  },
  {
    name: "Bebidas",
    type: "drink",
    dishes: [
      { name: "Ramune", price: 3300, description: "Bebida clásica japonesa gasificada" },
      { name: "Rico", price: 3800, description: "Jugo clásico japonés de diferentes sabores" },
      { name: "Bebidas Variadas", price: 2800, description: "Coca-Cola, Fanta, Sprite y Coca-Cola Zero" },
      { name: "Kombucha", price: 3700, description: "Té fermentado natural" },
      { name: "Cerveza 0 Alcohol", price: 3800, description: "Cerveza sin alcohol" },
      { name: "Agua Mineral", price: 2800, description: "Agua mineral con o sin gas" },
    ],
  },
  {
    name: "Jugos y Limonadas",
    type: "drink",
    dishes: [
      { name: "Jugos Naturales", price: 3800, description: "Sabores: mango, maracuyá, frutilla, piña, frambuesa o chirimoya" },
      { name: "Limonada Tradicional", price: 3600, description: "Limonada clásica" },
      { name: "Limonada Menta Jengibre", price: 4000, description: "Limonada con menta y jengibre" },
      { name: "Limonada Yuzu", price: 4300, description: "Limonada con cítrico yuzu" },
      { name: "Limonada Jengibre", price: 3600, description: "Limonada con jengibre" },
      { name: "Limonada Frutal", price: 4300, description: "Limonada combinada con alguna fruta de la estación" },
      { name: "Jugo Mix", price: 4300, description: "Combina dos sabores de jugos a elección" },
    ],
  },
  {
    name: "Té Matcha",
    type: "drink",
    dishes: [
      { name: "Té Matcha Caliente", price: 2500, description: "Té matcha caliente (250 ml)" },
      { name: "Té Matcha Frío", price: 3300, description: "Té matcha frío (480 ml)" },
      { name: "Tetera Matcha Caliente", price: 4500, description: "Tetera de té matcha caliente (750 ml)" },
    ],
  },
  {
    name: "Té Mugicha",
    type: "drink",
    dishes: [
      { name: "Mugicha Caliente", price: 3000, description: "Té de cebada con miel y limón caliente (250 ml)" },
      { name: "Mugicha Frío", price: 3800, description: "Té de cebada con miel y limón frío (480 ml)" },
      { name: "Tetera Mugicha Caliente", price: 4500, description: "Tetera de mugicha caliente (750 ml)" },
    ],
  },
  {
    name: "Té Genmaicha",
    type: "drink",
    dishes: [
      { name: "Genmaicha Caliente", price: 3000, description: "Té verde con arroz tostado caliente (250 ml)" },
      { name: "Tetera Genmaicha Caliente", price: 4500, description: "Tetera de genmaicha caliente (750 ml)" },
    ],
  },
];

async function main() {
  const NAME = "Isekai Ramen";

  // Generar slug único
  let slug = slugify(NAME);
  while (await prisma.restaurant.findUnique({ where: { slug } })) {
    slug = `${slugify(NAME)}-${Math.random().toString(36).slice(2, 5)}`;
  }

  const qrToken = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  console.log(`Creando restaurant "${NAME}" con slug "${slug}"...`);

  const restaurant = await prisma.restaurant.create({
    data: {
      name: NAME,
      slug,
      description: "Ramen tradicional japonés en pleno corazón de Providencia",
      address: "Girardi 1236, Providencia",
      instagram: "isekai.ramen",
      cartaTheme: "PREMIUM",
      defaultView: "lista",
      isActive: true,
      qrToken,
      qrActivatedAt: new Date(),
      plan: "PREMIUM",
      subscriptionStatus: "NONE",
      waiterPanelActive: true,
      enabledLangs: ["es", "en", "pt"], // multilenguaje activo
    },
  });

  console.log(`✓ Restaurant creado: id=${restaurant.id}`);

  let totalDishes = 0;
  let totalCategories = 0;

  for (let ci = 0; ci < CATEGORIES.length; ci++) {
    const cat = CATEGORIES[ci];
    if (cat.dishes.length === 0) continue;

    const category = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: cat.name,
        position: ci,
        dishType: cat.type,
        isActive: true,
      },
    });
    totalCategories++;

    const isDrinkCat = cat.type === "drink";

    for (let di = 0; di < cat.dishes.length; di++) {
      const d = cat.dishes[di];
      const detected = detectDishFlags({ name: d.name, description: d.description, ingredients: undefined });

      await prisma.dish.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: category.id,
          name: d.name,
          description: d.description || null,
          price: d.price,
          photos: [],
          position: di,
          dishDiet: isDrinkCat ? "OMNIVORE" : (d.diet || "OMNIVORE"),
          isSpicy: d.isSpicy ?? detected.isSpicy,
          containsNuts: isDrinkCat ? false : detected.containsNuts,
          isGlutenFree: isDrinkCat ? false : detected.isGlutenFree,
          isLactoseFree: isDrinkCat ? false : detected.isLactoseFree,
          isSoyFree: isDrinkCat ? false : detected.isSoyFree,
          isActive: true,
        },
      });
      totalDishes++;
    }
    console.log(`  ✓ ${cat.name}: ${cat.dishes.length} platos`);
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  console.log(`\n✓ Listo. ${totalCategories} categorías, ${totalDishes} platos creados.`);
  console.log(`\nCarta: ${baseUrl}/qr/${restaurant.slug}?t=${qrToken}`);
  console.log(`Slug:  ${restaurant.slug}`);
  console.log(`ID:    ${restaurant.id}`);
  console.log(`QR:    ${qrToken}\n`);
  console.log("Pasos siguientes:");
  console.log("  1. Subir el logo desde /panel/mi-restaurante (cuando entre el dueño)");
  console.log("  2. Buscar fotos automaticas: POST /api/agregarlocal/photos { restaurantId }");
  console.log("  3. Las traducciones EN/PT se generan al primer acceso por idioma");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
