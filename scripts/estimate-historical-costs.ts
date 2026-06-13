import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

// Average tokens per operation (estimated from real usage)
const ESTIMATES = {
  // Per lead extraction (varies by type)
  extract_avg_input: 80_000,   // ~80K input tokens avg (PDF pages, images, text)
  extract_avg_output: 8_000,   // ~8K output tokens avg (JSON response)
  // Per translation call (2 languages × ~10 dishes)
  translate_calls_per_lead: 20,
  translate_avg_input: 800,
  translate_avg_output: 400,
  // Scrape (2 calls: preview + full)
  scrape_avg_input: 15_000,
  scrape_avg_output: 4_000,
};

// Pricing
const SONNET_INPUT = 3 / 1_000_000;   // $3/M
const SONNET_OUTPUT = 15 / 1_000_000;  // $15/M
const TWILIO_PER_MSG = 0.005;
const RESEND_PER_EMAIL = 0.001;

async function main() {
  // Count leads by status
  const leads = await p.lead.groupBy({
    by: ['cartaStatus'],
    _count: true,
  });
  console.log('\n=== LEADS ===');
  let totalProcessed = 0;
  for (const l of leads) {
    console.log(`  ${l.cartaStatus}: ${l._count}`);
    if (['DONE', 'FAILED', 'PROCESSING'].includes(l.cartaStatus || '')) {
      totalProcessed += l._count;
    }
  }
  console.log(`  Total procesados (intentados): ${totalProcessed}`);

  // Count emails
  const emailCount = await p.emailLog.count({ where: { status: 'sent' } });
  console.log(`\n=== EMAILS ENVIADOS: ${emailCount} ===`);

  // Count WhatsApp messages
  const waCount = await p.whatsAppMessage.count();
  console.log(`=== WHATSAPP ENVIADOS: ${waCount} ===`);

  // Estimate Claude costs
  const extractionCost = totalProcessed * (
    ESTIMATES.extract_avg_input * SONNET_INPUT +
    ESTIMATES.extract_avg_output * SONNET_OUTPUT
  );

  const translationCost = totalProcessed * ESTIMATES.translate_calls_per_lead * (
    ESTIMATES.translate_avg_input * SONNET_INPUT +
    ESTIMATES.translate_avg_output * SONNET_OUTPUT
  );

  const totalClaudeCost = extractionCost + translationCost;
  const totalTwilioCost = waCount * TWILIO_PER_MSG;
  const totalResendCost = emailCount * RESEND_PER_EMAIL;

  const grandTotal = totalClaudeCost + totalTwilioCost + totalResendCost;

  console.log('\n=== ESTIMACIÓN DE COSTOS ===');
  console.log(`  Claude API (extracción):  $${extractionCost.toFixed(2)} USD`);
  console.log(`  Claude API (traducción):  $${translationCost.toFixed(2)} USD`);
  console.log(`  Claude API total:         $${totalClaudeCost.toFixed(2)} USD`);
  console.log(`  Twilio (WhatsApp):        $${totalTwilioCost.toFixed(2)} USD`);
  console.log(`  Resend (emails):          $${totalResendCost.toFixed(2)} USD`);
  console.log(`  ─────────────────────────────`);
  console.log(`  TOTAL ESTIMADO:           $${grandTotal.toFixed(2)} USD (≈ $${Math.round(grandTotal * 950).toLocaleString('es-CL')} CLP)`);
  console.log(`  Costo promedio por lead:  $${(grandTotal / Math.max(totalProcessed, 1)).toFixed(4)} USD`);

  // Now seed ApiUsage with estimated historical data
  console.log('\n¿Insertar estimaciones históricas en ApiUsage? Insertando...');

  const now = new Date();
  const batch = [];

  // One record per service summarizing historical costs
  batch.push({
    service: 'claude',
    action: 'historical_extraction',
    model: 'claude-sonnet-4-6',
    inputTokens: totalProcessed * ESTIMATES.extract_avg_input,
    outputTokens: totalProcessed * ESTIMATES.extract_avg_output,
    costUsd: extractionCost,
    meta: { note: 'Estimación histórica basada en leads procesados', leadsCount: totalProcessed },
    createdAt: new Date(now.getTime() - 86400000), // yesterday
  });

  batch.push({
    service: 'claude',
    action: 'historical_translation',
    model: 'claude-sonnet-4-6',
    inputTokens: totalProcessed * ESTIMATES.translate_calls_per_lead * ESTIMATES.translate_avg_input,
    outputTokens: totalProcessed * ESTIMATES.translate_calls_per_lead * ESTIMATES.translate_avg_output,
    costUsd: translationCost,
    meta: { note: 'Estimación histórica de traducciones', leadsCount: totalProcessed },
    createdAt: new Date(now.getTime() - 86400000),
  });

  batch.push({
    service: 'twilio',
    action: 'historical_whatsapp',
    costUsd: totalTwilioCost,
    meta: { note: 'Estimación histórica WhatsApp', messageCount: waCount },
    createdAt: new Date(now.getTime() - 86400000),
  });

  batch.push({
    service: 'resend',
    action: 'historical_email',
    costUsd: totalResendCost,
    meta: { note: 'Estimación histórica emails', emailCount },
    createdAt: new Date(now.getTime() - 86400000),
  });

  await p.apiUsage.createMany({ data: batch });
  console.log(`Insertados ${batch.length} registros históricos en ApiUsage`);

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
