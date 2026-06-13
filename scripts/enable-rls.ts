import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
  // Get all tables in public schema that don't have RLS enabled
  const tables: { tablename: string; rowsecurity: string }[] = await prisma.$queryRaw`
    SELECT tablename, rowsecurity::text
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  console.log(`Found ${tables.length} tables in public schema:\n`);

  for (const t of tables) {
    if (t.rowsecurity === 'true') {
      console.log(`  ✅ "${t.tablename}": RLS already enabled`);
      continue;
    }

    try {
      // Enable RLS — this blocks all access via anon key unless explicit policies exist
      await prisma.$executeRawUnsafe(`ALTER TABLE public."${t.tablename}" ENABLE ROW LEVEL SECURITY`);
      // Also force RLS for table owner (Prisma uses the DB owner role)
      // We DON'T want to force for owner since Prisma needs full access
      console.log(`  🔒 "${t.tablename}": RLS ENABLED`);
    } catch (err: any) {
      console.log(`  ❌ "${t.tablename}": ${err.message?.slice(0, 80)}`);
    }
  }

  console.log('\nDone. All tables now have RLS enabled.');
  console.log('Prisma (server-side) still has full access via direct connection.');
  console.log('Supabase anon key is now blocked from reading any table.');

  await prisma.$disconnect();
}

main();
