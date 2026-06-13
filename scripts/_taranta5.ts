import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  
  // Extract __NUXT__ variable
  const match = html.match(/window\.__NUXT__\s*=\s*(\(function[\s\S]*?\})\s*\)\s*\(/);
  if (!match) {
    // Try alternate pattern
    const match2 = html.match(/window\.__NUXT__\s*=\s*([\s\S]{0,50000})/);
    if (match2) {
      const snippet = match2[1].substring(0, 2000);
      console.log("NUXT start:", snippet);
    }
    return;
  }
}
main().catch(e => { console.error(e); process.exit(1); });
