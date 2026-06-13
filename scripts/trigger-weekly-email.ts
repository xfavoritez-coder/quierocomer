/**
 * Manual trigger for weekly email — runs the same logic as the cron endpoint.
 * Usage: npx tsx scripts/trigger-weekly-email.ts
 */

async function main() {
  // Load env
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const cronSecret = process.env.CRON_SECRET;

  // Try hitting production endpoint first
  if (cronSecret) {
    console.log("Triggering production endpoint with CRON_SECRET...");
    try {
      const res = await fetch(`${baseUrl}/api/cron/weekly-email`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
        signal: AbortSignal.timeout(120000),
      });
      const data = await res.json();
      console.log(`Status: ${res.status}`);
      console.log(JSON.stringify(data, null, 2));
      if (res.ok) {
        console.log("\n✅ Weekly email triggered successfully via production endpoint");
        return;
      }
      console.log("Production endpoint failed, falling back to local execution...\n");
    } catch (e: any) {
      console.log(`Production call failed: ${e.message}\nFalling back to local execution...\n`);
    }
  }

  // Fallback: run logic locally
  console.log("Running weekly email logic locally (same DB)...\n");

  // Dynamic imports to get the same modules
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true, weeklyEmailEnabled: true },
      select: {
        id: true, name: true, slug: true, isDemo: true,
        owner: { select: { email: true } },
      },
    });

    console.log(`Found ${restaurants.length} restaurants with weeklyEmailEnabled`);
    const withEmail = restaurants.filter(r => r.owner?.email);
    console.log(`${withEmail.length} have owner email`);
    console.log(`${withEmail.filter(r => r.isDemo).length} demo, ${withEmail.filter(r => !r.isDemo).length} real\n`);

    console.log("⚠️  Local execution can't send emails (needs Resend + full Next.js context).");
    console.log("   The CRON_SECRET in .env.local is empty — set it to match production.\n");
    console.log("Options:");
    console.log("  1. Set CRON_SECRET in .env.local to match Vercel env var, then re-run");
    console.log("  2. Trigger from Vercel dashboard: Functions → /api/cron/weekly-email → Invoke");
    console.log("  3. Use curl: curl -H 'Authorization: Bearer YOUR_SECRET' https://quierocomer.cl/api/cron/weekly-email");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
