const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

// Toteat modifier groups mapped to our templates
const TEMPLATES = [
  {
    name: "Envolturas Hand Roll",
    groups: [{
      name: "Elige tu envoltura", required: true, maxSelect: 1,
      options: [
        { name: "Nori", price: 0 },
        { name: "Panko", price: 0 },
        { name: "Pollo Apanado", price: 1500 },
        { name: "Queso Crema Apanado", price: 1500 },
      ],
    }],
    // Toteat BA.050 — dishes with jb containing BA.050
    dishNames: [
      "Hand Roll Acevichado", "Hand Roll Ebi", "Hand Roll Tori", "Hand Roll Sake",
      "Hand Roll Grill", "Hand Roll Mozzarella", "Hand Roll Tropical (Mango)",
      "Hand Roll Champiñón", "Hand Roll Vegetariano",
    ],
  },
  {
    name: "Envolturas California",
    groups: [{
      name: "Elige tu envoltura", required: true, maxSelect: 1,
      options: [
        { name: "Sésamo", price: 0 },
        { name: "Ciboulette", price: 0 },
        { name: "Almendras", price: 1400 },
        { name: "Massago", price: 2800 },
      ],
    }],
    dishNames: [
      "California Ebi", "California Ebi Tempura", "California Sake",
      "California Tori", "California Palmito", "California Ahumado",
      "California Tropical Mango", "California Almond Tori",
    ],
  },
  {
    name: "Envolturas Special",
    groups: [{
      name: "Elige tu envoltura", required: true, maxSelect: 1,
      options: [
        { name: "Palta", price: 0 },
        { name: "Queso Crema", price: 0 },
        { name: "Salmón", price: 3000 },
        { name: "Salmón/Palta", price: 3000 },
      ],
    }],
    dishNames: [
      "Special Ebi", "Special Ebi Tempura", "Special Tori", "Special Sake",
      "Special Sake Ebi", "Special Almond Tori", "Special Beff Champiñon",
      "Special Ahumado",
    ],
  },
  {
    name: "Envoltura Hot Roll",
    groups: [{
      name: "Elige tu envoltura", required: true, maxSelect: 1,
      options: [
        { name: "Panko", price: 0 },
        { name: "Tempura", price: 0 },
        { name: "Pollo Apanado", price: 1500 },
        { name: "Palta Apanada", price: 1500 },
        { name: "Queso Crema Apanado", price: 1500 },
        { name: "Salmón Apanado", price: 3000 },
      ],
    }],
    dishNames: [
      "Hot Ebi", "Hot Tori", "Hot Almond Tori", "Hot Tropical",
      "Hot Ebi Champiñon", "Hot Beff Mozzarella", "Hot Sake", "Hot Sake Ebi",
    ],
  },
  {
    name: "Envolturas Sin Arroz",
    groups: [{
      name: "Elige tu envoltura", required: true, maxSelect: 1,
      options: [
        { name: "Palta", price: 0 },
        { name: "Queso Crema", price: 0 },
        { name: "Pollo Apanado", price: 1500 },
        { name: "Palta Apanada", price: 1500 },
        { name: "Queso Crema Apanado", price: 1500 },
        { name: "Mozzarella Apanado", price: 600 },
        { name: "Salmón Apanado", price: 3000 },
        { name: "Salmón", price: 3000 },
      ],
    }],
    dishNames: [
      "Sin Arroz Ebi Acevichado", "Sin Arroz Champiñon Tempura",
      "Sin arroz Acevichado Nikkei", "Sin Arroz Supreme Roll",
      "Sin Arroz Sublime Roll", "Sin Arroz Sake", "Sin Arroz Sake Ebi",
      "Sin Arroz Ebi", "Sin Arroz Honey Roll", "Sin Arroz Tori",
    ],
  },
  {
    name: "Envolturas Rolls Veganos",
    groups: [{
      name: "Elige tu envoltura", required: true, maxSelect: 1,
      options: [
        { name: "Sésamo", price: 0 },
        { name: "Ciboulette", price: 0 },
        { name: "Palta Apanada", price: 1500 },
      ],
    }],
    dishNames: [
      "Champiñon Tempura Vegano", "Tofu Roll", "Almond Roll Vegano",
      "Camote Furai Roll",
    ],
  },
  {
    name: "Envolturas Supreme Vegano",
    groups: [{
      name: "Elige tu envoltura", required: true, maxSelect: 1,
      options: [
        { name: "Panko", price: 0 },
        { name: "Palta Apanada", price: 1500 },
      ],
    }],
    dishNames: [
      "Supreme Roll Vegano", "Sin Arroz Champiñon Tempura Vegano",
    ],
  },
  {
    name: "Envolturas Hand Roll Vegano",
    groups: [{
      name: "Elige tu envoltura", required: true, maxSelect: 1,
      options: [
        { name: "Panko", price: 0 },
        { name: "Palta Apanada", price: 1500 },
      ],
    }],
    dishNames: [
      "Hand Roll Vegano", "Hand Roll Honey Vegano",
    ],
  },
  {
    name: "Sabor Gyozas",
    groups: [{
      name: "Elige el sabor de tus Gyozas", required: true, maxSelect: 1,
      options: [
        { name: "Gyozas De Pollo", price: 0 },
        { name: "Gyozas De Camarón", price: 0 },
        { name: "Gyozas De Cerdo", price: 0 },
        { name: "Gyozas Mixtas", price: 0 },
        { name: "Gyozas de Champiñón Queso", price: 0 },
      ],
    }],
    dishNames: ["Gyozas"],
  },
  {
    name: "Sabor Choco Roll",
    groups: [{
      name: "Elige tu salsa", required: true, maxSelect: 1,
      options: [
        { name: "Chocolate", price: 0 },
        { name: "Frambuesa", price: 0 },
      ],
    }],
    dishNames: ["Choco Roll"],
  },
  {
    name: "Opciones Hosomaki",
    groups: [{
      name: "Elige tu relleno", required: true, maxSelect: 1,
      options: [
        { name: "Palta", price: 0 },
        { name: "Queso Crema", price: 0 },
      ],
    }],
    dishNames: ["Hosomaki Ebi", "Hosomaki Sake"],
  },
  {
    name: "Opciones Sashimi",
    groups: [{
      name: "Cantidad de cortes", required: true, maxSelect: 1,
      options: [
        { name: "6 Cortes", price: 0 },
        { name: "9 Cortes", price: 5000 },
      ],
    }],
    dishNames: ["Sashimi Sake", "Sashimi Atun"],
  },
  {
    name: "Salmón o Pollo Teriyaki",
    groups: [{
      name: "Elige tu proteína", required: true, maxSelect: 1,
      options: [
        { name: "Pollo Teriyaki", price: 0 },
        { name: "Salmón Teriyaki", price: 3000 },
      ],
    }],
    dishNames: ["Salmon O Pollo Teriyaki"],
  },
  {
    name: "Base Chirashi",
    groups: [{
      name: "Elige tu base", required: true, maxSelect: 1,
      options: [
        { name: "Arroz", price: 0 },
        { name: "Lechuga", price: 0 },
      ],
    }],
    dishNames: [
      "Chirashi Clasico", "Chirashi Especial Del Chef",
      "Chirashi Nikkei", "Chirashi Acevichado Vegano", "Chirashi Pollo Furai",
    ],
  },
  {
    name: "Bebida para Chirashi",
    groups: [{
      name: "Agrega una bebida por solo $1.000", required: false, maxSelect: 1,
      options: [
        { name: "Coca Cola", price: 1000 },
        { name: "Coca Cola Zero", price: 1000 },
        { name: "Coca Cola Light", price: 1000 },
        { name: "Sprite", price: 1000 },
        { name: "Sprite Zero", price: 1000 },
        { name: "Fanta", price: 1000 },
        { name: "Fanta Zero", price: 1000 },
        { name: "Fanta Pomelo", price: 1000 },
        { name: "Nordic", price: 1000 },
        { name: "Nordic Zero", price: 1000 },
        { name: "InkaCola", price: 1000 },
      ],
    }],
    dishNames: [
      "Chirashi Clasico", "Chirashi Especial Del Chef",
      "Chirashi Nikkei", "Chirashi Acevichado Vegano", "Chirashi Pollo Furai",
    ],
  },
];

