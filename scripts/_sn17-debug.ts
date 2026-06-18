import { config } from "dotenv"; config({ path: ".env.local" });
import { extractToteat } from "../src/lib/extractors/toteat";
async function main() {
  console.log("Running Toteat extractor...");
  const result = await extractToteat("https://toteat.app/r/cl/Sushinikkei17/4932/checkin/menu");
  console.log("Dishes:", result.dishes.length);
  const withPhoto = result.dishes.filter(d => d.imageUrl);
  console.log("With photos:", withPhoto.length);
  if (withPhoto.length > 0) {
    console.log("Sample:", withPhoto[0].name, "→", withPhoto[0].imageUrl?.substring(0, 80));
  }
}
main().catch(console.error);
