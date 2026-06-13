import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const res = await fetch("https://tarantarestaurante.ola.click/products");
  const html = await res.text();
  
  // The productsCategories are empty in SSR because they load via JS.
  // But the NUXT function has them encoded. Let's find the function invocation data.
  
  // Find the NUXT function call with all the data
  const match = html.match(/window\.__NUXT__\s*=\s*\(function\(([^)]+)\)/);
  if (match) {
    const params = match[1].split(",").map(s => s.trim());
    console.log("Function params count:", params.length);
  }
  
  // Find the actual function call at the end
  const callMatch = html.match(/\}\)\(([^<]+)\)<\/script>/);
  if (callMatch) {
    const args = callMatch[1];
    console.log("Args length:", args.length);
    console.log("First 2000 chars of args:");
    console.log(args.substring(0, 2000));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
