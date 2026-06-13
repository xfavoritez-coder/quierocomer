import { config } from 'dotenv';
config({ path: '.env.local' });
import { extractGoogleDrive } from '../src/lib/extractors/googledrive';

async function main() {
  const url = 'https://drive.google.com/file/d/1ujWUm6asCq6QG1eRfg3b8mHBNmtXmLM-/view';
  console.log('Testing extractGoogleDrive with Miscelaneo PDF...');
  const result = await extractGoogleDrive(url);
  console.log('Restaurant:', result.restaurantName);
  console.log('Categories:', result.categories?.length);
  const totalDishes = result.categories?.reduce((s: number, c: any) => s + (c.dishes?.length || 0), 0);
  console.log('Total dishes:', totalDishes);
  for (const cat of (result.categories || []).slice(0, 5)) {
    console.log(`  ${cat.name}: ${cat.dishes?.length} dishes`);
  }
}

main().catch(e => { console.error('FAILED:', e.message, e.stack); process.exit(1); });
