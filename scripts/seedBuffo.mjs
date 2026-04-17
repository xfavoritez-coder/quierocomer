import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const GALLERY = [
  "https://tb-static.uber.com/prod/image-proc/processed_images/aeac0c0d816479230d89eb2aecb71f07/fa23f51b9c499b035a68831c96e1821e.jpeg",
  "https://tb-static.uber.com/prod/image-proc/processed_images/aeac0c0d816479230d89eb2aecb71f07/7835428b286acb57646a256c897c0e9e.jpeg",
  "https://tb-static.uber.com/prod/image-proc/processed_images/aeac0c0d816479230d89eb2aecb71f07/0c09274e3b12c8246a05970e1ef9d835.jpeg",
  "https://tb-static.uber.com/prod/image-proc/processed_images/aeac0c0d816479230d89eb2aecb71f07/d9be3fc772fc6c0fd6b3471e291aa823.jpeg",
  "https://tb-static.uber.com/prod/image-proc/processed_images/aeac0c0d816479230d89eb2aecb71f07/cc592037c936600295e9961933037e19.jpeg",
  "https://tb-static.uber.com/prod/image-proc/processed_images/aeac0c0d816479230d89eb2aecb71f07/30be7d11a3ed6f6183354d1933fbb6c7.jpeg",
];
const g = (i) => GALLERY[i % GALLERY.length];

