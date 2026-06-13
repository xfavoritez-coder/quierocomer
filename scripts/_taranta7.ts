import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  
  // The NUXT data is a self-executing function. Let's find category data patterns
  // OlaClick typically has categories in the data as objects with slug/name
  
  // Search for "antipastos" to find the pattern around known categories
  const idx = html.indexOf("antipastos");
  if (idx > 0) {
    console.log("Context around 'antipastos':");
    console.log(html.substring(Math.max(0, idx - 200), idx + 200));
    console.log("\n---\n");
  }
  
  // Search for product category patterns - OlaClick uses "categories" array
  const catIdx = html.indexOf("categories");
  if (catIdx > 0) {
    console.log("Context around 'categories':");
    console.log(html.substring(catIdx, catIdx + 500));
  }

  // Find all href-like patterns pointing to product pages
  const hrefMatches = [...html.matchAll(/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)/g)]
    .map(m => m[1])
    .filter(s => s.length > 3 && s !== "products");
  const slugCounts = new Map<string, number>();
  for (const s of hrefMatches) slugCounts.set(s, (slugCounts.get(s) || 0) + 1);
  const sorted = [...slugCounts.entries()].sort((a,b) => b[1] - a[1]).slice(0, 30);
  console.log("\nMost frequent path prefixes (likely categories):");
  for (const [slug, count] of sorted) console.log(`  ${slug}: ${count}`);
}
main().catch(e => { console.error(e); process.exit(1); });
