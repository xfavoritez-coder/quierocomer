import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  // OlaClick stores have an API. The company ID is in the NUXT data
  // From earlier: id: "85a42530-dd4b-11eb-8e62-25fca997c4d1"
  const companyId = "85a42530-dd4b-11eb-8e62-25fca997c4d1";
  
  // Try OlaClick public API endpoints
  const endpoints = [
    `https://api.olaclick.com/api/v2/company/${companyId}/categories`,
    `https://api.olaclick.com/api/v2/companies/${companyId}/categories`,
    `https://api.olaclick.com/api/v1/company/${companyId}/categories`,
    `https://api.olaclick.com/v2/company/${companyId}/categories`,
    `https://api.olaclick.com/api/company/${companyId}/product-categories`,
    `https://tarantarestaurante.ola.click/api/categories`,
    `https://tarantarestaurante.ola.click/_nuxt/categories`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      console.log(`${res.status} ${url}`);
      if (res.ok) {
        const text = await res.text();
        console.log("  →", text.substring(0, 500));
      }
    } catch (e: any) {
      console.log(`ERR ${url}: ${e.message}`);
    }
  }

  // Also try fetching the NUXT data more carefully
  console.log("\n--- Fetching raw HTML for product category data ---");
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  
  // Find product_categories or similar data
  const patterns = [
    /product.?categor[^;]{0,2000}/gi,
    /category_?id[^;]{0,200}/gi,
  ];
  for (const p of patterns) {
    const matches = [...html.matchAll(p)];
    if (matches.length) {
      console.log(`\nPattern ${p}:`);
      for (const m of matches.slice(0, 3)) console.log("  ", m[0].substring(0, 200));
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
