import { config } from "dotenv";
config({ path: ".env.local" });

import { extractAvocaty } from "../src/lib/extractors/avocaty";

async function main() {
  const result = await extractAvocaty("https://carta.avocaty.io/cafeteria-la-fama");
  console.log("Restaurant:", result.restaurantName);
  console.log("Logo:", result.logoUrl?.substring(0, 60));
  console.log("Dishes:", result.dishes.length);
  console.log("Con precio:", result.dishes.filter(d => d.price).length);
  console.log("Con foto:", result.dishes.filter(d => d.photos?.length).length);
  console.log("Categorías:", [...new Set(result.dishes.map(d => d.category))]);
  console.log("Sample:", result.dishes.slice(0, 5).map(d => `${d.name} - $${d.price}`));
}

main().catch(e => console.error("Error:", e.message));
