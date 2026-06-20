/**
 * Popula Restaurant.website con la cartaUrl de Lead cuando el local
 * viene de una plataforma que PERMITE pedir online (Rappi, UberEats, web propia, etc.)
 * Excluye plataformas de menú-solo: Toteat, Gourmedia, Fudo, Heyzine, Canva, Drive, etc.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const MENU_ONLY_DOMAINS = new Set([
  "toteat.com", "toteat.app", "gourmedia.cl", "fu.do", "heyzine.com",
  "canva.com", "drive.google.com", "docs.google.com", "qrpro.io",
  "micartaqr.cl", "olaclick.com", "queresto.com", "flipsnack.com",
  "yumpu.com", "issuu.com", "gourmetclick.cl", "lacarte.cl", "share.google",
  "instagram.com", "facebook.com", "twitter.com", "tiktok.com",
  "linktr.ee", "linktree.com",
]);

function isOrderable(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return !MENU_ONLY_DOMAINS.has(host);
  } catch { return false; }
}

async function main() {
  const leads = await p.lead.findMany({
    where: { cartaUrl: { not: null }, generatedSlug: { not: null } },
    select: { cartaUrl: true, generatedSlug: true },
  });

  console.log(`Leads con cartaUrl: ${leads.length}`);
  let updated = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (!lead.cartaUrl || !lead.generatedSlug) continue;
    if (!isOrderable(lead.cartaUrl)) { skipped++; continue; }

    const restaurant = await p.restaurant.findUnique({
      where: { slug: lead.generatedSlug },
      select: { id: true, name: true, website: true },
    });

    if (!restaurant) continue;
    if (restaurant.website) {
      console.log(`  ⚑ Ya tiene website: ${restaurant.name} → ${restaurant.website}`);
      continue;
    }

    await p.restaurant.update({
      where: { id: restaurant.id },
      data: { website: lead.cartaUrl },
    });
    console.log(`  ✓ ${restaurant.name} → ${lead.cartaUrl}`);
    updated++;
  }

  console.log(`\nListo: ${updated} actualizados, ${skipped} omitidos (menú-solo)`);
  await p.$disconnect();
}
main().catch(console.error);
