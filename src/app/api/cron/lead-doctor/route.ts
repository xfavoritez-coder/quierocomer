import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

/**
 * Lead Doctor — AI-powered cron that diagnoses and retries failed leads.
 * Runs every hour. Uses Claude to analyze errors and decide retry strategy.
 * Documents solutions in MenuProvider for future prevention.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const MAX_RETRIES = 3;
  const results: { leadId: string; name: string; action: string; success: boolean }[] = [];

  try {
    // Find failed leads from last 48h that haven't been retried too many times
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const failedLeads = await prisma.lead.findMany({
      where: {
        cartaStatus: "FAILED",
        createdAt: { gte: since },
      },
      include: {
        detectedProvider: { select: { id: true, name: true, notes: true, extractionConfig: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (failedLeads.length === 0) {
      return NextResponse.json({ ok: true, message: "No failed leads", results: [] });
    }

    for (const lead of failedLeads) {
      const error = lead.errorLog || "Unknown error";
      const events = (lead.events as any[]) || [];
      const retryCount = events.filter((e: any) => e.action === "lead_doctor_retry").length;

      // Skip if already retried too many times
      if (retryCount >= MAX_RETRIES) {
        results.push({ leadId: lead.id, name: lead.localName, action: "skipped_max_retries", success: false });
        continue;
      }

      // Ask Claude to diagnose and decide strategy
      const diagnosis = await diagnoseError(apiKey, {
        error,
        provider: lead.detectedProvider?.name || "unknown",
        providerNotes: lead.detectedProvider?.notes || "",
        cartaUrl: lead.cartaUrl || "",
        cartaType: lead.cartaType,
        retryCount,
      });

      if (diagnosis.action === "skip") {
        // Log the skip with reason
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            events: {
              push: { action: "lead_doctor_skip", reason: diagnosis.reason, ts: new Date().toISOString() },
            },
          },
        });
        results.push({ leadId: lead.id, name: lead.localName, action: `skip: ${diagnosis.reason}`, success: false });
        continue;
      }

      // Retry: reset lead and reprocess
      console.log(`[LeadDoctor] Retrying ${lead.localName} (attempt ${retryCount + 1}): ${diagnosis.reason}`);

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          cartaStatus: "PENDING",
          errorLog: null,
          events: {
            push: {
              action: "lead_doctor_retry",
              attempt: retryCount + 1,
              diagnosis: diagnosis.reason,
              strategy: diagnosis.strategy,
              ts: new Date().toISOString(),
            },
          },
        },
      });

      // Call the process endpoint
      try {
        const processRes = await fetch(`${baseUrl}/api/subircarta/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id }),
          signal: AbortSignal.timeout(240000), // 4 min
        });

        const processData = await processRes.json();

        if (processRes.ok && processData.slug) {
          // Success! Document what worked
          results.push({ leadId: lead.id, name: lead.localName, action: `fixed: ${diagnosis.strategy}`, success: true });

          if (lead.detectedProvider) {
            const currentNotes = lead.detectedProvider.notes || "";
            const fixNote = `\nFix automático (${new Date().toISOString().slice(0, 10)}): ${diagnosis.strategy}`;
            if (!currentNotes.includes(diagnosis.strategy)) {
              await prisma.menuProvider.update({
                where: { id: lead.detectedProvider.id },
                data: {
                  notes: currentNotes + fixNote,
                  successCount: { increment: 1 },
                },
              }).catch(() => {});
            }
          }
        } else {
          results.push({ leadId: lead.id, name: lead.localName, action: `retry_failed: ${processData.error?.slice(0, 100)}`, success: false });
        }
      } catch (fetchErr: any) {
        results.push({ leadId: lead.id, name: lead.localName, action: `retry_error: ${fetchErr.message?.slice(0, 80)}`, success: false });
      }
    }

    // Send push notification with summary
    const fixed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    if (results.length > 0) {
      try {
        const { sendAdminPush } = await import("@/lib/adminPush");
        const emoji = fixed > 0 ? "🩺" : "⚠";
        const title = fixed > 0
          ? `${emoji} Lead Doctor: ${fixed} carta${fixed > 1 ? "s" : ""} arreglada${fixed > 1 ? "s" : ""}`
          : `${emoji} Lead Doctor: ${failed} sin solución`;
        const body = results.map(r => `${r.success ? "✅" : "❌"} ${r.name}: ${r.action}`).join("\n");
        await sendAdminPush(title, body, `${baseUrl}/admin/funnel`);
      } catch {}
    }

    return NextResponse.json({ ok: true, fixed, failed, results });
  } catch (err: any) {
    console.error("[LeadDoctor]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Ask Claude to diagnose a failed lead and decide what to do.
 */
async function diagnoseError(
  apiKey: string,
  context: {
    error: string;
    provider: string;
    providerNotes: string;
    cartaUrl: string;
    cartaType: string;
    retryCount: number;
  },
): Promise<{ action: "retry" | "skip"; reason: string; strategy: string }> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Eres el Lead Doctor de QuieroComer. Un lead falló al procesar su carta de restaurante.

ERROR: ${context.error}
PROVEEDOR: ${context.provider}
NOTAS DEL PROVEEDOR: ${context.providerNotes}
URL: ${context.cartaUrl}
TIPO: ${context.cartaType}
INTENTOS PREVIOS: ${context.retryCount}

Decide si vale la pena reintentar o no. Responde SOLO con JSON:
{"action": "retry" | "skip", "reason": "explicación corta", "strategy": "qué hacer diferente"}

Criterios:
- Timeouts → retry (son transitorios)
- JSON truncado → retry (parser mejorado debería funcionar)
- Low quality extraction → retry si es primer intento
- "module not found" o errores de build → skip (necesita fix de código)
- Si ya se intentó 2+ veces con el mismo error → skip
- URLs inválidas o archivos inaccesibles → skip`,
        }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (err) {
    console.warn("[LeadDoctor] Diagnosis failed:", err);
  }

  // Default: retry on first attempt, skip after
  return context.retryCount === 0
    ? { action: "retry", reason: "Default retry (diagnosis failed)", strategy: "standard retry" }
    : { action: "skip", reason: "Multiple failures, diagnosis unavailable", strategy: "none" };
}
