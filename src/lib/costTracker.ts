/**
 * Cost tracking for all external API calls.
 *
 * Logs usage to the ApiUsage table so we can see exactly
 * what each lead costs and where the money goes.
 */
import { prisma } from "@/lib/prisma";

// ─── Pricing (USD per 1M tokens / per unit) ──────────────────────────

const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6":         { input: 3,    output: 15 },
  "claude-sonnet-4-20250514":  { input: 3,    output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4 },
};

const TWILIO_COST_PER_WA_MESSAGE = 0.005; // ~$0.005 USD per WhatsApp template message (Chile)
const RESEND_COST_PER_EMAIL = 0.001;      // ~$0.001 USD per email (approximation)
const SUPABASE_COST_PER_GB_STORAGE = 0.021; // $0.021/GB/month

// ─── Public API ──────────────────────────────────────────────────────

interface ClaudeUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  action: string;
  leadId?: string | null;
  meta?: Record<string, any>;
}

export async function logClaudeUsage(usage: ClaudeUsage): Promise<void> {
  const pricing = CLAUDE_PRICING[usage.model] || CLAUDE_PRICING["claude-sonnet-4-6"];
  const costUsd =
    (usage.inputTokens / 1_000_000) * pricing.input +
    (usage.outputTokens / 1_000_000) * pricing.output;

  await prisma.apiUsage.create({
    data: {
      service: "claude",
      action: usage.action,
      model: usage.model,
      leadId: usage.leadId || null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd,
      meta: usage.meta || undefined,
    },
  }).catch(e => console.error("[CostTracker] Failed to log Claude usage:", e.message));
}

export async function logTwilioUsage(opts: { leadId?: string; twilioSid?: string; to?: string }): Promise<void> {
  await prisma.apiUsage.create({
    data: {
      service: "twilio",
      action: "send_whatsapp",
      costUsd: TWILIO_COST_PER_WA_MESSAGE,
      leadId: opts.leadId || null,
      meta: { twilioSid: opts.twilioSid, to: opts.to },
    },
  }).catch(e => console.error("[CostTracker] Failed to log Twilio usage:", e.message));
}

export async function logResendUsage(opts: { to: string; purpose: string; leadId?: string }): Promise<void> {
  await prisma.apiUsage.create({
    data: {
      service: "resend",
      action: "send_email",
      costUsd: RESEND_COST_PER_EMAIL,
      leadId: opts.leadId || null,
      meta: { to: opts.to, purpose: opts.purpose },
    },
  }).catch(e => console.error("[CostTracker] Failed to log Resend usage:", e.message));
}

export async function logSupabaseUpload(opts: { sizeBytes: number; leadId?: string; path?: string }): Promise<void> {
  const sizeGb = opts.sizeBytes / (1024 * 1024 * 1024);
  const costUsd = sizeGb * SUPABASE_COST_PER_GB_STORAGE;

  await prisma.apiUsage.create({
    data: {
      service: "supabase",
      action: "storage_upload",
      costUsd,
      leadId: opts.leadId || null,
      meta: { sizeBytes: opts.sizeBytes, path: opts.path },
    },
  }).catch(e => console.error("[CostTracker] Failed to log Supabase usage:", e.message));
}

// ─── Helper to extract tokens from Claude response ───────────────────

/**
 * Call Claude API and automatically log token usage.
 * Returns the parsed response data.
 */
export async function callClaude(opts: {
  apiKey: string;
  model: string;
  maxTokens: number;
  messages: any[];
  action: string;
  leadId?: string | null;
  extraHeaders?: Record<string, string>;
}): Promise<{ data: any; text: string; inputTokens: number; outputTokens: number }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      ...(opts.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Claude API error: ${res.status} ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;

  // Fire-and-forget cost logging
  logClaudeUsage({
    model: opts.model,
    inputTokens,
    outputTokens,
    action: opts.action,
    leadId: opts.leadId,
  });

  return { data, text, inputTokens, outputTokens };
}
