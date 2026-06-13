import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const SONNET_INPUT = 3 / 1_000_000;
const SONNET_OUTPUT = 15 / 1_000_000;
const HAIKU_INPUT = 0.80 / 1_000_000;
const HAIKU_OUTPUT = 4 / 1_000_000;

async function main() {
  // Delete old estimates
  await p.apiUsage.deleteMany({ where: { action: { startsWith: 'historical_' } } });
  console.log('Borrados registros históricos anteriores\n');

  // All leads that went through the pipeline
  const leads = await p.lead.findMany({
    where: { cartaStatus: { in: ['DELIVERED', 'READY', 'FAILED', 'PROCESSING'] } },
    select: { id: true, localName: true, cartaStatus: true, cartaUrl: true, cartaFileUrl: true, createdAt: true },
  });
  console.log(`=== LEADS PROCESADOS: ${leads.length} ===`);
  for (const l of leads) {
    console.log(`  ${l.cartaStatus.padEnd(12)} ${l.localName}`);
  }

  // Count restaurants created (each one = extraction + translation)
  const restaurants = await p.restaurant.count({ where: { isDemo: false } });
  const demoRestaurants = await p.restaurant.count({ where: { isDemo: true } });
  console.log(`\nRestaurantes reales: ${restaurants}`);
  console.log(`Restaurantes demo: ${demoRestaurants}`);

  // Count dishes (each needs translation to EN + PT)
  const dishes = await p.dish.count();
  console.log(`Platos totales: ${dishes}`);

  // Count categories
  const categories = await p.category.count();
  console.log(`Categorías totales: ${categories}`);

  // Translations: each dish gets translated to 2 languages, batched ~5 per call
  const translationCalls = Math.ceil(dishes / 5) * 2; // 2 languages
  const categoryTranslationCalls = Math.ceil(categories / 10) * 2;

  // Emails & WhatsApp
  const emailCount = await p.emailLog.count({ where: { status: 'sent' } });
  const waCount = await p.whatsAppMessage.count();
  console.log(`Emails enviados: ${emailCount}`);
  console.log(`WhatsApp enviados: ${waCount}`);

  // --- Cost calculations ---

  // 1. Menu extraction: ~80K input + 8K output per lead (avg including retries)
  const extractCostPerLead = 80_000 * SONNET_INPUT + 8_000 * SONNET_OUTPUT;
  const totalExtractCost = leads.length * extractCostPerLead;

  // 2. Translation: ~1K input + 500 output per call
  const translateCostPerCall = 1_000 * SONNET_INPUT + 500 * SONNET_OUTPUT;
  const totalTranslateCost = (translationCalls + categoryTranslationCalls) * translateCostPerCall;

  // 3. Ingredient extraction (if used): ~2K input + 500 output per dish (subset)
  const ingredientDishes = Math.min(dishes, 50); // max 50 dishes get ingredients
  const ingredientCost = ingredientDishes * (2_000 * SONNET_INPUT + 500 * SONNET_OUTPUT);

  // 4. WhatsApp agent: ~3K input + 300 output per conversation
  const waAgentConversations = Math.floor(waCount * 0.3); // ~30% are agent replies
  const waAgentCost = waAgentConversations * (3_000 * SONNET_INPUT + 300 * SONNET_OUTPUT);

  // 5. Weekly emails: Claude generates content for ~restaurants active ones
  const weeklyEmailCost = restaurants * 2 * (2_000 * SONNET_INPUT + 1_000 * SONNET_OUTPUT); // 2 weeks

  const totalClaudeCost = totalExtractCost + totalTranslateCost + ingredientCost + waAgentCost + weeklyEmailCost;
  const totalTwilioCost = waCount * 0.005;
  const totalResendCost = emailCount * 0.001;
  const grandTotal = totalClaudeCost + totalTwilioCost + totalResendCost;

  console.log('\n=== ESTIMACIÓN DE COSTOS (5 días) ===');
  console.log(`  Claude - Extracción menú (${leads.length} leads):     $${totalExtractCost.toFixed(2)} USD`);
  console.log(`  Claude - Traducción (${translationCalls + categoryTranslationCalls} calls):       $${totalTranslateCost.toFixed(2)} USD`);
  console.log(`  Claude - Ingredientes (~${ingredientDishes} platos):    $${ingredientCost.toFixed(2)} USD`);
  console.log(`  Claude - Agente WA (~${waAgentConversations} conv):       $${waAgentCost.toFixed(2)} USD`);
  console.log(`  Claude - Weekly emails (~${restaurants} rest):     $${weeklyEmailCost.toFixed(2)} USD`);
  console.log(`  Claude API total:                         $${totalClaudeCost.toFixed(2)} USD`);
  console.log(`  Twilio (${waCount} mensajes):                   $${totalTwilioCost.toFixed(2)} USD`);
  console.log(`  Resend (${emailCount} emails):                    $${totalResendCost.toFixed(2)} USD`);
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  TOTAL ESTIMADO:                           $${grandTotal.toFixed(2)} USD`);
  console.log(`  En CLP (×950):                            $${Math.round(grandTotal * 950).toLocaleString('es-CL')} CLP`);
  console.log(`  Costo promedio por lead:                  $${(grandTotal / Math.max(leads.length, 1)).toFixed(4)} USD`);

  // Insert corrected historical records
  const yesterday = new Date(Date.now() - 86400000);
  await p.apiUsage.createMany({
    data: [
      {
        service: 'claude', action: 'historical_extraction', model: 'claude-sonnet-4-6',
        inputTokens: leads.length * 80_000, outputTokens: leads.length * 8_000,
        costUsd: totalExtractCost,
        meta: { note: `Estimación: ${leads.length} leads extraídos`, leadsCount: leads.length },
        createdAt: yesterday,
      },
      {
        service: 'claude', action: 'historical_translation', model: 'claude-sonnet-4-6',
        inputTokens: (translationCalls + categoryTranslationCalls) * 1_000,
        outputTokens: (translationCalls + categoryTranslationCalls) * 500,
        costUsd: totalTranslateCost,
        meta: { note: `Estimación: ${dishes} platos + ${categories} categorías traducidas`, calls: translationCalls + categoryTranslationCalls },
        createdAt: yesterday,
      },
      {
        service: 'claude', action: 'historical_ingredients', model: 'claude-sonnet-4-6',
        inputTokens: ingredientDishes * 2_000, outputTokens: ingredientDishes * 500,
        costUsd: ingredientCost,
        meta: { note: `Estimación: ${ingredientDishes} platos analizados` },
        createdAt: yesterday,
      },
      {
        service: 'claude', action: 'historical_wa_agent', model: 'claude-sonnet-4-6',
        inputTokens: waAgentConversations * 3_000, outputTokens: waAgentConversations * 300,
        costUsd: waAgentCost,
        meta: { note: `Estimación: ${waAgentConversations} conversaciones agente` },
        createdAt: yesterday,
      },
      {
        service: 'claude', action: 'historical_weekly_email', model: 'claude-sonnet-4-6',
        inputTokens: restaurants * 2 * 2_000, outputTokens: restaurants * 2 * 1_000,
        costUsd: weeklyEmailCost,
        meta: { note: `Estimación: weekly emails para ${restaurants} restaurantes` },
        createdAt: yesterday,
      },
      {
        service: 'twilio', action: 'historical_whatsapp',
        costUsd: totalTwilioCost,
        meta: { note: `${waCount} mensajes WhatsApp` },
        createdAt: yesterday,
      },
      {
        service: 'resend', action: 'historical_email',
        costUsd: totalResendCost,
        meta: { note: `${emailCount} emails enviados` },
        createdAt: yesterday,
      },
    ],
  });
  console.log('\nInsertados 7 registros históricos corregidos en ApiUsage');

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
