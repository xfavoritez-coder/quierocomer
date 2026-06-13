import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  
  // Find where "Antipastos" appear and what surrounds them
  const indices = [];
  let pos = 0;
  while ((pos = html.indexOf("ntipastos", pos)) !== -1) {
    indices.push(pos);
    pos += 10;
  }
  console.log(`Found "ntipastos" at ${indices.length} positions`);
  for (const i of indices.slice(0, 3)) {
    console.log(`\n--- Position ${i} ---`);
    console.log(html.substring(Math.max(0, i - 100), i + 100));
  }

  // Search for OlaClick API calls - they might load categories via API
  const apiMatches = [...html.matchAll(/api[^"']*categor[^"']*/gi)];
  console.log("\nAPI category references:", apiMatches.map(m => m[0]));
  
  // Look for the product data with category references
  const productSections = [...html.matchAll(/product_category[^}]{0,200}/gi)];
  console.log("\nProduct category data:", productSections.slice(0, 5).map(m => m[0]));
}
main().catch(e => { console.error(e); process.exit(1); });
