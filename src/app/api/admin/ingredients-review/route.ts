import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const ingredients = await prisma.ingredient.findMany({
      select: { id: true, name: true, aliases: true },
      orderBy: { name: "asc" },
    });

    // Get usage counts
    const usageCounts = await prisma.dishIngredient.groupBy({
      by: ["ingredientId"],
      _count: true,
    });
    const usageMap: Record<string, number> = {};
    usageCounts.forEach(u => { usageMap[u.ingredientId] = u._count; });

    // Build context for AI
    const ingredientList = ingredients.map(i => ({
      name: i.name,
      aliases: i.aliases,
      usedIn: usageMap[i.id] || 0,
    }));

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "No API key" }, { status: 500 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `Review this ingredient database for a restaurant platform. Find problems and suggest fixes.

INGREDIENTS (${ingredients.length} total):
${ingredientList.map(i => `- "${i.name}"${i.aliases.length ? ` (aliases: ${i.aliases.join(", ")})` : ""} [used in ${i.usedIn} dishes]`).join("\n")}

Find ALL of these issues:
1. DUPLICATES: ingredients that are the same thing with different names (e.g., "palta" and "aguacate", "cebollín" and "cebolleta"). Consider Spanish variations.
2. TYPOS: misspelled ingredient names
3. TOO_GENERIC: names too vague to be useful (e.g., "salsa", "verdura", "proteína")
4. ORPHANS: ingredients used in 0 dishes (mark for potential cleanup)
5. SHORT: names with less than 3 characters (likely errors)
6. MERGE_SUGGESTION: aliases that should be merged with another ingredient

Return a JSON array of issues:
[
  {
    "type": "DUPLICATE" | "TYPO" | "TOO_GENERIC" | "ORPHAN" | "SHORT" | "MERGE_SUGGESTION",
    "ingredients": ["name1", "name2"],
    "suggestion": "description of the fix",
    "action": "merge" | "rename" | "delete" | "review"
  }
]

If no issues found, return an empty array [].
Return ONLY the JSON array.`,
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[ingredients-review] API error:", err.substring(0, 200));
      return NextResponse.json({ error: "Error de IA" }, { status: 500 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const issues = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Add orphan detection locally (faster than AI for this)
    const orphans = ingredients.filter(i => !usageMap[i.id]).map(i => i.name);
    const shortNames = ingredients.filter(i => i.name.length < 3).map(i => i.name);

    // Merge AI issues with local detections (avoid duplicates)
    const aiOrphanNames = new Set(issues.filter((i: any) => i.type === "ORPHAN").flatMap((i: any) => i.ingredients));
    const aiShortNames = new Set(issues.filter((i: any) => i.type === "SHORT").flatMap((i: any) => i.ingredients));

    orphans.forEach(name => {
      if (!aiOrphanNames.has(name)) {
        issues.push({ type: "ORPHAN", ingredients: [name], suggestion: `"${name}" no está vinculado a ningún plato`, action: "review" });
      }
    });
    shortNames.forEach(name => {
      if (!aiShortNames.has(name)) {
        issues.push({ type: "SHORT", ingredients: [name], suggestion: `"${name}" tiene menos de 3 caracteres`, action: "review" });
      }
    });

    return NextResponse.json({
      total: ingredients.length,
      issues,
      summary: {
        duplicates: issues.filter((i: any) => i.type === "DUPLICATE").length,
        typos: issues.filter((i: any) => i.type === "TYPO").length,
        generic: issues.filter((i: any) => i.type === "TOO_GENERIC").length,
        orphans: issues.filter((i: any) => i.type === "ORPHAN").length,
        short: issues.filter((i: any) => i.type === "SHORT").length,
        mergeSuggestions: issues.filter((i: any) => i.type === "MERGE_SUGGESTION").length,
      },
    });
  } catch (e) {
    console.error("[ingredients-review]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
