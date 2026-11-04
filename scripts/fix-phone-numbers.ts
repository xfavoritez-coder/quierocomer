import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

// Normaliza un número de teléfono chileno:
// - "+56..." → ya está bien, retorna igual
// - "56XXXXXXXXX" (11 dígitos) → "+56XXXXXXXXX"
// - "9XXXXXXXX" (9 dígitos, empieza en 9) → "+569XXXXXXXX"
// - cualquier otro → lo deja como está (puede ser extranjero, fijo, etc.)
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return raw ?? null;
  const s = raw.replace(/\s+/g, "").trim();
  if (!s) return s;
  if (s.startsWith("+")) return s; // ya tiene código de país
  if (/^56\d{9}$/.test(s)) return "+" + s; // 56XXXXXXXXX
  if (/^9\d{8}$/.test(s)) return "+56" + s; // 9XXXXXXXX (móvil chileno)
  return raw; // desconocido — no tocar
}

async function main() {
  const DRY = process.argv.includes("--dry");
  if (DRY) console.log("=== DRY RUN — no se modificará nada ===\n");
  else console.log("=== APLICANDO cambios en la BD ===\n");

  let totalFixed = 0;

  // ── 1. OnlineOrder.customerPhone ─────────────────────────────────────
  {
    const rows = await p.onlineOrder.findMany({ select: { id: true, customerPhone: true } });
    const toFix = rows.filter(r => normalizePhone(r.customerPhone) !== r.customerPhone);
    console.log(`OnlineOrder: ${rows.length} registros, ${toFix.length} a corregir`);
    for (const r of toFix) {
      const fixed = normalizePhone(r.customerPhone)!;
      console.log(`  [OnlineOrder ${r.id}] "${r.customerPhone}" → "${fixed}"`);
      if (!DRY) await p.onlineOrder.update({ where: { id: r.id }, data: { customerPhone: fixed } });
    }
    totalFixed += toFix.length;
  }

  // ── 2. PosOrder.customerPhone ─────────────────────────────────────────
  {
    const rows = await p.posOrder.findMany({
      where: { customerPhone: { not: "" } },
      select: { id: true, customerPhone: true },
    });
    const toFix = rows.filter(r => normalizePhone(r.customerPhone) !== r.customerPhone);
    console.log(`\nPosOrder: ${rows.length} con teléfono, ${toFix.length} a corregir`);
    for (const r of toFix) {
      const fixed = normalizePhone(r.customerPhone)!;
      console.log(`  [PosOrder ${r.id}] "${r.customerPhone}" → "${fixed}"`);
      if (!DRY) await p.posOrder.update({ where: { id: r.id }, data: { customerPhone: fixed } });
    }
    totalFixed += toFix.length;
  }

  // ── 3. QueueEntry.phone ───────────────────────────────────────────────
  {
    const rows = await p.queueEntry.findMany({ select: { id: true, phone: true } });
    const toFix = rows.filter(r => normalizePhone(r.phone) !== r.phone);
    console.log(`\nQueueEntry: ${rows.length} registros, ${toFix.length} a corregir`);
    for (const r of toFix) {
      const fixed = normalizePhone(r.phone)!;
      console.log(`  [QueueEntry ${r.id}] "${r.phone}" → "${fixed}"`);
      if (!DRY) await p.queueEntry.update({ where: { id: r.id }, data: { phone: fixed } });
    }
    totalFixed += toFix.length;
  }

  // ── 4. LoyaltyMember.phone ────────────────────────────────────────────
  {
    const rows = await p.loyaltyMember.findMany({
      where: { phone: { not: null } },
      select: { id: true, phone: true },
    });
    const toFix = rows.filter(r => normalizePhone(r.phone) !== r.phone);
    console.log(`\nLoyaltyMember: ${rows.length} con teléfono, ${toFix.length} a corregir`);
    for (const r of toFix) {
      const fixed = normalizePhone(r.phone);
      console.log(`  [LoyaltyMember ${r.id}] "${r.phone}" → "${fixed}"`);
      if (!DRY) await p.loyaltyMember.update({ where: { id: r.id }, data: { phone: fixed } });
    }
    totalFixed += toFix.length;
  }

  // ── 5. EcommerceCouponUse.customerPhone ───────────────────────────────
  {
    const rows = await p.ecommerceCouponUse.findMany({
      where: { customerPhone: { not: null } },
      select: { id: true, customerPhone: true },
    });
    const toFix = rows.filter(r => normalizePhone(r.customerPhone) !== r.customerPhone);
    console.log(`\nEcommerceCouponUse: ${rows.length} con teléfono, ${toFix.length} a corregir`);
    for (const r of toFix) {
      const fixed = normalizePhone(r.customerPhone);
      console.log(`  [CouponUse ${r.id}] "${r.customerPhone}" → "${fixed}"`);
      if (!DRY) await p.ecommerceCouponUse.update({ where: { id: r.id }, data: { customerPhone: fixed } });
    }
    totalFixed += toFix.length;
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Total a corregir: ${totalFixed}`);
  if (DRY) console.log("Ejecuta sin --dry para aplicar los cambios.");
  else console.log("Listo.");
}

main().catch(console.error).finally(() => p.$disconnect());
