import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

/**
 * Lead Doctor v2 — Agentic AI that diagnoses, investigates, and fixes failed leads.
 *
 * Instead of blindly retrying, the agent can:
 * - Fetch and analyze URLs to understand the site structure
 * - Detect new menu providers from HTML patterns
 * - Create providers in the DB with domain patterns & signatures
 * - Try multiple extraction strategies (dedicated, Jina+Claude, direct HTML)
 * - Retry with the correct provider assigned
 * - Only escalate to human as absolute last resort
 */

const TOOLS = [
  {
    name: "fetch_url",
    description: "Fetch a URL and return HTTP status, content type, and first 8KB of HTML. Use this to check if a URL is accessible and analyze its structure.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to fetch" },
      },
      required: ["url"],
    },
  },
  {
    name: "analyze_html_for_menu",
    description: "Analyze HTML content to find menu data patterns. Returns detected patterns like data attributes, JSON-LD, API endpoints, CSS selectors that contain menu items. Use after fetch_url to understand how to extract the menu.",
    input_schema: {
      type: "object" as const,
      properties: {
        html: { type: "string", description: "HTML content to analyze (first 8KB)" },
        url: { type: "string", description: "The URL this HTML came from" },
      },
      required: ["html", "url"],
    },
  },
  {
    name: "list_existing_providers",
    description: "List all registered menu providers with their domain patterns and extraction status. Use to check if a provider already exists before creating one.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "create_provider",
    description: "Create a new MenuProvider in the database. Use when you detect a new menu platform that could have a dedicated extractor or specific config. The name should match a case in the pipeline switch (or 'generic' to use Jina+Claude).",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Provider name (e.g. 'MiCartaQR', 'TheMenu', etc.)" },
        domainPatterns: { type: "array", items: { type: "string" }, description: "Domain patterns to match (e.g. ['micartaqr.cl', 'themenu.cl'])" },
        htmlSignatures: { type: "array", items: { type: "string" }, description: "Unique strings in the HTML that identify this provider" },
        notes: { type: "string", description: "Notes about the site structure, extraction strategy, patterns found" },
        extractionConfig: {
          type: "object",
          description: "Optional config for the generic extractor (e.g. selectors, API endpoints found)",
        },
      },
      required: ["name", "domainPatterns", "htmlSignatures", "notes"],
    },
  },
  {
    name: "assign_provider_to_lead",
    description: "Assign a MenuProvider to a lead. Use after creating a provider to link the failed lead to it.",
    input_schema: {
      type: "object" as const,
      properties: {
        leadId: { type: "string", description: "The lead ID" },
        providerId: { type: "string", description: "The provider ID to assign" },
      },
      required: ["leadId", "providerId"],
    },
  },
  {
    name: "retry_lead",
    description: "Reset a lead to PENDING and trigger reprocessing. Use after you've made changes (assigned provider, updated config) that should fix the extraction.",
    input_schema: {
      type: "object" as const,
      properties: {
        leadId: { type: "string", description: "The lead ID to retry" },
        reason: { type: "string", description: "Why you're retrying and what you changed" },
      },
      required: ["leadId", "reason"],
    },
  },
  {
    name: "escalate_to_human",
    description: "Mark a lead as needing human intervention. Use ONLY as absolute last resort after exhausting all other options. Explain clearly what you tried and why it failed.",
    input_schema: {
      type: "object" as const,
      properties: {
        leadId: { type: "string", description: "The lead ID" },
        reason: { type: "string", description: "Detailed explanation of what you tried and why it needs human help" },
      },
      required: ["leadId", "reason"],
    },
  },
];

