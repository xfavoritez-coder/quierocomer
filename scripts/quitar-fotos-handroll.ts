import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const hr = await p.local.findFirst({ where: { nombre: { contains: "hand roll", mode: "insensitive" } }, select: { id: true } });
  if (!hr) return;

  const platos = await p.menuItem.findMany({
    where: { localId: hr.id, imagenUrl: { not: null } },
    select: { id: true, nombre: true },
    orderBy: { createdAt: "asc" },
  });

  const total = platos.length;
  const quitar = Math.round(total * 0.3);

  // Shuffle and pick 30%
  const shuffled = platos.sort(() => Math.random() - 0.5);
  const toRemove = shuffled.slice(0, quitar);

  for (const p2 of toRemove) {
    await p.menuItem.update({ where: { id: p2.id }, data: { imagenUrl: null } });
  }

  console.log(`Hand Roll: ${total} con foto → quitadas ${toRemove.length} fotos (30%)`);
  toRemove.forEach(d => console.log(`  ${d.nombre}`));
}
main().finally(() => p.$disconnect());
