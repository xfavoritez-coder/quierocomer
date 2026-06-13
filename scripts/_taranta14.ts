import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  
  // The NUXT data is a self-executing function: (function(a,b,...){...})(val_a, val_b, ...)
  // Let's extract and evaluate it to get the actual data
  const match = html.match(/window\.__NUXT__\s*=\s*(\(function[\s\S]*?\))\s*\(([^]*?)\)\s*<\/script>/);
  if (!match) {
    // Try alternate approach - find the closing
    const start = html.indexOf("window.__NUXT__");
    const scriptEnd = html.indexOf("</script>", start);
    const nuxtCode = html.substring(start, scriptEnd);
    
    // Just eval it safely
    const fn = new Function("return " + nuxtCode.replace("window.__NUXT__=", "") + ";");
    const data = fn();
    
    // Look for categories/products data
    const state = data?.state;
    if (state?.productsCategories) {
      console.log("ProductsCategories:", JSON.stringify(state.productsCategories, null, 2).substring(0, 3000));
    }
    
    // Deep search for anything with "slug" or category-like data
    function findSlugs(obj: any, path = ""): void {
      if (!obj || typeof obj !== "object") return;
      for (const [k, v] of Object.entries(obj)) {
        if (k === "slug" && typeof v === "string") console.log(`${path}.${k} = ${v}`);
        if (typeof v === "object") findSlugs(v, `${path}.${k}`);
      }
    }
    findSlugs(data);
    
    // Check company landing_contents
    const company = data?.state?.company?.company;
    if (company) {
      console.log("\nCompany domain:", company.domain);
      console.log("Landing contents:", JSON.stringify(company.landing_contents, null, 2));
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