const SYSTEM_PROMPT = `Eres el Lead Doctor de QuieroComer, un agente autónomo que diagnostica y arregla leads de restaurantes que fallaron al procesar su carta digital.

Tu trabajo es RESOLVER el problema, no solo diagnosticarlo. Tienes herramientas para investigar, crear proveedores, y reintentar.

## Extractores disponibles en el pipeline
Estos son los extractores dedicados que existen (case en el switch de extractMenu):
- "Justo" → HTML parsing de justo.eat
- "UberEats" → API privada de UberEats
- "Queresto" → JSON-LD de Bistrify/Queresto
- "MiCartaQR" → data-attributes de micartaqr.cl
- "GoogleDrive" → PDFs de Google Drive
- Cualquier otro nombre → usa extractor genérico (Jina+Claude)

## Tu proceso
1. **Investiga**: Fetch la URL, analiza el HTML, entiende la estructura
2. **Diagnostica**: ¿Por qué falló? ¿URL inaccesible? ¿Proveedor desconocido? ¿JS rendering?
3. **Actúa**:
   - Si el proveedor no existe → créalo con los patterns correctos
   - Si el proveedor está mal asignado → reasígnalo
   - Si es un error transitorio → reintenta
   - Si el HTML tiene data estructurada → documenta los selectores en notes/config
4. **Reintenta**: Después de hacer cambios, reintenta el lead
5. **Escala**: SOLO si agotaste todas las opciones (URL muerta, sitio bloqueado, requiere login, etc.)

## Reglas
- Siempre empieza con fetch_url para verificar el estado actual de la URL
- Si detectas un patrón de menú en el HTML (data-attributes, JSON-LD, tablas), documéntalo al crear el provider
- El extractor genérico (Jina+Claude) funciona para la mayoría de sitios que renderizan con JS
- Si una URL responde 200 y tiene contenido de menú, SIEMPRE debería poder extraerse
- No escales a humano sin haber intentado al menos: verificar URL, analizar HTML, crear/asignar proveedor, y reintentar
- Sé conciso en tus razonamientos

## Sobre timeouts en fetch_url
- Si fetch_url da timeout, el sitio probablemente BLOQUEA IPs de datacenter/cloud (Vercel/AWS)
- Esto NO es un error transitorio — reintentar fetch_url dará el mismo resultado
- En este caso: escala a humano explicando que la URL funciona desde IP residencial pero no desde el servidor
- NO intentes fetch_url más de 2 veces si ambas dan timeout — es bloqueo, no error temporal

## Sobre intentos previos
- SIEMPRE revisa los intentos previos del doctor antes de actuar
- Si ya intentaste algo y falló, NO lo repitas — prueba algo diferente
- Si ya detectaste que la URL da timeout 2+ veces, escala directamente`;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const MAX_AGENT_ATTEMPTS = 5; // max leads per cron run
  const results: { leadId: string; name: string; action: string; success: boolean }[] = [];

  try {
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72h window
    const failedLeads = await prisma.lead.findMany({
      where: {
        cartaStatus: "FAILED",
        createdAt: { gte: since },
      },
      include: {
        detectedProvider: { select: { id: true, name: true, notes: true, extractionConfig: true } },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_AGENT_ATTEMPTS,
    });

    if (failedLeads.length === 0) {
      return NextResponse.json({ ok: true, message: "No failed leads", results: [] });
    }

    for (const lead of failedLeads) {
      const events = (lead.events as any[]) || [];
      const doctorAttempts = events.filter((e: any) => e.action?.startsWith("doctor_")).length;

      // After 8 doctor interactions total, auto-escalate
      // 3 corridas max del doctor, cada corrida puede usar varias tools
      const doctorRuns = events.filter((e: any) => e.action === "doctor_run_summary" || e.action === "doctor_escalated").length;
      if (doctorRuns >= 3) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            events: {
              push: {
                action: "doctor_escalated",
                reason: `Agotó 3 corridas del doctor sin solución. Requiere intervención humana.`,
                ts: new Date().toISOString(),
              },
            },
          },
        }).catch(() => {});
        results.push({ leadId: lead.id, name: lead.localName, action: "escalated: max intentos agotados", success: false });
        continue;
      }

      // Skip if already escalated to human
      if (events.some((e: any) => e.action === "doctor_escalated")) {
        results.push({ leadId: lead.id, name: lead.localName, action: "already_escalated", success: false });
        continue;
      }

      console.log(`[LeadDoctor] Investigating: ${lead.localName} (${lead.cartaUrl})`);

      const result = await runAgent(apiKey, baseUrl, lead);
      results.push(result);
    }

    // Push notification
    const fixed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    if (results.length > 0) {
      try {
        const { sendAdminPush } = await import("@/lib/adminPush");
        const emoji = fixed > 0 ? "🩺" : "⚠";
        const title = fixed > 0
          ? `${emoji} Dr: ${fixed} carta${fixed > 1 ? "s" : ""} arreglada${fixed > 1 ? "s" : ""}`
          : `${emoji} Dr: ${failed} sin solución aún`;
        const body = results.map(r => `${r.success ? "✅" : "⏳"} ${r.name}: ${r.action}`).join("\n");
        await sendAdminPush(title, body, `${baseUrl}/admin/funnel`);
      } catch {}
    }

    return NextResponse.json({ ok: true, fixed, failed, results });
  } catch (err: any) {
    console.error("[LeadDoctor]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── Agent loop ────────────────────────────────────────────────

async function runAgent(
  apiKey: string,
  baseUrl: string,
  lead: any,
): Promise<{ leadId: string; name: string; action: string; success: boolean }> {
  const MAX_TURNS = 12;
  const error = lead.errorLog || "Unknown error";
  const events = (lead.events as any[]) || [];
  const prevDoctorActions = events
    .filter((e: any) => e.action?.startsWith("doctor_"))
    .map((e: any) => `${e.action}: ${e.detail || e.reason || ""}`)
    .join("\n");

  const userMessage = `Lead fallido que necesitas arreglar:

LEAD ID: ${lead.id}
NOMBRE: ${lead.localName}
URL: ${lead.cartaUrl || "(sin URL)"}
TIPO: ${lead.cartaType}
ERROR: ${error}
PROVEEDOR ACTUAL: ${lead.detectedProvider?.name || "(ninguno)"}
NOTAS PROVEEDOR: ${lead.detectedProvider?.notes || "(sin notas)"}
CONFIG: ${JSON.stringify(lead.detectedProvider?.extractionConfig || {})}

INTENTOS PREVIOS DEL DOCTOR:
${prevDoctorActions || "(primera vez)"}

Investiga y arregla este lead. Empieza verificando la URL.`;

  let messages: any[] = [{ role: "user", content: userMessage }];
  let lastAction = "investigating";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error(`[LeadDoctor] Claude API ${res.status}`);
      break;
    }

    const data = await res.json();
    messages.push({ role: "assistant", content: data.content });

    // Check if agent is done (no more tool calls)
    if (data.stop_reason === "end_turn") {
      const text = data.content?.find((c: any) => c.type === "text")?.text || "";
      console.log(`[LeadDoctor] Agent finished: ${text.slice(0, 200)}`);
      break;
    }

    // Process tool calls
    const toolCalls = (data.content || []).filter((c: any) => c.type === "tool_use");
    if (toolCalls.length === 0) break;

    const toolResults: any[] = [];
    for (const tool of toolCalls) {
      console.log(`[LeadDoctor] Tool: ${tool.name}(${JSON.stringify(tool.input).slice(0, 100)})`);
      const result = await executeTool(tool.name, tool.input, lead, baseUrl);
      lastAction = `${tool.name}: ${typeof result === "string" ? result.slice(0, 80) : JSON.stringify(result).slice(0, 80)}`;

      // Log doctor action with human-readable message
      const humanMsg = formatToolLog(tool.name, tool.input, result);
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          events: {
            push: {
              action: `doctor_${tool.name}`,
              detail: humanMsg,
              ts: new Date().toISOString(),
            },
          },
        },
      }).catch(() => {});

      toolResults.push({
        type: "tool_result",
        tool_use_id: tool.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      });

      // Check if retry succeeded
      if (tool.name === "retry_lead" && typeof result === "object" && result.success) {
        return { leadId: lead.id, name: lead.localName, action: `fixed: ${tool.input.reason}`, success: true };
      }

      // Check if escalated
      if (tool.name === "escalate_to_human") {
        return { leadId: lead.id, name: lead.localName, action: `escalated: ${tool.input.reason.slice(0, 100)}`, success: false };
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  // Always log a summary event when the agent finishes without resolving
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      events: {
        push: {
          action: "doctor_run_summary",
          detail: `No resuelto. Última acción: ${lastAction}`,
          ts: new Date().toISOString(),
        },
      },
    },
  }).catch(() => {});

  return { leadId: lead.id, name: lead.localName, action: lastAction, success: false };
}

