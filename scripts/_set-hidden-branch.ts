/**
 * Marca/desmarca una sucursal como oculta (hiddenBranch).
 * Uso: npx tsx scripts/_set-hidden-branch.ts <slug> [true|false]
 *
 * La sucursal oculta:
 * - NO aparece en el selector de sucursales de la marca
 * - NO aparece en el sitemap, mapa de locales ni feed
 * - SÍ funciona normalmente por URL directa (toma pedidos, panel, etc.)
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const slug = process.argv[2];
  const hidden = process.argv[3] !== "false"; // default: true

  if (!slug) {
    console.log("Uso: npx tsx scripts/_set-hidden-branch.ts <slug> [true|false]");
    return;
  }

  const r = await p.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, ecommerceStoreConfig: true },
  });

  if (!r) {
    console.log(`✗ No se encontró el local: ${slug}`);
    return;
  }

  const cfg = (r.ecommerceStoreConfig || {}) as Record<string, unknown>;
  cfg.hiddenBranch = hidden;

  const updated = await p.restaurant.update({
    where: { slug },
    data: { ecommerceStoreConfig: cfg as any, isActive: true },
    select: { name: true, slug: true, isActive: true, ecommerceStoreConfig: true },
  });

  const newCfg = updated.ecommerceStoreConfig as any;
  console.log(`✓ ${updated.name} (${updated.slug})`);
  console.log(`  isActive: ${updated.isActive}`);
  console.log(`  hiddenBranch: ${newCfg?.hiddenBranch}`);
  console.log(`  → ${hidden ? "Oculta de listados públicos, pero funciona por URL directa" : "Visible en todos los listados"}`);
}

main().finally(() => p.$disconnect());
