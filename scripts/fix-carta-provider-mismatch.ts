/**
 * Fix cartaProvider mismatches: restaurants whose website URL points to
 * Justo/Mercat but have a wrong cartaProvider (e.g. 'Fudo').
 *
 * npx tsx scripts/fix-carta-provider-mismatch.ts          # dry run
 * DRY_RUN=0 npx tsx scripts/fix-carta-provider-mismatch.ts # apply
 */
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });
const DRY_RUN = process.env.DRY_RUN !== "0";

// URL patterns → correct provider
const PROVIDER_BY_DOMAIN: [RegExp, string][] = [
  [/getjusto\.com|justo\.cl|justo\.pe/i, "Justo"],
  [/mercat\.cl|mer-cat\.com/i, "Mercat"],
  [/rappi\.com|rappi\.cl/i, "Rappi"],
  [/ubereats\.com/i, "UberEats"],
];

const ORDERING_PROVIDERS = new Set(["Justo", "Mercat", "Rappi", "UberEats"]);

function detectProvider(url: string): string | null {
  for (const [pattern, provider] of PROVIDER_BY_DOMAIN) {
    if (pattern.test(url)) return provider;
  }
  return null;
}

async function main() {
  const { rows } = await pool.query(
    `SELECT id, slug, name, "cartaProvider", website, "websiteIsOrderUrl"
     FROM "Restaurant"
     WHERE "isDemo" = false AND "isActive" = true AND website IS NOT NULL`
  );

  let fixed = 0;

  for (const r of rows) {
    if (!r.website) continue;
    const detected = detectProvider(r.website);
    if (!detected || r.cartaProvider === detected) continue;

    const isOrder = ORDERING_PROVIDERS.has(detected);
    console.log(
      `  [${r.slug}] "${r.name}" — provider: ${r.cartaProvider ?? "(null)"} → ${detected} | website: ${r.website}`
    );

    if (!DRY_RUN) {
      await pool.query(
        `UPDATE "Restaurant" SET "cartaProvider" = $1, "websiteIsOrderUrl" = $2 WHERE id = $3`,
        [detected, isOrder, r.id]
      );
    }
    fixed++;
  }

  console.log(`\n${DRY_RUN ? "[DRY RUN]" : "[APPLIED]"} ${fixed} restaurants with wrong cartaProvider`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
