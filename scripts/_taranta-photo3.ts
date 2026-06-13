import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  // Check the category page HTML for product images in NUXT data
  const res = await fetch("https://tarantarestaurante.ola.click/antipastos-italianos");
  const html = await res.text();
  
  const imgPattern = /companies\/products\/images\/[^\s"')\]+/g;
  const productImgs = [...html.matchAll(imgPattern)];
  console.log("Product images in category HTML:", productImgs.length);
  for (const m of productImgs) console.log("  📷", m[0]);

  // Check /products main page
  console.log("\n=== Checking /products NUXT data ===");
  const mainRes = await fetch("https://tarantarestaurante.ola.click/products");
  const mainHtml = await mainRes.text();
  const mainPattern = /companies\/products\/images\/[^\s"')\]+/g;
  const mainImgs = [...mainHtml.matchAll(mainPattern)];
  console.log("Product images in /products:", mainImgs.length);
  for (const m of mainImgs.slice(0, 10)) console.log("  📷", m[0]);
  
  // Try individual product page
  console.log("\n=== Individual product page ===");
  const prodRes = await fetch("https://tarantarestaurante.ola.click/antipastos-italianos/burrata-sobre-focaccia");
  const prodHtml = await prodRes.text();
  const prodImgs = [...prodHtml.matchAll(imgPattern)];
  console.log("Product images:", prodImgs.length);
  for (const m of prodImgs) console.log("  📷", m[0]);
  
  // Check NUXT __data for image pattern with unicode escapes
  const nuxtPattern = /companies\u002Fproducts\u002Fimages\u002F[^"]+/g;
  const nuxtImgs = [...mainHtml.matchAll(nuxtPattern)];
  console.log("\n=== NUXT encoded images in /products ===:", nuxtImgs.length);
  for (const m of nuxtImgs.slice(0, 5)) console.log("  📷", m[0].replace(/\u002F/g, "/"));
}
main().catch(e => { console.error(e); process.exit(1); });
