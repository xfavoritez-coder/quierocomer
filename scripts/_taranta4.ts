import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  console.log("HTML length:", html.length);
  
  // Find links
  const linkMatches = [...html.matchAll(/href=["']\/([a-z0-9-]+)(?:\/[a-z0-9-]+)?["']/gi)];
  const slugs = new Set<string>();
  for (const m of linkMatches) slugs.add(m[1]);
  console.log("\nSlugs from links:", [...slugs]);

  // Find NUXT data
  const nuxtMatch = html.match(/<script[^>]*id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nuxtMatch) {
    console.log("\nNUXT data length:", nuxtMatch[1].length);
    const candidates = [...nuxtMatch[1].matchAll(/"([a-z][a-z0-9-]{2,40})"/g)].map(m => m[1]);
    const unique = [...new Set(candidates)].filter(s => !["true","false","null","undefined"].includes(s));
    console.log("All slug candidates:", unique);
  } else {
    console.log("\nNo __NUXT_DATA__ found");
    // Try __NUXT__
    const nuxt2 = html.match(/__NUXT__[\s\S]{0,20}=[\s\S]*?<\/script>/i);
    console.log("__NUXT__ found:", !!nuxt2);
    
    // Just look for all internal links
    const allLinks = [...html.matchAll(/["'](\/[a-z0-9-]+(?:\/[a-z0-9-]+)?)["']/gi)].map(m => m[1]);
    console.log("\nAll internal paths:", [...new Set(allLinks)]);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
