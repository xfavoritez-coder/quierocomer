import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  
  // Find all category slugs in the NUXT data - they appear as route segments
  const catMatches = [...html.matchAll(/"slug"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  console.log("Category slugs found:", [...new Set(catMatches)]);

  // Also find categories by name
  const nameMatches = [...html.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const uniqueNames = [...new Set(nameMatches)].filter(n => n.length > 2 && n.length < 60);
  console.log("\nAll names:", uniqueNames);
}
main().catch(e => { console.error(e); process.exit(1); });
