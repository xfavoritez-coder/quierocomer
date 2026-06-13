import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { extractOlaClick } from "../src/lib/extractors/olaclick";

async function main() {
  const url = "https://tarantarestaurante.ola.click/products";
  console.log("Extrayendo carta de Taranta Chicureo desde OlaClick...\n");
  const result = await extractOlaClick(url);
  
  console.log("\n=== RESULTADO ===");
  console.log("Restaurant:", result.restaurantName);
  console.log("Logo:", result.logoUrl);
  console.log("Total platos:", result.dishes.length);
  
  const cats = new Map<string, typeof result.dishes>();
  for (const d of result.dishes) {
    const cat = d.category || "Sin categoría";
    if (!cats.has(cat)) cats.set(cat, []);
    cats.get(cat)!.push(d);
  }
  
  for (const [cat, dishes] of cats) {
    console.log(`\n  --- ${cat} (${dishes.length} platos) ---`);
    for (const d of dishes) {
      const photo = d.imageUrl ? "📷" : "  ";
      console.log(`  ${photo} ${d.name} | $${d.price} | ${d.description?.substring(0, 50) || "-"}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