// ─── Tool execution ────────────────────────────────────────────

async function executeTool(name: string, input: any, lead: any, baseUrl: string): Promise<any> {
  switch (name) {
    case "fetch_url": {
      // Try direct fetch first
      try {
        const res = await fetch(input.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
          signal: AbortSignal.timeout(10000),
          redirect: "follow",
        });
        const text = await res.text();
        return {
          status: res.status,
          contentType: res.headers.get("content-type"),
          finalUrl: res.url,
          htmlPreview: text.slice(0, 8000),
          size: text.length,
          method: "direct",
        };
      } catch (directErr: any) {
        // Direct failed (likely IP block/timeout), try via Jina as proxy
        console.log(`[LeadDoctor] Direct fetch failed: ${directErr.message}. Trying Jina...`);
        try {
          const jinaRes = await fetch(`https://r.jina.ai/${input.url}`, {
            headers: { Accept: "text/plain", "X-No-Cache": "true" },
            signal: AbortSignal.timeout(15000),
          });
          const jinaText = await jinaRes.text();
          return {
            status: jinaRes.status,
            contentType: "text/markdown (via Jina)",
            finalUrl: input.url,
            htmlPreview: jinaText.slice(0, 8000),
            size: jinaText.length,
            method: "jina_proxy",
            note: "Direct fetch timed out (likely IP block). Content retrieved via Jina proxy.",
          };
        } catch (jinaErr: any) {
          return {
            error: `Direct: ${directErr.message}. Jina proxy: ${jinaErr.message}`,
            status: 0,
            method: "both_failed",
            note: "Both direct and Jina proxy failed. Site may be completely down or blocking all automated access.",
          };
        }
      }
    }

    case "analyze_html_for_menu": {
      const html = input.html as string;
      const url = input.url as string;
      const hostname = new URL(url).hostname;
      const patterns: string[] = [];

      // Check for data attributes with menu data
      if (/data-name=|data-price=|data-description=/i.test(html)) {
        patterns.push("DATA_ATTRIBUTES: Found data-name/data-price/data-description attributes on menu items");
        const items = (html.match(/data-name="([^"]*)"/gi) || []).slice(0, 5);
        patterns.push(`Sample items: ${items.join(", ")}`);
      }

      // JSON-LD
      if (/application\/ld\+json/i.test(html)) {
        patterns.push("JSON_LD: Found JSON-LD structured data");
        const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
        for (const b of blocks.slice(0, 2)) {
          try {
            const d = JSON.parse(b[1]);
            patterns.push(`JSON-LD type: ${d["@type"]} ${d.name ? `(${d.name})` : ""}`);
          } catch {}
        }
      }

      // Common menu frameworks
      if (/class=".*menu-item/i.test(html)) patterns.push("CSS_CLASS: .menu-item elements found");
      if (/class=".*product-card/i.test(html)) patterns.push("CSS_CLASS: .product-card elements found");
      if (/class=".*dish/i.test(html)) patterns.push("CSS_CLASS: .dish elements found");
      if (/__NEXT_DATA__/i.test(html)) patterns.push("FRAMEWORK: Next.js (has __NEXT_DATA__)");
      if (/window\.__NUXT__/i.test(html)) patterns.push("FRAMEWORK: Nuxt.js");
      if (/id="__gatsby/i.test(html)) patterns.push("FRAMEWORK: Gatsby");
      if (/react-root|__react/i.test(html)) patterns.push("FRAMEWORK: React SPA");
      if (/ng-app|ng-controller/i.test(html)) patterns.push("FRAMEWORK: Angular");

      // Price patterns
      const prices = html.match(/\$[\d.,]+/g);
      if (prices) patterns.push(`PRICES: Found ${prices.length} price patterns (${prices.slice(0, 3).join(", ")})`);

      // Title
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (title) patterns.push(`TITLE: ${title[1].trim().slice(0, 80)}`);

      // Known provider signatures
      const signatures: Record<string, string[]> = {
        "Fudo": ["menu.fu.do", "fudo.menu"],
        "Queresto": ["queresto", "bistrify"],
        "MiCartaQR": ["Mi Carta Qr", "micartaqr"],
        "Justo": ["justo.eat", "pedir.justo"],
        "Mercat": ["mercat.cl"],
        "Gourmedia": ["gourmedia"],
        "OneClick": ["oneclick.menu"],
      };
      for (const [prov, sigs] of Object.entries(signatures)) {
        if (sigs.some(s => html.toLowerCase().includes(s.toLowerCase()) || hostname.includes(s.toLowerCase()))) {
          patterns.push(`KNOWN_PROVIDER: Matches ${prov}`);
        }
      }

      return {
        hostname,
        patternsFound: patterns.length,
        patterns,
        hasMenuContent: patterns.some(p => p.startsWith("DATA_") || p.startsWith("JSON_LD") || p.startsWith("CSS_CLASS") || p.startsWith("PRICES")),
        recommendation: patterns.length === 0
          ? "No menu patterns detected. Site may require JS rendering (use generic Jina+Claude extractor)."
          : "Menu data found in HTML. A dedicated or configured extractor should work.",
      };
    }

    case "list_existing_providers": {
      const providers = await prisma.menuProvider.findMany({
        select: { id: true, name: true, domainPatterns: true, status: true, successCount: true, failCount: true },
        orderBy: { name: "asc" },
      });
      return providers;
    }

    case "create_provider": {
      // Check if already exists
      const existing = await prisma.menuProvider.findFirst({
        where: {
          OR: [
            { name: input.name },
            { domainPatterns: { hasSome: input.domainPatterns } },
          ],
        },
      });
      if (existing) {
        return { alreadyExists: true, id: existing.id, name: existing.name };
      }

      const provider = await prisma.menuProvider.create({
        data: {
          name: input.name,
          domainPatterns: input.domainPatterns,
          htmlSignatures: input.htmlSignatures || [],
          status: "SUPPORTED",
          notes: input.notes,
          extractionConfig: input.extractionConfig || {},
        },
      });
      return { created: true, id: provider.id, name: provider.name };
    }

    case "assign_provider_to_lead": {
      await prisma.lead.update({
        where: { id: input.leadId },
        data: { detectedProviderId: input.providerId },
      });
      return { assigned: true };
    }

    case "retry_lead": {
      await prisma.lead.update({
        where: { id: input.leadId },
        data: {
          cartaStatus: "PENDING",
          errorLog: null,
          events: {
            push: {
              action: "doctor_retry",
              reason: input.reason,
              ts: new Date().toISOString(),
            },
          },
        },
      });

      try {
        const processRes = await fetch(`${baseUrl}/api/subircarta/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: input.leadId }),
          signal: AbortSignal.timeout(240000),
        });
        const data = await processRes.json();
        if (processRes.ok && data.slug) {
          return { success: true, slug: data.slug };
        }
        return { success: false, error: data.error?.slice(0, 200) || "Unknown" };
      } catch (err: any) {
        return { success: false, error: err.message?.slice(0, 200) };
      }
    }

    case "escalate_to_human": {
      await prisma.lead.update({
        where: { id: input.leadId },
        data: {
          events: {
            push: {
              action: "doctor_escalated",
              reason: input.reason,
              ts: new Date().toISOString(),
            },
          },
        },
      });
      return { escalated: true };
    }

    default:
      return { error: "Unknown tool" };
  }
}

// ─── Human-readable log formatting ────────────────────────────

function formatToolLog(toolName: string, input: any, result: any): string {
  switch (toolName) {
    case "fetch_url": {
      if (result.error) {
        const method = result.method === "both_failed"
          ? "Intenté fetch directo y proxy Jina, ambos fallaron"
          : "Fetch directo falló";
        return `${method}. URL: ${input.url}. Error: ${result.error.slice(0, 100)}. ${result.note || ""}`;
      }
      const via = result.method === "jina_proxy" ? " (via proxy Jina)" : "";
      return `URL accesible${via}. Status ${result.status}, ${result.size} bytes. ${result.note || ""}`;
    }
    case "analyze_html_for_menu": {
      if (!result.patternsFound) return `Analicé el HTML de ${input.url}: no encontré patrones de menú.`;
      return `Analicé el HTML de ${input.url}: ${result.patternsFound} patrones encontrados. ${result.patterns?.slice(0, 3).join("; ")}. ${result.recommendation || ""}`;
    }
    case "list_existing_providers":
      return `Consulté ${Array.isArray(result) ? result.length : 0} proveedores registrados.`;
    case "create_provider": {
      if (result.alreadyExists) return `Proveedor "${result.name}" ya existe (ID: ${result.id}).`;
      return `Creé nuevo proveedor "${result.name}" (ID: ${result.id}).`;
    }
    case "assign_provider_to_lead":
      return `Asigné proveedor ${input.providerId} al lead ${input.leadId}.`;
    case "retry_lead": {
      if (result.success) return `Reintento exitoso. Carta creada: ${result.slug}. Razón: ${input.reason}`;
      return `Reintento falló. Error: ${result.error?.slice(0, 120)}. Razón del intento: ${input.reason}`;
    }
    case "escalate_to_human":
      return `Escalado a humano. Razón: ${input.reason}`;
    default:
      return JSON.stringify(result).slice(0, 200);
  }
}
