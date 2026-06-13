import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const res = await fetch("https://tarantarestaurante.ola.click/sitemap.xml");
  const xml = await res.text();
  
  // Extract all product URLs and their category slugs
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const catSlugs = new Set<string>();
  
  for (const url of urls) {
    const match = url.match(/ola\.click\/([a-z0-9-]+)\/[a-z0-9-]+$/);
    if (match) catSlugs.add(match[1]);
  }
  
  console.log(`=== CATEGORÍAS REALES DE TARANTA (${catSlugs.size}) ===\n`);
  for (const slug of catSlugs) {
    const products = urls.filter(u => u.includes(`/${slug}/`));
    console.log(`  📂 ${slug} (${products.length} productos)`);
  }
  
  console.log(`\nTotal URLs: ${urls.length}`);
  console.log(`Total categorías: ${catSlugs.size}`);
  console.log(`\nSlugs para probar:`, [...catSlugs]);
}
main().catch(e => { console.error(e); process.exit(1); });
