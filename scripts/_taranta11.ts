import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const JINA_KEY = process.env.JINA_API_KEY;
  const base = "https://tarantarestaurante.ola.click";

  // First, let Jina render the main page and find category names/links
  console.log("Fetching main page via Jina...");
  const mainRes = await fetch(`https://r.jina.ai/${base}/products`, {
    headers: {
      "Authorization": `Bearer ${JINA_KEY}`,
      "X-Wait-For-Selector": ".infinite-products",
      "X-Timeout": "45",
    },
  });
  const mainText = await mainRes.text();
  console.log("Main page:", mainText.length, "chars");
  
  // Print first part to see category structure
  console.log("\n--- First 3000 chars ---");
  console.log(mainText.substring(0, 3000));
  
  // Find all links that look like categories
  const linkMatches = [...mainText.matchAll(/\(?\/?([a-z0-9-]+)\/([a-z0-9-]+)\)?/g)];
  const catSlugs = new Set<string>();
  for (const m of linkMatches) {
    const slug = m[1];
    if (slug.length > 2 && !["products","profile","es","http","https","www","cookie","r.jina"].some(x => slug.includes(x))) {
      catSlugs.add(slug);
    }
  }
  console.log("\n\nCategory slugs found in Jina content:", [...catSlugs]);
}
main().catch(e => { console.error(e); process.exit(1); });
