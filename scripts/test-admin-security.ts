/**
 * test-admin-security.ts
 *
 * Simulates 8 security scenarios against the admin API.
 * Run: npx tsx scripts/test-admin-security.ts
 *
 * Requires the dev server running on localhost:3000.
 * Uses the database directly to set up test data.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function report(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}: ${details}`);
}

// Helper: login and return cookies as a header string
async function login(email: string, password: string): Promise<{ cookies: string; status: number; body: any }> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  const body = await res.json();
  const setCookies = res.headers.getSetCookie?.() || [];
  const cookieStr = setCookies.map((c) => c.split(";")[0]).join("; ");
  return { cookies: cookieStr, status: res.status, body };
}

// Helper: make an authenticated request
async function authFetch(url: string, cookies: string, options?: RequestInit) {
  return fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      ...((options?.headers as Record<string, string>) || {}),
      Cookie: cookies,
      "Content-Type": "application/json",
    },
    redirect: "manual",
  });
}

async function main() {
  console.log("\n🔒 Admin Security Test Suite\n");
  console.log(`Base URL: ${BASE}\n`);

  // ── Setup: create test owners and restaurants ──
  const testEmail1 = `test-owner-1-${Date.now()}@test.com`;
  const testEmail2 = `test-owner-2-${Date.now()}@test.com`;
  const suspendedEmail = `test-suspended-${Date.now()}@test.com`;
  const pendingEmail = `test-pending-${Date.now()}@test.com`;
  const password = "TestPass123!";
  const hash = await bcrypt.hash(password, 10);

  // Create test restaurants
  const rest1 = await prisma.restaurant.create({
    data: { slug: `test-rest-1-${Date.now()}`, name: "Test Restaurant 1", isActive: true },
  });
  const rest2 = await prisma.restaurant.create({
    data: { slug: `test-rest-2-${Date.now()}`, name: "Test Restaurant 2", isActive: true },
  });

  // Create owners
  const owner1 = await prisma.restaurantOwner.create({
    data: {
      email: testEmail1, passwordHash: hash, name: "Owner 1", status: "ACTIVE",
      restaurants: { connect: [{ id: rest1.id }] },
    },
  });
  const owner2 = await prisma.restaurantOwner.create({
    data: {
      email: testEmail2, passwordHash: hash, name: "Owner 2", status: "ACTIVE",
      restaurants: { connect: [{ id: rest2.id }] },
    },
  });
  const suspendedOwner = await prisma.restaurantOwner.create({
    data: { email: suspendedEmail, passwordHash: hash, name: "Suspended Owner", status: "SUSPENDED" },
  });
  const pendingOwner = await prisma.restaurantOwner.create({
    data: { email: pendingEmail, passwordHash: hash, name: "Pending Owner", status: "PENDING" },
  });

  // Create a test dish in rest2 (owned by owner2)
  const testCategory = await prisma.category.create({
    data: { restaurantId: rest2.id, name: "Test Cat", position: 0 },
  });
  const testDish = await prisma.dish.create({
    data: {
      restaurantId: rest2.id, categoryId: testCategory.id,
      name: "Test Dish", price: 10, position: 0,
    },
  });

  try {
    // ═══ TEST 1: Login with SUSPENDED status → 403 ═══
    {
      const { status, body } = await login(suspendedEmail, password);
      report(
        "1. Login SUSPENDED → 403",
        status === 403 && body.error?.includes("suspendida"),
        `Status: ${status}, Error: ${body.error || "none"}`,
      );
    }

    // ═══ TEST 2: Login with PENDING status → 403 ═══
    {
      const { status, body } = await login(pendingEmail, password);
      report(
        "2. Login PENDING → 403",
        status === 403 && body.error?.includes("pendiente"),
        `Status: ${status}, Error: ${body.error || "none"}`,
      );
    }

    // ═══ TEST 3: Access /api/admin/automations without cookie → 401 ═══
    {
      const res = await fetch(`${BASE}/api/admin/automations?restaurantId=${rest1.id}`, {
        headers: { "Content-Type": "application/json" },
        redirect: "manual",
      });
      // Middleware returns 401 before the route handler
      report(
        "3. No cookie → 401 (automations)",
        res.status === 401,
        `Status: ${res.status}`,
      );
    }

    // Login owner1 for subsequent tests
    const { cookies: cookies1 } = await login(testEmail1, password);
    const { cookies: cookies2 } = await login(testEmail2, password);

    // ═══ TEST 4: Owner without restaurantId on analytics → 400 ═══
    {
      const res = await authFetch("/api/admin/analytics?type=metrics", cookies1);
      const body = await res.json();
      report(
        "4. Owner + no restaurantId on analytics → 400",
        res.status === 400 && body.error?.includes("especificar"),
        `Status: ${res.status}, Error: ${body.error || "none"}`,
      );
    }

    // ═══ TEST 5: Owner with foreign restaurantId on promotions → 403 ═══
    {
      // Owner1 tries to access Owner2's restaurant
      const res = await authFetch(`/api/admin/promotions?restaurantId=${rest2.id}`, cookies1);
      const body = await res.json();
      report(
        "5. Owner + foreign restaurantId on promotions → 403",
        res.status === 403 && body.error?.includes("permisos"),
        `Status: ${res.status}, Error: ${body.error || "none"}`,
      );
    }

    // ═══ TEST 6: Owner editing dish of another restaurant → 403 ═══
    {
      const res = await authFetch(`/api/admin/dishes/${testDish.id}`, cookies1, {
        method: "PUT",
        body: JSON.stringify({ name: "Hacked Dish" }),
      });
      const body = await res.json();
      report(
        "6. Owner editing foreign dish → 403",
        res.status === 403 && body.error?.includes("permisos"),
        `Status: ${res.status}, Error: ${body.error || "none"}`,
      );
    }

    // ═══ TEST 7: Owner trying to assign experience (superadmin only) → 403 ═══
    {
      const res = await authFetch("/api/admin/experiences", cookies1, {
        method: "POST",
        body: JSON.stringify({ action: "assign", restaurantId: rest1.id, templateId: "fake-id" }),
      });
      const body = await res.json();
      report(
        "7. Owner POST experiences (assign) → 403",
        res.status === 403 && body.error?.includes("superadmin"),
        `Status: ${res.status}, Error: ${body.error || "none"}`,
      );
    }

    // ═══ TEST 8: No cookies on sample of 5 endpoints → all 401 ═══
    {
      const endpoints = [
        "/api/admin/dashboard",
        "/api/admin/campaigns?restaurantId=x",
        "/api/admin/segments?restaurantId=x",
        "/api/admin/insights?restaurantId=x",
        "/api/admin/sessions?restaurantId=x",
      ];
      let allUnauth = true;
      const statuses: number[] = [];
      for (const ep of endpoints) {
        const res = await fetch(`${BASE}${ep}`, { redirect: "manual" });
        statuses.push(res.status);
        if (res.status !== 401) allUnauth = false;
      }
      report(
        "8. No cookies on 5 endpoints → all 401",
        allUnauth,
        `Statuses: [${statuses.join(", ")}]`,
      );
    }

    // ═══ BONUS: Verify cookies are httpOnly ═══
    {
      const { cookies: loginCookies } = await login(testEmail1, password);
      // httpOnly cookies include "HttpOnly" in the Set-Cookie header
      const res = await fetch(`${BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail1, password }),
        redirect: "manual",
      });
      const setCookies = res.headers.getSetCookie?.() || [];
      const roleCookie = setCookies.find((c) => c.startsWith("admin_role="));
      const idCookie = setCookies.find((c) => c.startsWith("admin_id="));
      const roleHttpOnly = roleCookie?.toLowerCase().includes("httponly") ?? false;
      const idHttpOnly = idCookie?.toLowerCase().includes("httponly") ?? false;
      report(
        "BONUS: admin_role & admin_id are httpOnly",
        roleHttpOnly && idHttpOnly,
        `admin_role httpOnly: ${roleHttpOnly}, admin_id httpOnly: ${idHttpOnly}`,
      );
    }

  } finally {
    // ── Cleanup test data ──
    console.log("\n🧹 Cleaning up test data...");
    await prisma.dish.deleteMany({ where: { id: testDish.id } });
    await prisma.category.deleteMany({ where: { id: testCategory.id } });
    await prisma.restaurant.updateMany({
      where: { id: { in: [rest1.id, rest2.id] } },
      data: { ownerId: null },
    });
    await prisma.restaurantOwner.deleteMany({
      where: { id: { in: [owner1.id, owner2.id, suspendedOwner.id, pendingOwner.id] } },
    });
    await prisma.restaurant.deleteMany({ where: { id: { in: [rest1.id, rest2.id] } } });
    await prisma.$disconnect();
  }

  // ── Summary ──
  console.log("\n" + "═".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n📊 Results: ${passed}/${total} passed\n`);

  if (passed < total) {
    console.log("Failed tests:");
    results.filter((r) => !r.passed).forEach((r) => console.log(`  ❌ ${r.name}: ${r.details}`));
    process.exit(1);
  } else {
    console.log("🎉 All tests passed!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
