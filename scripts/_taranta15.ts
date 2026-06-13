import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  
  const start = html.indexOf("window.__NUXT__");
  const scriptEnd = html.indexOf("</script>", start);
  const nuxtCode = html.substring(start, scriptEnd);
  const fn = new Function("return " + nuxtCode.replace("window.__NUXT__=", "") + ";");
  const data = fn();
  
  const token = data?.state?.company?.token;
  console.log("Company token:", token);
  
  // Try using the token to get categories from OlaClick API
  const apiBase = "https://api.olaclick.com";
  const endpoints = [
    `/api/v2/product-categories?token=${token}`,
    `/api/v2/products?token=${token}`,
    `/api/v2/product-categories?company_token=${token}`,
    `/api/v1/product-categories?token=${token}`,
  ];
  
  for (const ep of endpoints) {
    try {
      const r = await fetch(`${apiBase}${ep}`, { headers: { Accept: "application/json" } });
      console.log(`\n${r.status} ${ep}`);
      if (r.ok) {
        const json = await r.json();
        const text = JSON.stringify(json);
        console.log("  Length:", text.length);
        // Show category names if found
        if (Array.isArray(json?.data)) {
          for (const cat of json.data) {
            console.log(`  📂 ${cat.name || cat.title} (slug: ${cat.slug}, products: ${cat.products_count || cat.products?.length || "?"})`);
          }
        } else {
          console.log("  Preview:", text.substring(0, 500));
        }
      }
    } catch (e: any) {
      console.log(`ERR ${ep}: ${e.message}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
