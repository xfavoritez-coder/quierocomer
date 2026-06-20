import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

// Nombres exactos de Da Noi que son productos crudos/granel para hacer en casa
const DA_NOI_HIDE = [
  "Ravioles de Ricotta con Salsa",   // pasta cruda (la del URL del usuario)
  "Ravioli de Carne 48 Un",          // bulk congelado
  "Medialunas Artesanales para Hornear",
  "Fetuccini de Huevo 500 Grs",
  "Fetuccini de Huevo 1 kg",
  "Gnocchi de Papa 1 kg",
  "Gnocchi de Papa 500 Grs",
  "Queso Parmesano Rallado 50 Grs",
  "Queso Parmesano Rallado 100 Grs",
  "Queso Parmesano Rallado 200 Grs",
  "Salsa Pomodoro 500 Cc",
  "Salsa Pomodoro 1 Litro",
  "Salsa Alfredo 500 Cc",
  "Salsa Alfredo 1 Litro",
  "Salsa Bolognesa 500 Cc",
  "Salsa Bolognesa 1 Litro",
  "Salsa Pesto 250 Cc",
  "Salsa Bechamel 500 Cc",
  "Salsa Bechamel 1 Litro",
  "Salsa Rosa 500 Cc",
  "Salsa Rosa 1 Litro",
];

async function hideByNames(restaurantSlug: string, names: string[]) {
  const r = await p.restaurant.findUnique({ where: { slug: restaurantSlug }, select: { id: true, name: true } });
  if (!r) { console.log(`⚠ Restaurante no encontrado: ${restaurantSlug}`); return; }
  console.log(`\n${r.name}:`);
  for (const name of names) {
    const d = await p.dish.findFirst({ where: { restaurantId: r.id, name } });
    if (!d) { console.log(`  ⚠ No encontrado: "${name}"`); continue; }
    await p.dish.update({ where: { id: d.id }, data: { hiddenFromFeed: true } });
    console.log(`  ✓ Oculto: "${name}"`);
  }
}

async function hideByName(restaurantSlug: string, name: string) {
  await hideByNames(restaurantSlug, [name]);
}

async function main() {
  await hideByNames("ristorante-y-trattoria-da-noi", DA_NOI_HIDE);
  await hideByName("tricahue", "Tiradito de Trucha");
  await p.$disconnect();
}
main().catch(console.error);
