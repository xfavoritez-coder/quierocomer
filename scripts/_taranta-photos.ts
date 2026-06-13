import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  // Fetch a category page via Jina and check if images are present
  const url = "https://tarantarestaurante.ola.click/antipastos-italianos";
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain", "X-Timeout": "30000", "X-No-Cache": "true" },
  });
  const text = await res.text();
  
  console.log("=== Content length:", text.length, "===\n");
  
  // Check for image URLs
  const imgMatches = [...text.matchAll(/https?:\/\/[^\s)]+\.(jpg|jpeg|png|webp|gif)/gi)];
  console.log("Image URLs found:", imgMatches.length);
  for (const m of imgMatches) console.log("  📷", m[0].substring(0, 120));

  // Check for markdown image syntax
  const mdImgs = [...text.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  console.log("\nMarkdown images:", mdImgs.length);
  for (const m of mdImgs) console.log("  📷", m[2].substring(0, 120));

  // Check for olaclick asset URLs
  const assetMatches = [...text.matchAll(/assets\.olaclick[^\s)\"']*/g)];
  console.log("\nOlaClick asset URLs:", assetMatches.length);
  for (const m of assetMatches) console.log("  📷", m[0].substring(0, 120));

  // Print first 2000 chars to see format
  console.log("\n=== First 2000 chars ===");
  console.log(text.substring(0, 2000));
}
main().catch(e => { console.error(e); process.exit(1); });
