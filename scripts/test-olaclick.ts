import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { extractOlaClick } = await import("../src/lib/extractors/olaclick");
  const result = await extractOlaClick("https://sushiaustral-chl.ola.click/products");
  console.log(`\nRestaurant: ${result.restaurantName}`);
  console.log(`Logo: ${result.logoUrl}`);
  console.log(`Total dishes: ${result.dishes.length}`);
  const cats = new Map<string, number>();
  for (const d of result.dishes) {
    cats.set(d.category, (cats.get(d.category) || 0) + 1);
  }
  console.log(`Categories: ${cats.size}`);
  for (const [name, count] of cats) {
    console.log(`  ${name}: ${count} dishes`);
  }
  console.log("\nAll dishes:");
  for (const d of result.dishes) {
    console.log(`  [${d.category}] ${d.name}: $${d.price}`);
  }
}

main().catch(console.error);
