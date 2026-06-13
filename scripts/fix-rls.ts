import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Use service role key to alter RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function enableRLS() {
  // Get all tables in public schema
  const { data: tables, error } = await supabase.rpc('get_tables_without_rls');

  if (error) {
    console.log('RPC not available, using direct SQL...');
    // Enable RLS on all known Prisma tables
    const prismaTableNames = [
      'Restaurant', 'RestaurantOwner', 'Dish', 'Category', 'Lead', 'Session',
      'EmailLog', 'PanelActivity', 'AdSession', 'FunnelVisit', 'Customer',
      'ApiUsage', 'Promotion', 'MenuProvider', 'WhatsappMessage', 'StatEvent',
      'DishImpression', 'Announcement', 'ModifierTemplate', 'ModifierOption',
      'DishModifierTemplate', 'Ingredient', 'Allergen', 'IngredientAllergen',
      'DishIngredient', 'DishTranslation', 'TeamMember', 'HappyHour',
      'SupportMessage', 'Campaign', 'CampaignRecipient', 'WeeklyInsight',
      '_prisma_migrations',
    ];

    for (const table of prismaTableNames) {
      // Use quoted identifiers for case-sensitive table names
      const { error: rlsErr } = await supabase.from(table).select('id').limit(0);
      if (rlsErr?.message?.includes('does not exist')) {
        console.log(`  ⏭  ${table}: table not found, skipping`);
        continue;
      }

      // Enable RLS via SQL
      const { error: sqlErr } = await supabase.rpc('enable_rls_on_table', { table_name: table });
      if (sqlErr) {
        console.log(`  ❌ ${table}: ${sqlErr.message}`);
      } else {
        console.log(`  ✅ ${table}: RLS enabled`);
      }
    }
    return;
  }

  console.log('Tables without RLS:', tables);
}

enableRLS();
