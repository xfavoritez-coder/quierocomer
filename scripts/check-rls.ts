import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function check() {
  // Prisma uses these table names (lowercase in postgres)
  const tables = [
    'Restaurant', 'RestaurantOwner', 'Dish', 'Category', 'Lead', 'Session',
    'EmailLog', 'PanelActivity', 'AdSession', 'FunnelVisit', 'Customer',
    'ApiUsage', 'Promotion', 'MenuProvider', 'WhatsappMessage',
  ];

  console.log('Checking public access via anon key...\n');
  for (const t of tables) {
    const { data, error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ✅ ${t}: BLOCKED (${error.message.slice(0, 50)})`);
    } else {
      console.log(`  ⚠️  ${t}: EXPOSED — ${count ?? '?'} rows publicly accessible!`);
    }
  }
}
check();