async function main() {
  const restaurant = await p.restaurant.findFirst({
    where: { name: { contains: "Hand Roll", mode: "insensitive" } },
  });
  if (!restaurant) { console.error("Restaurant not found"); return; }
  console.log(`Restaurant: ${restaurant.name} (${restaurant.id})`);

  const dishes = await p.dish.findMany({
    where: { restaurantId: restaurant.id, deletedAt: null },
    select: { id: true, name: true },
  });
  console.log(`Dishes: ${dishes.length}`);

  // Build name->dish map (case insensitive)
  const dishMap = new Map();
  for (const d of dishes) {
    dishMap.set(d.name.toLowerCase().trim(), d);
    // Also try without trailing period
    dishMap.set(d.name.toLowerCase().trim().replace(/\.$/, ""), d);
  }

  let templatesCreated = 0;
  let assignmentsCreated = 0;
  let notFound = [];

  for (const tmpl of TEMPLATES) {
    console.log(`\nCreating template: ${tmpl.name}`);

    // Check if template already exists
    const existing = await p.modifierTemplate.findFirst({
      where: { restaurantId: restaurant.id, name: tmpl.name },
    });
    if (existing) {
      console.log(`  Already exists, skipping`);
      continue;
    }

    const template = await p.modifierTemplate.create({
      data: {
        restaurantId: restaurant.id,
        name: tmpl.name,
        groups: {
          create: tmpl.groups.map((g, gi) => ({
            name: g.name,
            required: g.required,
            minSelect: g.required ? 1 : 0,
            maxSelect: g.maxSelect,
            position: gi,
            options: {
              create: g.options.map((o, oi) => ({
                name: o.name,
                priceAdjustment: o.price,
                position: oi,
              })),
            },
          })),
        },
      },
    });
    templatesCreated++;
    console.log(`  Created: ${template.id}`);

    // Assign to dishes
    for (const dishName of tmpl.dishNames) {
      const dish = dishMap.get(dishName.toLowerCase().trim())
        || dishMap.get(dishName.toLowerCase().trim().replace(/\.$/, ""));
      if (dish) {
        await p.modifierTemplate.update({
          where: { id: template.id },
          data: { dishes: { connect: { id: dish.id } } },
        });
        assignmentsCreated++;
        console.log(`  Assigned to: ${dish.name}`);
      } else {
        notFound.push(dishName);
        console.log(`  NOT FOUND: ${dishName}`);
      }
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Templates created: ${templatesCreated}`);
  console.log(`Assignments: ${assignmentsCreated}`);
  if (notFound.length > 0) {
    console.log(`Not found (${notFound.length}):`, notFound);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
