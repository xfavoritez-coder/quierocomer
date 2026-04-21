/**
 * test-admin-security.ts
 *
 * Simulates security scenarios against the admin API.
 * Run: npx tsx scripts/test-admin-security.ts
 *
 * Requires the dev server running on localhost:3000.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL || "http://localhost:3000";

interface TestResult { name: string; passed: boolean; details: string; }
const results: TestResult[] = [];

function report(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  console.log(`${passed ? "✅" : "❌"} ${name}: ${details}`);
}

let ipCounter = 1;
function nextIp() { return `192.168.${Math.floor(ipCounter / 255)}.${(ipCounter++) % 255 || 1}`; }

async function login(email: string, password: string, ip?: string) {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip || nextIp() },
    body: JSON.stringify({ email, password }), redirect: "manual",
  });
  const body = await res.json();
  const setCookies = res.headers.getSetCookie?.() || [];
  const cookieStr = setCookies.map(c => c.split(";")[0]).join("; ");
  return { cookies: cookieStr, status: res.status, body };
}

async function authFetch(url: string, cookies: string, options?: RequestInit) {
  return fetch(`${BASE}${url}`, {
    ...options, headers: { ...((options?.headers as Record<string, string>) || {}), Cookie: cookies, "Content-Type": "application/json" }, redirect: "manual",
  });
}

async function main() {
  console.log("\n🔒 Admin Security Test Suite (Extended)\n");
  console.log(`Base URL: ${BASE}\n`);

  // ── Setup ──
  const ts = Date.now();
  const password = "TestPass123!";
  const hash = await bcrypt.hash(password, 10);

  const rest1 = await prisma.restaurant.create({ data: { slug: `test-r1-${ts}`, name: "Test R1", isActive: true } });
  const rest2 = await prisma.restaurant.create({ data: { slug: `test-r2-${ts}`, name: "Test R2", isActive: true } });

  const owner1 = await prisma.restaurantOwner.create({
    data: { email: `o1-${ts}@test.com`, passwordHash: hash, name: "Owner 1", status: "ACTIVE", restaurants: { connect: [{ id: rest1.id }] } },
  });
  const owner2 = await prisma.restaurantOwner.create({
    data: { email: `o2-${ts}@test.com`, passwordHash: hash, name: "Owner 2", status: "ACTIVE", restaurants: { connect: [{ id: rest2.id }] } },
  });
  const suspendedOwner = await prisma.restaurantOwner.create({
    data: { email: `sus-${ts}@test.com`, passwordHash: hash, name: "Suspended", status: "SUSPENDED" },
  });
  const pendingOwner = await prisma.restaurantOwner.create({
    data: { email: `pen-${ts}@test.com`, passwordHash: hash, name: "Pending", status: "PENDING" },
  });

  // Owner for forgot password test
  const fpOwner = await prisma.restaurantOwner.create({
    data: { email: `fp-${ts}@test.com`, passwordHash: hash, name: "FP Owner", status: "ACTIVE" },
  });

  const testCat = await prisma.category.create({ data: { restaurantId: rest2.id, name: "Cat", position: 0 } });
  const testDish = await prisma.dish.create({ data: { restaurantId: rest2.id, categoryId: testCat.id, name: "Dish", price: 10, position: 0 } });

  // Get superadmin cookies — read from .env.local
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  const superEmail = process.env.ADMIN_EMAIL || "admin@quierocomer.cl";
  const superPass = process.env.ADMIN_PASSWORD || "admin123";
  console.log(`Superadmin: ${superEmail}\n`);
  const { cookies: superCookies } = await login(superEmail, superPass);

  try {
    // ════════════════════════════════════════
    // ORIGINAL TESTS (1-8 + BONUS)
    // ════════════════════════════════════════

    console.log("── Prompt 1 Tests ──\n");

    // 1. Login SUSPENDED
    { const { status, body } = await login(`sus-${ts}@test.com`, password);
      report("1. Login SUSPENDED → 403", status === 403 && body.error?.includes("suspendida"), `Status: ${status}`); }

    // 2. Login PENDING
    { const { status, body } = await login(`pen-${ts}@test.com`, password);
      report("2. Login PENDING → 403", status === 403 && body.error?.includes("pendiente"), `Status: ${status}`); }

    // 3. No cookie → 401
    { const res = await fetch(`${BASE}/api/admin/automations?restaurantId=${rest1.id}`, { redirect: "manual" });
      report("3. No cookie → 401 (automations)", res.status === 401, `Status: ${res.status}`); }

    // Login owner1
    const { cookies: c1 } = await login(`o1-${ts}@test.com`, password);

    // 4. Owner no restaurantId analytics
    { const res = await authFetch("/api/admin/analytics?type=metrics", c1);
      const body = await res.json();
      report("4. Owner + no restaurantId → 400", res.status === 400, `Status: ${res.status}`); }

    // 5. Owner foreign restaurantId
    { const res = await authFetch(`/api/admin/promotions?restaurantId=${rest2.id}`, c1);
      report("5. Owner + foreign restaurantId → 403", res.status === 403, `Status: ${res.status}`); }

    // 6. Owner editing foreign dish
    { const res = await authFetch(`/api/admin/dishes/${testDish.id}`, c1, { method: "PUT", body: JSON.stringify({ name: "Hack" }) });
      report("6. Owner editing foreign dish → 403", res.status === 403, `Status: ${res.status}`); }

    // 7. Owner POST experiences assign
    { const res = await authFetch("/api/admin/experiences", c1, { method: "POST", body: JSON.stringify({ action: "assign", restaurantId: rest1.id, templateId: "x" }) });
      report("7. Owner POST experiences → 403", res.status === 403, `Status: ${res.status}`); }

    // 8. No cookies on 5 endpoints
    { const eps = ["/api/admin/dashboard", "/api/admin/campaigns?restaurantId=x", "/api/admin/segments?restaurantId=x", "/api/admin/insights?restaurantId=x", "/api/admin/sessions?restaurantId=x"];
      const statuses = await Promise.all(eps.map(e => fetch(`${BASE}${e}`, { redirect: "manual" }).then(r => r.status)));
      report("8. No cookies on 5 endpoints → all 401", statuses.every(s => s === 401), `[${statuses.join(",")}]`); }

    // BONUS: httpOnly cookies
    { const bonusIp = nextIp();
      const res = await fetch(`${BASE}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": bonusIp }, body: JSON.stringify({ email: `o1-${ts}@test.com`, password }), redirect: "manual" });
      const sc = res.headers.getSetCookie?.() || [];
      const roleHttp = sc.find(c => c.startsWith("admin_role="))?.toLowerCase().includes("httponly") ?? false;
      const idHttp = sc.find(c => c.startsWith("admin_id="))?.toLowerCase().includes("httponly") ?? false;
      report("BONUS: Cookies httpOnly", roleHttp && idHttp, `role:${roleHttp} id:${idHttp}`); }

    // ════════════════════════════════════════
    // PROMPT 2 TESTS
    // ════════════════════════════════════════

    console.log("\n── Prompt 2 Tests ──\n");

    // 9. Forgot password existing email → 200 generic
    { const ip = nextIp();
      const res = await fetch(`${BASE}/api/admin/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify({ email: `fp-${ts}@test.com` }), redirect: "manual" });
      const body = await res.json();
      report("9. Forgot password (existing email) → 200 generic", res.status === 200 && body.success === true, `Status: ${res.status}, msg: ${body.message?.substring(0,40)}`); }

    // 10. Forgot password non-existing email → 200 same message
    { const ip = nextIp();
      const res = await fetch(`${BASE}/api/admin/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify({ email: "nonexistent@test.com" }), redirect: "manual" });
      const body = await res.json();
      report("10. Forgot password (non-existing) → 200 same", res.status === 200 && body.success === true, `Status: ${res.status}`); }

    // 11. Reset password with valid token
    { const rawToken = "test-reset-token-valid";
      const hashedToken = await bcrypt.hash(rawToken, 10);
      await prisma.restaurantOwner.update({ where: { id: fpOwner.id }, data: { resetToken: hashedToken, resetTokenExpiry: new Date(Date.now() + 3600000) } });
      const ip = nextIp();
      const res = await fetch(`${BASE}/api/admin/reset-password`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify({ email: `fp-${ts}@test.com`, token: rawToken, newPassword: "NewPass123" }), redirect: "manual" });
      const body = await res.json();
      report("11. Reset password (valid token) → 200", res.status === 200 && body.success === true, `Status: ${res.status}`);
      const loginRes = await login(`fp-${ts}@test.com`, "NewPass123");
      report("11b. Login with new password works", loginRes.status === 200 && loginRes.body.ok === true, `Status: ${loginRes.status}`); }

    // 12. Reset password with expired token
    { const rawToken = "test-expired-token";
      const hashedToken = await bcrypt.hash(rawToken, 10);
      await prisma.restaurantOwner.update({ where: { id: fpOwner.id }, data: { resetToken: hashedToken, resetTokenExpiry: new Date(Date.now() - 1000) } });
      const ip = nextIp();
      const res = await fetch(`${BASE}/api/admin/reset-password`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify({ email: `fp-${ts}@test.com`, token: rawToken, newPassword: "Another123" }), redirect: "manual" });
      const body = await res.json();
      report("12. Reset password (expired token) → 400", res.status === 400 && body.error?.includes("expirado"), `Status: ${res.status}, err: ${body.error}`); }

    // 13. Reset password with invalid token
    { const rawToken = "test-valid-token-13";
      const hashedToken = await bcrypt.hash(rawToken, 10);
      await prisma.restaurantOwner.update({ where: { id: fpOwner.id }, data: { resetToken: hashedToken, resetTokenExpiry: new Date(Date.now() + 3600000) } });
      const ip = nextIp();
      const res = await fetch(`${BASE}/api/admin/reset-password`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify({ email: `fp-${ts}@test.com`, token: "wrong-token", newPassword: "Another123" }), redirect: "manual" });
      const body = await res.json();
      report("13. Reset password (invalid token) → 400", res.status === 400 && body.error?.includes("inválido"), `Status: ${res.status}, err: ${body.error}`); }

    // 14. Rate limit on login: 6 attempts (5 allowed per 15 min window)
    { const fakeEmail = `ratelimit-${ts}@test.com`;
      const rlIp = `10.99.${Math.floor(ts/1000) % 255}.${ts % 255}`;
      let lastStatus = 0;
      for (let i = 0; i < 6; i++) {
        const res = await fetch(`${BASE}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": rlIp }, body: JSON.stringify({ email: fakeEmail, password: "wrong" }), redirect: "manual" });
        lastStatus = res.status;
      }
      report("14. Rate limit login: 6th attempt → 429", lastStatus === 429, `6th status: ${lastStatus}`); }

    // 15. Rate limit on forgot-password: 4 attempts (3 allowed per hour)
    { const rlIp = `10.88.${Math.floor(ts/1000) % 255}.${ts % 255}`;
      let lastStatus = 0;
      for (let i = 0; i < 4; i++) {
        const res = await fetch(`${BASE}/api/admin/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": rlIp }, body: JSON.stringify({ email: "any@test.com" }), redirect: "manual" });
        lastStatus = res.status;
      }
      report("15. Rate limit forgot-password: 4th → 429", lastStatus === 429, `4th status: ${lastStatus}`); }

    // 16. Owner tries /api/admin/owners → 403
    { const res = await authFetch("/api/admin/owners", c1);
      report("16. Owner GET /api/admin/owners → 403", res.status === 403, `Status: ${res.status}`); }

    // 17. Superadmin creates owner
    { const res = await authFetch("/api/admin/owners", superCookies, {
        method: "POST", body: JSON.stringify({ email: `new-${ts}@test.com`, password: "Test1234", name: "New Owner" }),
      });
      const body = await res.json();
      report("17. Superadmin creates owner → 200", res.status === 200 && body.ok === true, `Status: ${res.status}`);
      // Cleanup
      if (body.owner?.id) await prisma.restaurantOwner.delete({ where: { id: body.owner.id } }).catch(() => {}); }

    // 18. Superadmin suspends owner → owner can't login
    { await authFetch(`/api/admin/owners/${owner2.id}`, superCookies, { method: "PUT", body: JSON.stringify({ status: "SUSPENDED" }) });
      const loginRes = await login(`o2-${ts}@test.com`, password);
      report("18. Suspended owner can't login → 403", loginRes.status === 403, `Status: ${loginRes.status}`);
      // Restore
      await authFetch(`/api/admin/owners/${owner2.id}`, superCookies, { method: "PUT", body: JSON.stringify({ status: "ACTIVE" }) }); }

    // 19. Superadmin sets password → owner logs in with new password
    { await authFetch(`/api/admin/owners/${owner2.id}/set-password`, superCookies, { method: "POST", body: JSON.stringify({ newPassword: "Changed99" }) });
      const loginRes = await login(`o2-${ts}@test.com`, "Changed99");
      report("19. Superadmin set-password → owner login works", loginRes.status === 200 && loginRes.body.ok === true, `Status: ${loginRes.status}`); }

  } finally {
    console.log("\n🧹 Cleaning up...");
    await prisma.dish.deleteMany({ where: { id: testDish.id } });
    await prisma.category.deleteMany({ where: { id: testCat.id } });
    await prisma.restaurant.updateMany({ where: { id: { in: [rest1.id, rest2.id] } }, data: { ownerId: null } });
    await prisma.restaurantOwner.deleteMany({ where: { id: { in: [owner1.id, owner2.id, suspendedOwner.id, pendingOwner.id, fpOwner.id] } } });
    await prisma.restaurant.deleteMany({ where: { id: { in: [rest1.id, rest2.id] } } });
    await prisma.$disconnect();
  }

  console.log("\n" + "═".repeat(50));
  const passed = results.filter(r => r.passed).length;
  console.log(`\n📊 Results: ${passed}/${results.length} passed\n`);
  if (passed < results.length) {
    results.filter(r => !r.passed).forEach(r => console.log(`  ❌ ${r.name}: ${r.details}`));
    process.exit(1);
  } else {
    console.log("🎉 All tests passed!");
    process.exit(0);
  }
}

main().catch(err => { console.error("Test error:", err); process.exit(1); });
