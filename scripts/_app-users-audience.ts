// One-off: construye la Custom Audience "Usuarios de la app" (clientes con pedidos
// fromApp=true) de Hand Roll y la sube a Meta. Para EXCLUIRLA de la campaña de la app
// (no mostrar la promo app-exclusive a quien ya tiene la app). Idempotente: guarda el id
// en ecommerceConfig.meta.audiences.appUsers. Correr con:
//   npx tsx --env-file=.env.local scripts/_app-users-audience.ts
import { PrismaClient } from "@prisma/client";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";

// Conexión DIRECTA (no el pooler 6543, que cuelga en scripts batch)
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
import { decryptEcommerceSecrets } from "@/lib/ecommerce/configSecrets";
import { phoneKey } from "@/lib/ecommerce/phoneCL";
import { createCustomAudience, replaceAudienceUsers, type AudienceMember } from "@/lib/meta/audiences";

const AD_ACCOUNT = "569387888160232"; // Hand Roll 2.0

async function main() {
  // 1) Ubicar el restaurante Hand Roll por su adAccountId en la config
  const candidates = await prisma.restaurant.findMany({
    where: { name: { contains: "Hand Roll", mode: "insensitive" } },
    select: { id: true, name: true, ecommerceConfig: true },
  });
  const r = candidates.find((c) => parseEcommerceConfig(c.ecommerceConfig).meta?.adAccountId === AD_ACCOUNT);
  if (!r) { console.error("No encontré el local Hand Roll con adAccountId", AD_ACCOUNT, "— candidatos:", candidates.map(c => c.name)); return; }
  console.log("Local:", r.name, r.id);

  const rawCfg = parseEcommerceConfig(r.ecommerceConfig); // meta.adsToken aún cifrado
  const meta = rawCfg.meta || {};
  const token = decryptEcommerceSecrets(rawCfg).meta?.adsToken || process.env.META_ADS_TOKEN || "";
  if (!token) { console.error("Falta token de ads (meta.adsToken cifrado o env META_ADS_TOKEN)"); return; }

  // 2) Clientes con AL MENOS un pedido fromApp=true (tienen la app)
  const orders = await prisma.onlineOrder.findMany({
    where: { restaurantId: r.id, fromApp: true, NOT: { paymentStatus: "failed" }, status: { not: "CANCELLED" } },
    select: { customerPhone: true, customerEmail: true },
    take: 100000,
  });
  const byKey = new Map<string, AudienceMember>();
  for (const o of orders) {
    const k = phoneKey(o.customerPhone);
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, { phone: o.customerPhone, email: o.customerEmail || null });
  }
  const members = [...byKey.values()];
  console.log(`Pedidos app: ${orders.length} → clientes únicos (por teléfono): ${members.length}`);
  if (members.length === 0) { console.log("No hay usuarios de la app todavía; no se crea audiencia."); return; }
  if (process.env.DRY === "1") { console.log("DRY RUN: no se crea ni sube nada. adAccount OK, token presente:", !!token); return; }

  // 3) Crear la audiencia (o reutilizar si ya existe) y subir
  const audiences = { ...(meta.audiences || {}) } as Record<string, string | undefined>;
  let id = audiences.appUsers;
  if (!id) {
    const c = await createCustomAudience(AD_ACCOUNT, token, `${r.name} · Usuarios de la app`,
      "Clientes que han pedido desde la app nativa (fromApp). Para EXCLUIR de campañas de descarga de la app.");
    if (!c.ok || !c.id) { console.error("Error creando audiencia:", c.error); return; }
    id = c.id; audiences.appUsers = id;
    console.log("Audiencia creada:", id);
  } else {
    console.log("Audiencia existente, refrescando:", id);
  }
  const up = await replaceAudienceUsers(id, token, members);
  if (!up.ok) { console.error("Error subiendo miembros:", up.error); return; }
  console.log("Subidos:", up.count);

  // 4) Guardar el id en la config SIN tocar el token cifrado
  const nextCfg = { ...rawCfg, meta: { ...meta, audiences } };
  await prisma.restaurant.update({ where: { id: r.id }, data: { ecommerceConfig: nextCfg as object } });
  console.log("Listo. meta.audiences.appUsers =", id);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
