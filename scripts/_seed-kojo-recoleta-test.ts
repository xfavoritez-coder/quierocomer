/**
 * Crea pedidos y mesas ficticias para Kojo Sushi Recoleta (localhost demo).
 * Para borrar todo después: npx tsx scripts/_seed-kojo-recoleta-test.ts --delete
 *
 * PosOrders (retiro/delivery) → DB via Prisma
 * Mesas ocupadas → Supabase pos_events (igual que el POS real)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SLUG = "kojo-sushi-recoleta";
const DEVICE_ID = "seed-device-test";
const USER_ID = "seed-user-test";
// Tag para identificar y borrar fácil
const TAG = "SEED_TEST_KOJO_RECOLETA";

// ── Datos ficticios ─────────────────────────────────────────────────

const CLIENTES_RETIRO = [
  { name: "Camila Torres", phone: "+56912345601" },
  { name: "Diego Fernández", phone: "+56912345602" },
  { name: "Valentina Rojas", phone: "+56912345603" },
  { name: "Matías Silva", phone: "+56912345604" },
  { name: "Antonia López", phone: "+56912345605" },
];

const CLIENTES_DELIVERY = [
  { name: "Sebastián Muñoz", phone: "+56912345611", address: "Av. Recoleta 1234, Recoleta" },
  { name: "Isidora Vega", phone: "+56912345612", address: "Av. Einstein 550, Recoleta" },
  { name: "Nicolás Herrera", phone: "+56912345613", address: "Av. Independencia 2100, Independencia" },
  { name: "Javiera Castillo", phone: "+56912345614", address: "Av. Perú 1480, Recoleta" },
  { name: "Tomás Morales", phone: "+56912345615", address: "Santa Filomena 231, Providencia" },
];

const ITEMS_RETIRO = [
  [{ name: "Martes de Suprema 🔥", qty: 1, price: 19900 }, { name: "Coca-Cola 350ml", qty: 2, price: 1800 }],
  [{ name: "Miércoles Mix 🔥", qty: 1, price: 17900 }],
  [{ name: "Deluxe 60 piezas", qty: 1, price: 29900 }, { name: "Sake caliente", qty: 1, price: 3500 }],
  [{ name: "Suprema 40 piezas", qty: 2, price: 24900 }],
  [{ name: "Miércoles Mix 🔥", qty: 1, price: 17900 }, { name: "Agua mineral", qty: 1, price: 1500 }],
];

const ITEMS_DELIVERY = [
  [{ name: "Deluxe 60 piezas", qty: 1, price: 29900 }, { name: "Jugo de naranja", qty: 2, price: 2200 }],
  [{ name: "Martes de Suprema 🔥", qty: 2, price: 19900 }],
  [{ name: "Suprema 40 piezas", qty: 1, price: 24900 }, { name: "Coca-Cola 350ml", qty: 3, price: 1800 }],
  [{ name: "Miércoles Mix 🔥", qty: 1, price: 17900 }, { name: "Sake caliente", qty: 2, price: 3500 }],
  [{ name: "Deluxe 60 piezas", qty: 2, price: 29900 }],
];

const STAGES = ["preparing", "ready", "preparing", "out_for_delivery", "preparing"];

const MESAS_DEMO = [
  { tableId: "mesa-test-1", tableNumber: 2, tableLabel: "Mesa 2", covers: 4, garzon: "Rodrigo" },
  { tableId: "mesa-test-2", tableNumber: 5, tableLabel: "Mesa 5", covers: 2, garzon: "Camila" },
  { tableId: "mesa-test-3", tableNumber: 8, tableLabel: "Mesa 8", covers: 6, garzon: "Rodrigo" },
];

// ── DELETE ──────────────────────────────────────────────────────────

async function deleteSeedData(restaurantId: string) {
  // Borrar PosOrders por tag en vendorName
  const del = await prisma.posOrder.deleteMany({
    where: { restaurantId, vendorName: TAG },
  });
  console.log(`🗑  Borrados ${del.count} PosOrders de prueba`);

  // Borrar pos_events de prueba por device_id
  const delEvt = await prisma.posEvent.deleteMany({
    where: { restaurant_id: restaurantId, device_id: DEVICE_ID },
  });
  console.log(`🗑  Borrados ${delEvt.count} pos_events de mesas de prueba`);

  console.log("\n✅ Todo borrado. Recarga el POS para ver los cambios.");
}

// ── SEED ────────────────────────────────────────────────────────────

async function seed(restaurantId: string) {
  const now = Date.now();
  const orders: any[] = [];

  // 5 retiro
  for (let i = 0; i < 5; i++) {
    const c = CLIENTES_RETIRO[i];
    const items = ITEMS_RETIRO[i];
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const paid = i < 2; // primeros 2 pagados
    orders.push({
      restaurantId,
      externalId: `test-retiro-${uuidv4().slice(0, 8)}`,
      provider: "test",
      saleType: "pickup",
      isDelivery: false,
      opsStage: STAGES[i],
      customerName: c.name,
      customerPhone: c.phone,
      addressLine: "",
      totalAmount: total,
      paidAmount: paid ? total : 0,
      deliveryFee: 0,
      items,
      vendorName: TAG,
      createdAt: new Date(now - (i + 1) * 8 * 60_000), // escalonados cada 8 min
    });
  }

  // 5 delivery
  for (let i = 0; i < 5; i++) {
    const c = CLIENTES_DELIVERY[i];
    const items = ITEMS_DELIVERY[i];
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const fee = 2500;
    const paid = i < 2;
    orders.push({
      restaurantId,
      externalId: `test-delivery-${uuidv4().slice(0, 8)}`,
      provider: "test",
      saleType: "delivery",
      isDelivery: true,
      opsStage: STAGES[i],
      customerName: c.name,
      customerPhone: c.phone,
      addressLine: c.address,
      totalAmount: total + fee,
      paidAmount: paid ? total + fee : 0,
      deliveryFee: fee,
      items,
      vendorName: TAG,
      createdAt: new Date(now - (i + 1) * 6 * 60_000),
    });
  }

  const created = await prisma.posOrder.createMany({ data: orders });
  console.log(`✅ Creados ${created.count} pedidos de prueba (retiro + delivery)`);

  // ── Mesas: inyectar pos_events en Supabase ─────────────────────

  // Primero necesitamos que las mesas existan en pos_events (mesa_created)
  // y luego account_opened
  const events: any[] = [];

  for (const mesa of MESAS_DEMO) {
    const openedAt = new Date(now - (MESAS_DEMO.indexOf(mesa) + 1) * 25 * 60_000).toISOString();
    const accountId = uuidv4();

    // account_opened
    events.push({
      event_id: uuidv4(),
      device_id: DEVICE_ID,
      user_id: USER_ID,
      restaurant_id: restaurantId,
      created_at_local: openedAt,
      type: "account_opened",
      payload: {
        account_id: accountId,
        account_type: "mesa",
        table_id: mesa.tableId,
        table_number: mesa.tableNumber,
        table_label: mesa.tableLabel,
        covers: mesa.covers,
        opened_by_name: mesa.garzon,
      },
    });

    // round_sent con ítems
    events.push({
      event_id: uuidv4(),
      device_id: DEVICE_ID,
      user_id: USER_ID,
      restaurant_id: restaurantId,
      created_at_local: new Date(new Date(openedAt).getTime() + 2 * 60_000).toISOString(),
      type: "round_sent",
      payload: {
        account_id: accountId,
        items: [
          { id: uuidv4(), productId: "p1", name: "Suprema 40 piezas", price: 24900, quantity: 1 },
          { id: uuidv4(), productId: "p2", name: "Sake caliente", price: 3500, quantity: 2 },
        ],
        total: 31900,
      },
    });
  }

  // Insertar via Prisma (mismo DB que Supabase, evita cache del PostgREST)
  await prisma.posEvent.createMany({ data: events, skipDuplicates: true });
  console.log(`✅ Creados ${events.length} pos_events para ${MESAS_DEMO.length} mesas ocupadas`);

  console.log("\nPara borrar todo después:");
  console.log("  npx tsx scripts/_seed-kojo-recoleta-test.ts --delete\n");
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const doDelete = process.argv.includes("--delete");

  const rest = await prisma.restaurant.findUnique({
    where: { slug: SLUG },
    select: { id: true, name: true },
  });
  if (!rest) { console.error(`No se encontró restaurante con slug "${SLUG}"`); process.exit(1); }
  console.log(`\n🍣 ${rest.name} (${rest.id})\n`);

  if (doDelete) {
    await deleteSeedData(rest.id);
  } else {
    await seed(rest.id);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
