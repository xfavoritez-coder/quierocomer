import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  
  // Find all category-view-handler sections
  const catMatches = [...html.matchAll(/class="category text-truncate-1-line"[^>]*>\s*([^<]+)/g)];
  console.log("Categories rendered in HTML:");
  for (const m of catMatches) console.log("  -", m[1].trim());

  // Find all product links
  const prodLinks = [...html.matchAll(/href="\/([a-z0-9-]+)\/([a-z0-9-]+)"/g)];
  const catSlugs = new Set<string>();
  for (const m of prodLinks) {
    if (m[1] !== "products" && m[1] !== "profile" && m[1] !== "es") catSlugs.add(m[1]);
  }
  console.log("\nCategory slugs from product links:");
  for (const s of catSlugs) console.log("  -", s);

  // Find infinite-products sections (these are the lazy-loaded sections)
  const sectionMatches = [...html.matchAll(/infinite-products[^>]*>([\s\S]{0,500}?)<\/div>/g)];
  console.log("\nInfinite products sections:", sectionMatches.length);
}
main().catch(e => { console.error(e); process.exit(1); });