const MENU = {
  "Appetizer": [
    { name: "Tofu Furai", desc: "Cubitos de tofu marinados en soya apanados en panko con salsa acevichada", price: 6300, photo: g(0) },
    { name: "Fungi Furai", desc: "Champiñones rellenos con vegan cream cheese y cebollín con salsa acevichada de cilantro", price: 7890, photo: g(1), rec: true },
    { name: "Bastones Furai con Guacamole", desc: "Bastones de camote, seitán, espárrago y tofu apanados en panko con guacamole (8 uni)", price: 7890, photo: g(2) },
  ],
  "Ceviche & Chirashi": [
    { name: "Ceviche Vegano", desc: "Champiñón, cebolla morada, apio, espárrago, palmito marinado en leche de tigre vegana con camote furai y corona de palta", price: 11400, photo: g(3), rec: true },
    { name: "Chirashi Vegano", desc: "Base de arroz, palmito, tofu furai, cebollín, pepino, vegan cream, sésamo, camote furai y corona de palta", price: 9900, photo: g(4) },
    { name: "2 Bowl de Gohan", desc: "2 bowls con arroz, cebollín, palta, sésamo, tofu y aros de cebolla con salsa acevichada y honey", price: 12000, photo: g(5) },
  ],
  "Rolls sin Arroz": [
    { name: "Sun Roll", desc: "Seitán furai, vegan cream cheese, camote y cebollín bañado en salsa honey vegana y crocante de lentejas", price: 9900, photo: g(0), rec: true },
    { name: "Earth Supreme Roll", desc: "Palta, vegan cream cheese, pimentón furai y cebollín cubierto con ceviche vegano", price: 9900, photo: g(1) },
    { name: "Moon Roll", desc: "Seitán, tofu, queso crema, cebollín bañado en salsa acevichada y ciboulette", price: 9900, photo: g(2) },
    { name: "Jupiter Roll", desc: "Champiñón furai, vegan cream cheese, cebollín, almendras, camote y pimentón apanado en panko", price: 9900, photo: g(3) },
    { name: "Uranus Roll", desc: "Palmito, palta, queso crema, cebollín en nori bañado en salsa acevichada de cilantro", price: 9900, photo: g(4) },
  ],
  "California Rolls": [
    { name: "California Almendra", desc: "Almendra, vegan cream cheese y palta", price: 6900, photo: g(5) },
    { name: "California Seitán", desc: "Seitán, champiñón tempura, vegan cream cheese, cebollín", price: 6900, photo: g(0) },
    { name: "California Boniato", desc: "Camote furai, vegan cream cheese y palta", price: 6900, photo: g(1) },
    { name: "California Espárragos", desc: "Espárrago, pimentón, pepino, palta", price: 6900, photo: g(2) },
    { name: "California Fungi", desc: "Champiñón tempura, vegan cream cheese y palta", price: 6900, photo: g(3) },
  ],
  "Hot Rolls": [
    { name: "Hot Seitán", desc: "Seitán, champiñón tempura, vegan cream cheese, cebollín", price: 8100, photo: g(4) },
    { name: "Hot Fungi", desc: "Champiñón tempura, vegan cream cheese, cebollín", price: 8100, photo: g(5) },
    { name: "Hot Boniato", desc: "Camote furai, vegan cream cheese, palta", price: 8100, photo: g(0), rec: true },
    { name: "Hot Almendra", desc: "Almendra, vegan cream cheese, palta", price: 8100, photo: g(1) },
    { name: "Hot Mango", desc: "Camote furai, vegan cream cheese, mango", price: 8100, photo: g(2) },
    { name: "Hot Peppa", desc: "Champiñón tempura, vegan cream cheese, pimentón, almendras", price: 8100, photo: g(3) },
  ],
  "Nikkei Rolls": [
    { name: "Ceviche Roll", desc: "Champiñón tempura y palta en ciboulette cubierto con ceviche vegano y salsa acevichada", price: 9900, photo: g(4), rec: true },
    { name: "Huancaína Roll", desc: "Camote furai, vegan cream cheese, champiñón tempura en almendras bañado en salsa huancaína", price: 9900, photo: g(5) },
    { name: "Ahumado Roll", desc: "Camote furai, palta en nori tempura bañado en salsa unagi vegana con topping ahumado", price: 9900, photo: g(0) },
    { name: "Carrot Roll", desc: "Palta, vegan cream cheese y cebolla crocante en arcoíris de palta y zanahoria con espárrago furai", price: 9900, photo: g(1) },
  ],
  "Special Rolls": [
    { name: "Special Almendra", desc: "Almendra, vegan cream cheese, palta", price: 8100, photo: g(2) },
    { name: "Special Mango", desc: "Mango, camote furai y tofu", price: 8100, photo: g(3) },
    { name: "Special Fungi Seitán", desc: "Champiñón tempura, vegan cream cheese, seitán", price: 8100, photo: g(4) },
    { name: "Special Fungi", desc: "Champiñón tempura, vegan cream cheese y cebollín", price: 8100, photo: g(5) },
    { name: "Special Boniato", desc: "Camote furai, vegan cream cheese y palta", price: 8100, photo: g(0) },
    { name: "Special Peppa", desc: "Champiñón furai, queso crema, almendras, pimentón en palta", price: 8100, photo: g(1) },
  ],
  "Combinaciones": [
    { name: "Combi Familiar", desc: "1 fungi furai + 1 carrot roll + 1 ceviche roll + 1 special fungi + 1 hot almendras + 1 california boniato", price: 45900, photo: g(2), rec: true },
    { name: "Combi para Dos", desc: "1 tofu furai + 1 ceviche roll + 1 special fungi + 1 hot almendra", price: 27650, photo: g(3) },
    { name: "Combi para 2 de Lujo", desc: "1 fungi furai + 1 carrot roll + 1 earth supreme roll + 1 sun roll", price: 30900, photo: g(4) },
  ],
  "Promociones": [
    { name: "Promo Buffo Love", desc: "40 piezas variadas con salsas", price: 24900, photo: g(5) },
    { name: "Promo Buffo Furai", desc: "40 piezas variadas apanadas en panko con salsa acevichada", price: 23000, photo: g(0) },
    { name: "Promo Buffo Crew", desc: "60 piezas variadas con salsas", price: 29500, photo: g(1), rec: true },
    { name: "Promo 30 Piezas", desc: "30 piezas variadas bañadas con salsas", price: 14990, photo: g(2) },
  ],
  "Salsas": [
    { name: "Unagi", desc: "Salsa unagi vegana", price: 800 },
    { name: "Honey Vegana", desc: "Versión vegana de la clásica salsa honey", price: 800 },
    { name: "Jengibre", desc: "Jengibre encurtido en láminas", price: 800 },
    { name: "Sweet Spicy", desc: "Salsa dulce y picante", price: 800 },
    { name: "Acevichada de Cilantro", desc: "Salsa acevichada con toque cítrico", price: 800 },
    { name: "Acevichada Vegana", desc: "Salsa acevichada de sabor cítrico", price: 800 },
    { name: "Spicy Vegana", desc: "Picante fuerte", price: 800 },
  ],
};

const existing = await prisma.restaurant.findUnique({ where: { slug: "buffosushi" } });
if (existing) { console.log("Already exists:", existing.id); process.exit(0); }

const restaurant = await prisma.restaurant.create({
  data: {
    name: "Buffo Vegan Sushi",
    slug: "buffosushi",
    description: "Sushi 100% vegano en Providencia. Rolls creativos, ceviches y combinaciones para compartir.",
    cartaTheme: "PREMIUM",
    phone: "+56934217623",
    address: "General Córdova 1225, Providencia",
    ownerId: "seed-owner-buffo",
    bannerUrl: GALLERY[0],
    logoUrl: "https://images.rappi.cl/restaurants_logo/3039cf20-38b6-4582-bf0f-0bc7cfc133d1-1654630027913.png",
  },
});

const catNames = Object.keys(MENU);
let dishCount = 0;
for (let i = 0; i < catNames.length; i++) {
  const items = MENU[catNames[i]];
  const category = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: catNames[i], position: i, isActive: true },
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
    dishCount++;
  }
}
console.log("OK:", restaurant.slug, restaurant.id, dishCount, "dishes");
await prisma.$disconnect();
