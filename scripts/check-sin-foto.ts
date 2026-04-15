import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const sinFoto = await p.menuItem.findMany({ where: { OR: [{ imagenUrl: null }, { imagenUrl: "" }] }, select: { nombre: true, categoria: true, local: { select: { nombre: true } } }, orderBy: { local: { nombre: "asc" } } });
  console.log("Platos sin foto:", sinFoto.length);
  let currentLocal = "";
  sinFoto.forEach(d => {
    if (d.local.nombre !== currentLocal) { currentLocal = d.local.nombre; console.log(`\n${currentLocal}:`); }
    console.log(`  [${d.categoria}] ${d.nombre}`);
  });
  const total = await p.menuItem.count();
  const conFoto = await p.menuItem.count({ where: { imagenUrl: { not: null } } });
  console.log(`\nTotal: ${total} | Con foto: ${conFoto} | Sin foto: ${sinFoto.length}`);
}
main().finally(() => p.$disconnect());
