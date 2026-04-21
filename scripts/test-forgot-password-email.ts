/**
 * test-forgot-password-email.ts
 *
 * Manually test the forgot-password email flow with a real email address.
 * Creates a test owner if needed, triggers the forgot-password endpoint,
 * and shows the reset link that should arrive.
 *
 * Usage:
 *   npx tsx scripts/test-forgot-password-email.ts your-email@gmail.com
 *   npx tsx scripts/test-forgot-password-email.ts your-email@gmail.com --cleanup
 *
 * Requires the dev server running (default http://localhost:3099).
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL || "http://localhost:3099";
const email = process.argv[2];
const cleanup = process.argv.includes("--cleanup");

if (!email) {
  console.error("Usage: npx tsx scripts/test-forgot-password-email.ts <email> [--cleanup]");
  process.exit(1);
}

async function main() {
  console.log(`\n🧪 Forgot Password Email Test`);
  console.log(`Email: ${email}`);
  console.log(`Server: ${BASE}`);
  console.log(`Cleanup: ${cleanup}\n`);

  // Check if owner exists
  let owner = await prisma.restaurantOwner.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, status: true },
  });

  if (!owner) {
    console.log("📝 Owner not found, creating test owner...");
    const hash = await bcrypt.hash("test1234", 10);
    owner = await prisma.restaurantOwner.create({
      data: { email, passwordHash: hash, name: "Test Owner", status: "ACTIVE" },
      select: { id: true, email: true, name: true, status: true },
    });
    console.log(`✅ Created owner: ${owner.id} (${owner.email})`);
  } else {
    console.log(`✅ Owner found: ${owner.id} (${owner.email}) — status: ${owner.status}`);
  }

  if (cleanup) {
    console.log("\n🧹 Cleanup mode: deleting test owner...");
    await prisma.restaurantOwner.delete({ where: { id: owner.id } });
    console.log("✅ Owner deleted");
    await prisma.$disconnect();
    return;
  }

  // Call forgot-password endpoint
  console.log("\n📧 Calling POST /api/admin/forgot-password...");
  const res = await fetch(`${BASE}/api/admin/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.0.0.1" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json();
  console.log(`   Status: ${res.status}`);
  console.log(`   Response: ${JSON.stringify(body)}`);

  if (res.status !== 200) {
    console.error("❌ Unexpected status. Check if rate limited (429) or server error.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Read the token from DB to show the expected link
  const updated = await prisma.restaurantOwner.findUnique({
    where: { id: owner.id },
    select: { resetToken: true, resetTokenExpiry: true },
  });

  if (updated?.resetToken) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
    console.log(`\n📋 Token stored in DB (hashed): ${updated.resetToken.substring(0, 30)}...`);
    console.log(`⏰ Expires at: ${updated.resetTokenExpiry?.toISOString()}`);
    console.log(`\n⚠️  The actual reset link was sent to ${email}.`);
    console.log(`   The link contains the RAW (unhashed) token — we can't reconstruct it from the hash.`);
    console.log(`   Check your inbox (and spam folder) for an email from QuieroComer.`);
    console.log(`\n   The link format is:`);
    console.log(`   ${baseUrl}/admin/reset-password?token=<uuid>&email=${encodeURIComponent(email)}`);

    // Verify Resend config
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;
    console.log(`\n🔧 Resend config:`);
    console.log(`   API Key: ${apiKey ? apiKey.substring(0, 10) + "..." : "❌ NOT SET"}`);
    console.log(`   From: ${fromEmail || "onboarding@resend.dev (fallback)"}`);

    if (!apiKey || apiKey === "re_placeholder") {
      console.log(`\n⚠️  RESEND_API_KEY is not configured or is placeholder.`);
      console.log(`   The email send probably failed silently (check server logs).`);
      console.log(`   To test emails, set RESEND_API_KEY in .env.local with a real key.`);
    } else {
      console.log(`\n✅ Resend appears configured. Email should have been sent.`);
      console.log(`   If it didn't arrive, check:`);
      console.log(`   1. Spam folder`);
      console.log(`   2. Resend dashboard: https://resend.com/emails`);
      console.log(`   3. Server console for "[forgot-password] Failed to send email" errors`);
    }
  } else {
    console.log(`\n⚠️  No reset token found in DB.`);
    console.log(`   This could mean:`);
    console.log(`   - Owner status is not ACTIVE (current: ${owner.status})`);
    console.log(`   - The endpoint returned 200 but skipped token generation`);
  }

  await prisma.$disconnect();
  console.log("\n✅ Done\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
