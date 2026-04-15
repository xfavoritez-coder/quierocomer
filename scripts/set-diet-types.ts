import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // Kojo, Vegan Mobile, Katako = all VEGAN
  const veganLocals = await p.local.findMany({
    where: { OR: [
      { nombre: { contains: "kojo", mode: "insensitive" } },
      { nombre: { contains: "vegan mobile", mode: "insensitive" } },
      { nombre: { contains: "katako", mode: "insensitive" } },
    ]},
    select: { id: true, nombre: true },
  });

  for (const local of veganLocals) {
    const r = await p.menuItem.updateMany({ where: { localId: local.id }, data: { dietType: "VEGAN" } });
    console.log(`${local.nombre}: ${r.count} platos → VEGAN`);
  }

  // Hand Roll — mark vegano ones by name
  const hr = await p.local.findFirst({ where: { nombre: { contains: "hand roll", mode: "insensitive" } }, select: { id: true } });
  if (hr) {
    const veganDishes = await p.menuItem.updateMany({
      where: {
        localId: hr.id,
        OR: [
          { nombre: { contains: "vegano", mode: "insensitive" } },
          { nombre: { contains: "vegana", mode: "insensitive" } },
          { nombre: { contains: "vegetariano", mode: "insensitive" } },
          { nombre: { contains: "vegetariana", mode: "insensitive" } },
        ],
      },
      data: { dietType: "VEGAN" },
    });
    console.log(`Hand Roll: ${veganDishes.count} platos veganos/vegetarianos marcados`);

    // Rest of Hand Roll = OMNIVORE (default, already set)
    const total = await p.menuItem.count({ where: { localId: hr.id } });
    console.log(`Hand Roll: ${total} total, ${total - veganDishes.count} omnívoros`);
  }

  // Nana's Fruit — mostly omnivore, check for any vegano
  const nana = await p.local.findFirst({ where: { nombre: { contains: "nana", mode: "insensitive" } }, select: { id: true, nombre: true } });
  if (nana) {
    const total = await p.menuItem.count({ where: { localId: nana.id } });
    console.log(`${nana.nombre}: ${total} platos (OMNIVORE por defecto)`);
  }

  // Summary
  const summary = await p.menuItem.groupBy({ by: ["dietType"], _count: true });
  console.log("\nResumen:");
  summary.forEach(s => console.log(`  ${s.dietType}: ${s._count}`));
}

main().finally(() => p.$disconnect());
