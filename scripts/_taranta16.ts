import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  // OlaClick uses Nuxt.js. The API calls are made from the JS bundle.
  // Let's find the JS bundle and look for the API endpoint
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  
  // Find JS bundle URLs
  const jsMatches = [...html.matchAll(/src="([^"]*\.js[^"]*)"/g)].map(m => m[1]);
  console.log("JS bundles:", jsMatches.length);
  
  // Find the one that likely contains API calls (usually app or vendor)
  const appBundle = jsMatches.find(j => j.includes("app") || j.includes("main"));
  console.log("App bundle:", appBundle);
  
  // Try fetching common OlaClick API patterns with different auth
  const companyId = "85a42530-dd4b-11eb-8e62-25fca997c4d1";
  const token = "tarantarestaurante";
  
  const endpoints = [
    `https://api.olaclick.com/api/v2/companies/${token}/product-categories`,
    `https://api.olaclick.com/api/v2/${token}/product-categories`,
    `https://api-public.olaclick.com/api/v2/product-categories?token=${token}`,
    `https://api.olaclick.com/api/public/v2/product-categories?token=${token}`,
    `https://api.olaclick.com/public/api/v2/product-categories?company=${token}`,
    // Try with headers like a browser
  ];
  
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
          Origin: "https://tarantarestaurante.ola.click",
          Referer: "https://tarantarestaurante.ola.click/products",
        },
      });
      console.log(`${r.status} ${url}`);
      if (r.ok) {
        const t = await r.text();
        console.log("  →", t.substring(0, 300));
      }
    } catch (e: any) {
      console.log(`ERR ${url}: ${e.message}`);
    }
  }

  // Let's try the sitemap
  for (const path of ["/sitemap.xml", "/robots.txt"]) {
    try {
      const r = await fetch(`https://tarantarestaurante.ola.click${path}`);
      if (r.ok) {
        const t = await r.text();
        console.log(`\n${path}:`);
        console.log(t.substring(0, 1000));
      }
    } catch {}
  }
}
main().catch(e => { console.error(e); process.exit(1); });
