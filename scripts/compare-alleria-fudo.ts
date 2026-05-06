import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// === fu.do snapshot — 2026-05-05 (extraído de menu.fu.do/alleria/qr-menu) ===
const FUDO: Record<string, { name: string; price: number; desc?: string }[]> = {
  "Antipasti": [
    { name: "Montanara Napolitana", price: 9400 },
    { name: "Bruschetta di Mortadella", price: 11200 },
    { name: "Antipasti para dos", price: 24500 },
  ],
  "Pizzas Tradizionali": [
    { name: "Marinara", price: 10290 },
    { name: "Margherita", price: 11800 },
    { name: "Mini Margherita", price: 9200 },
    { name: "TheTop Pizza", price: 11800 },
    { name: "Margherita Búfala D.O.C", price: 15400 },
    { name: "Diavola", price: 16300 },
    { name: "Ortolana", price: 17400 },
    { name: "Capricciosa", price: 19390 },
    { name: "Quattro Formaggi", price: 22060 },
    { name: "Calzone al Forno", price: 19490 },
    { name: "Mini Calzone al Forno", price: 13590 },
  ],
  "Pizzas Speciali": [
    { name: "Primavera", price: 21070 },
    { name: "Connye Vegan", price: 18200 },
    { name: "Carlo Romano", price: 19490 },
    { name: "Don Lucariello", price: 21290 },
    { name: "Sofía", price: 20620 },
    { name: "Mediterránea", price: 19700 },
    { name: "Malaquias Concha", price: 22390 },
    { name: "Arlecchino", price: 23160 },
    { name: "Don Vittorio", price: 23360 },
    { name: "Mercadante", price: 23460 },
    { name: "Alleria", price: 23590 },
    { name: "Don Ricardo", price: 22490 },
    { name: "La Demonia", price: 23800 },
    { name: "Don Marocchino", price: 25140 },
    { name: "Toscana", price: 26790 },
    { name: "Luciano", price: 22500 },
    { name: "Filomena", price: 18100 },
    { name: "Cristoforo Colombo", price: 17490 },
    { name: "Rosatina", price: 29400 },
  ],
  "Pastas": [
    { name: "Gnocchi alla Sorrentina", price: 21400 },
    { name: "Gnocchi quatro formaggi", price: 21400 },
    { name: "Pasta seca alla puttanesca", price: 21400 },
    { name: "Lasagna Artesanal en Ragu Napolitano", price: 16990 },
  ],
  "Risottos": [
    { name: "Risotto porcini", price: 21990 },
  ],
  "Postres": [
    { name: "Angioletti Fritti con Nutella", price: 13900 },
    { name: "MINI Angioletti Fritti Con Nutella", price: 6900 },
    { name: "Cannoli Alleria", price: 9900 },
    { name: "Cannoli di Pistacho", price: 9900 },
    { name: "Cannolis 2 Sabores", price: 9900 },
    { name: "Gelato de Fior di Latte", price: 4700 },
    { name: "Gelato de Amaretto", price: 4700 },
    { name: "Gelato Menta Cioccolato", price: 4700 },
    { name: "Gelato Caramello Salato", price: 4700 },
    { name: "Tiramisú clásico", price: 6400 },
    { name: "Tiramisu Alleria", price: 6400 },
  ],
  "Cafetería": [
    { name: "Te negro english breakfast", price: 2200 },
    { name: "Espresso", price: 2500 },
    { name: "Espresso Doble", price: 2700 },
    { name: "Americano", price: 2700 },
    { name: "Ristretto", price: 2300 },
    { name: "Macchiato", price: 2800 },
    { name: "Cortado", price: 2900 },
    { name: "Cortado Doble", price: 3200 },
    { name: "Capuccino", price: 3500 },
    { name: "Latte", price: 4300 },
    { name: "Mocaccino", price: 3700 },
    { name: "Affogato Disaronno", price: 3300 },
    { name: "Café Bombón", price: 3900 },
    { name: "Infusión de menta", price: 2200 },
    { name: "Infusión de manzanilla", price: 2200 },
    { name: "Te negro canela y cardamomo", price: 2200 },
    { name: "Té negro frutos rojos", price: 2200 },
    { name: "Infusión limón y jengibre", price: 2200 },
    { name: "Infusion de naranja, mango y canela", price: 2200 },
    { name: "Infusión de frutos silvestres", price: 2200 },
  ],
  "Bebidas": [
    { name: "Peroni Lager 0° Alcohol", price: 3500 },
    { name: "Aranciata Rosa San Pellegrino", price: 4100 },
    { name: "Aranciata San Pellegrino", price: 4100 },
    { name: "Arancia & Fico de India San Pellegrino", price: 4100 },
    { name: "Limonata San Pellegrino", price: 4100 },
    { name: "Clementina San Pellegrino", price: 4100 },
    { name: "Pompelmo San Pellegrino", price: 4100 },
    { name: "Coca-Cola Original", price: 2600 },
    { name: "Coca-Cola S/azúcar", price: 2600 },
    { name: "Sprite", price: 2600 },
    { name: "Sprite Zero", price: 2600 },
    { name: "Fanta Original", price: 2600 },
    { name: "Fanta Zero", price: 2600 },
    { name: "Jugo de Mango", price: 5700 },
    { name: "Jugo de Frutilla", price: 5200 },
    { name: "Jugo de Chirimoya", price: 5900 },
    { name: "Jugo de Piña", price: 5700 },
    { name: "Agua C/gas chelada Benedictino", price: 2500 },
    { name: "Agua purificada con gas zero", price: 1500 },
    { name: "Agua purificada sin gas zero", price: 1500 },
    { name: "Zumo de limon", price: 1000 },
  ],
  "Adicionales": [
    { name: "Adicional de Verdura", price: 3000 },
    { name: "Adicional de Embutido Italiano", price: 4700 },
    { name: "Adicional de Queso Italiano", price: 4500 },
    { name: "Adicional Burrata D.O.C", price: 9000 },
    { name: "Adicional de Polpetta", price: 9000 },
    { name: "Adicional Funghi Porcini Italiano", price: 4000 },
    { name: "Adicional de Trufa y Pesto", price: 2000 },
    { name: "Adicional de Anchoas Italianas", price: 2000 },
  ],
  "Peri Bambini": [
    { name: "Sorrentino", price: 16900 },
    { name: "Diavoletta", price: 16900 },
    { name: "Paperino", price: 16900 },
    { name: "Mimosa", price: 16900 },
  ],
};

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,]/g, "");

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: "alleria-pizza" } });
  if (!r) throw new Error("Alleria no encontrado");

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null },
    select: { id: true, name: true, price: true, isActive: true, category: { select: { name: true } } },
  });

  const dbByCat: Record<string, typeof dishes> = {};
  for (const d of dishes) {
    const c = d.category.name;
    if (!dbByCat[c]) dbByCat[c] = [];
    dbByCat[c].push(d);
  }

  const allCats = new Set([...Object.keys(FUDO), ...Object.keys(dbByCat)]);

  console.log(`\n=== COMPARACIÓN: fu.do vs DB QuieroComer ===`);
  console.log(`fu.do total: ${Object.values(FUDO).flat().length}`);
  console.log(`DB total:    ${dishes.length}\n`);

  for (const cat of allCats) {
    const fudoItems = FUDO[cat] || [];
    const dbItems = dbByCat[cat] || [];

    const fudoSet = new Map(fudoItems.map(f => [norm(f.name), f]));
    const dbSet = new Map(dbItems.map(d => [norm(d.name), d]));

    console.log(`\n━━━ ${cat} ━━━`);
    console.log(`  fu.do: ${fudoItems.length} | DB: ${dbItems.length}`);

    // En fu.do pero NO en DB → AGREGAR
    const toAdd = fudoItems.filter(f => !dbSet.has(norm(f.name)));
    if (toAdd.length) {
      console.log(`  ➕ FALTAN EN DB (${toAdd.length}):`);
      for (const f of toAdd) console.log(`     - ${f.name} — $${f.price.toLocaleString("es-CL")}`);
    }

    // En DB pero NO en fu.do → POSIBLE QUITAR
    const toRemove = dbItems.filter(d => !fudoSet.has(norm(d.name)));
    if (toRemove.length) {
      console.log(`  ➖ EN DB pero NO en fu.do (${toRemove.length}):`);
      for (const d of toRemove) console.log(`     - ${d.name} — $${d.price.toLocaleString("es-CL")}${d.isActive ? "" : " [oculto]"}`);
    }

    // En ambos → comparar precio
    const priceDiffs: string[] = [];
    for (const f of fudoItems) {
      const d = dbSet.get(norm(f.name));
      if (d && d.price !== f.price) {
        priceDiffs.push(`     - ${f.name}: DB $${d.price.toLocaleString("es-CL")} vs fu.do $${f.price.toLocaleString("es-CL")}`);
      }
    }
    if (priceDiffs.length) {
      console.log(`  💲 PRECIOS DIFERENTES (${priceDiffs.length}):`);
      for (const p of priceDiffs) console.log(p);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
