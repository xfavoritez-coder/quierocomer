import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  // Check individual product page for photo
  const url = "https://tarantarestaurante.ola.click/antipastos-italianos/burrata-sobre-focaccia";
  
  // Try direct fetch (no Jina) - the image might be in the HTML
  const res = await fetch(url);
  const html = await res.text();
  
  // Find product images
  const olaImgs = [...html.matchAll(/assets\.olaclick\.app[^\s"')]+/g)];
  console.log("OlaClick asset images:", olaImgs.length);
  for (const m of olaImgs.slice(0, 5)) console.log("  📷", m[0]);

  // Find any image URLs in meta tags or product data
  const metaImgs = [...html.matchAll(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/g)];
  console.log("\nOG images:", metaImgs.length);
  for (const m of metaImgs) console.log("  📷", m[1]);

  // Find product image in NUXT data
  const productImgs = [...html.matchAll(/product_image[^"]*":\s*"([^"]+)"/g)];
  console.log("\nProduct images in data:", productImgs.length);
  for (const m of productImgs) console.log("  📷", m[1]);
  
  // Find any .jpg/.png/.webp URLs
  const allImgs = [...html.matchAll(/https:\/\/[^\s"')+]+\.(jpg|jpeg|png|webp)/gi)];
  const unique = [...new Set(allImgs.map(m => m[0]))];
  console.log("\nAll image URLs:", unique.length);
  for (const u of unique.slice(0, 10)) console.log("  📷", u);

  // Check NUXT data for thumbnail/image patterns
  const thumbs = [...html.matchAll(/thumbnail[_"]?\s*[:=]\s*"([^"]+)"/g)];
  console.log("\nThumbnails:", thumbs.length);
  for (const m of thumbs.slice(0, 5)) console.log("  📷", m[1].replace(/\u002F/g, "/"));
}
main().catch(e => { console.error(e); process.exit(1); });
