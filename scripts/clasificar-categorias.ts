/**
 * Clasifica categorías de carta sin mapear en categorías QC canónicas.
 * Paso 1: reglas por palabras clave (rápido, sin costo)
 * Paso 2: Claude Haiku para las ambiguas (con nombre de platos de contexto)
 * Salida: nuevas entradas para CATEGORY_MAP listas para copiar/pegar
 */

import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()
const anthropic = new Anthropic()

// ─── Categorías QC válidas ────────────────────────────────────────────────────

const QC_CATEGORIES = [
  'Sushi', 'Pizzas', 'Hamburguesas', 'Sándwiches', 'Completos',
  'Parrilla', 'Pollo', 'Pastas', 'Peruana', 'Ceviches', 'Mariscos',
  'Mexicana', 'Asiática', 'Empanadas', 'Saludable',
  'Postres', 'Desayunos', 'Cafetería',
] as const

type QcCategory = typeof QC_CATEGORIES[number]
const EXCLUDE = 'EXCLUDE' as const

// ─── Reglas por palabras clave ────────────────────────────────────────────────

type Rule = { pattern: RegExp; result: QcCategory | typeof EXCLUDE }

const RULES: Rule[] = [
  // Excluir primero
  { pattern: /cervez|schop|beer|lager|ipa\b|craft.*beer/i, result: EXCLUDE },
  { pattern: /\bvino|wine|espumante|malbec|cabernet|carmenere|pinot|sauvignon/i, result: EXCLUDE },
  { pattern: /\bgin\b|pisco|tequila|whisky|bourbon|vodka|ron\b|rum\b|licor|destilad/i, result: EXCLUDE },
  { pattern: /trago|coctel|cóctel|cocktel|mojito|colada|margarita|aperol|campari/i, result: EXCLUDE },
  { pattern: /\bshots?\b|bajativo|digestivo/i, result: EXCLUDE },
  { pattern: /mocktail|sin alcohol.*bebida|bebestible(?!.*cafeteria)/i, result: EXCLUDE },
  { pattern: /jugo(?! de sushi)|jugos\b|agua con gas|agua sin gas|aguas y jugos/i, result: EXCLUDE },
  { pattern: /gaseosa|bebida gaseosa|coca.?cola\b/i, result: EXCLUDE },
  { pattern: /agregado|ingrediente.?extra|upgrade|arma tu.*promo/i, result: EXCLUDE },
  { pattern: /salsa extra|\bsalsas?\b(?!.*pizza)/i, result: EXCLUDE },
  { pattern: /para (tomar|beber)|^(bebidas?|bebestibles?)\s*$/i, result: EXCLUDE },
  { pattern: /happy.?hour|promo.?de.?la.?semana|descuento|oferta(?!s del chef)/i, result: EXCLUDE },
  { pattern: /accesorios|para.?regalo|envase.?para.?llevar/i, result: EXCLUDE },
  { pattern: /milkshake|smoothie|frape\b|frappé/i, result: EXCLUDE },

  // Sushi — muy específico, antes de asiática
  { pattern: /roll|maki|nigiri|sashimi|temaki|hosomaki|gohan|chirashi|nikkei|sake.?roll|avocado.?roll|california|keto.?roll|sin.?arroz|sin arroz|rice.?free|sushi.?burger|sushipleto|sushi|handroll|hand.?roll|furay/i, result: 'Sushi' },
  { pattern: /\btataki\b|\bpoke/i, result: 'Sushi' },

  // Ramen / Asiática
  { pattern: /ramen|yakisoba|gyoz|dim.?sum|dumpling|bubble.?tea|yakitori|tonkotsu|udon|pad.?thai|rice.?ball|plato.*japan|japan.*plato/i, result: 'Asiática' },

  // Hamburguesas
  { pattern: /burger|hamburguesa|smash.?burger|smashed/i, result: 'Hamburguesas' },

  // Pizzas
  { pattern: /pizza|calzone|fugazza|pizzeta|pizzas/i, result: 'Pizzas' },

  // Sándwiches
  { pattern: /sandwich|sándwich|churrasco|lomito|pepito|lomo\b|baguette|ciabatta|club.*sand|chicken.?sand|pulled.?pork.*sand|brisket.*sand/i, result: 'Sándwiches' },

  // Completos
  { pattern: /completo|perro.?caliente|hot.?dog|vienesa|salsich/i, result: 'Completos' },

  // Ceviches
  { pattern: /ceviche|cebiche|leche.?de.?tigre|tiradito|causa.*entr|chicharron.*mar/i, result: 'Ceviches' },

  // Mariscos
  { pattern: /mariscos?|jaiba|camarones?|langosta|pulpo|ostras?|almejas?|machas|locos|caldillo/i, result: 'Mariscos' },

  // Peruana
  { pattern: /peruano|peruano|lomo.?saltado|aji de gallina|anticucho|cau.?cau|comida.?peru|tradicion.*peru|criollo|cocina.?peruano/i, result: 'Peruana' },

  // Mexicana / venezolana
  { pattern: /tacos?|burrito|quesadilla|nacho|tostada.?mex|guacamol|enchilada|cachapa|patacon|venezolan/i, result: 'Mexicana' },

  // Parrilla / Carnes
  { pattern: /parrilla|brasas?|corte.?de.?carne|costilla|plateada|vacuno|mechada|asado|chorrillana|anticucho|bife/i, result: 'Parrilla' },

  // Pollo
  { pattern: /pollo.?a.?la.?brasa|pollo.?frito|broaster|alitas?|wing/i, result: 'Pollo' },

  // Empanadas
  { pattern: /empanada|pastelito.?frit/i, result: 'Empanadas' },

  // Pastas
  { pattern: /pasta|espagueti|espaguetti|lasaña|cannelloni|risotto|fettuccine|tagliatelle|arroces.*crem/i, result: 'Pastas' },

  // Saludable
  { pattern: /ensalada|vegano|vegetariano|bowl|saludable|wrap.?fresh|fresh.*salad|comida.?sana|green|crea.?tu.*ensalad|sin.?gluten.*menu/i, result: 'Saludable' },

  // Postres
  { pattern: /postre|dulce|torta|pastel|helado|gelato|gelateria|brownie|muffin|cupcake|galleta|galleton|waffle.*dulce|crepe.*dulce|tartas?.*dulce|tentacion.*dulce|canele|rollo.?de.?canela|cheesecake|bombones?|proteic.*dulce|donuts?.*proteic|protein.?cookie|protein.?cake|protein.?cup|protein.?brownie|panaderia.*dulce|pasteleria|reposteria/i, result: 'Postres' },

  // Desayunos
  { pattern: /desayuno|brunch|breakfast|tostada|bolleria|once\b|panera|mañana.*deli|all.?inclusive.*9|tardes.*deli.*15/i, result: 'Desayunos' },

  // Cafetería
  { pattern: /cafeteria|café.*frio|bebestibles.*cafe|capuccino|latte|espresso|cortado|americano/i, result: 'Cafetería' },
]

function ruleBasedClassify(categoryName: string): QcCategory | typeof EXCLUDE | null {
  const name = categoryName.trim()
  for (const rule of RULES) {
    if (rule.pattern.test(name)) return rule.result
  }
  return null
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Leer CATEGORY_MAP actual
  const content = fs.readFileSync('src/app/a/lib/categories.ts', 'utf8')
  const alreadyMapped = new Set([...content.matchAll(/'([^']+)':\s*'[^']+'/g)].map(m => m[1]))

  // Obtener categorías activas sin mapear con platos de muestra
  const dishes = await prisma.dish.findMany({
    where: {
      isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 },
      restaurant: { isActive: true, isDemo: false },
    },
    select: { name: true, category: { select: { name: true } }, restaurant: { select: { name: true } } },
  })

  // Agrupar por categoría con platos de muestra
  const catMap = new Map<string, { dishes: string[]; restaurant: string }>()
  for (const d of dishes) {
    const cat = d.category.name.trim()
    if (alreadyMapped.has(cat)) continue
    if (!catMap.has(cat)) catMap.set(cat, { dishes: [], restaurant: d.restaurant.name })
    catMap.get(cat)!.dishes.push(d.name)
  }

  const newMappings: Array<{ cat: string; qc: QcCategory | typeof EXCLUDE; method: string }> = []
  const needsAI: Array<{ cat: string; dishes: string[]; restaurant: string }> = []

  // Paso 1: reglas
  for (const [cat, info] of catMap) {
    const result = ruleBasedClassify(cat)
    if (result !== null) {
      newMappings.push({ cat, qc: result, method: 'rule' })
    } else {
      needsAI.push({ cat, dishes: info.dishes.slice(0, 5), restaurant: info.restaurant })
    }
  }

  console.log(`Reglas: ${newMappings.length} | AI necesario: ${needsAI.length}`)

  // Paso 2: Haiku para ambiguos (en batches de 30)
  const BATCH = 30
  for (let i = 0; i < needsAI.length; i += BATCH) {
    const batch = needsAI.slice(i, i + BATCH)
    const prompt = `Clasifica cada categoría de carta de restaurante en UNA de estas categorías QC:
${QC_CATEGORIES.join(', ')}, o EXCLUDE (si son bebidas alcohólicas, jugos, salsas, agregados, extras, ingredientes, promociones de precio, accesorios).

Para cada línea responde EXACTAMENTE: NúmeroOriginal|CategoríaQC

${batch.map((b, idx) => `${idx + 1}. Categoría: "${b.cat}" | Local: ${b.restaurant} | Platos: ${b.dishes.join(', ')}`).join('\n')}`

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const lines = text.trim().split('\n')

    for (const line of lines) {
      const match = line.match(/^(\d+)\|(.+)$/)
      if (!match) continue
      const idx = parseInt(match[1]) - 1
      const qc = match[2].trim() as QcCategory | typeof EXCLUDE
      if (idx >= 0 && idx < batch.length) {
        const valid = [...QC_CATEGORIES, EXCLUDE].includes(qc as any)
        newMappings.push({ cat: batch[idx].cat, qc: valid ? qc : 'Sushi', method: 'ai' })
      }
    }

    process.stdout.write(`  Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(needsAI.length / BATCH)} ok\n`)
    await new Promise(r => setTimeout(r, 300))
  }

  // Generar output para CATEGORY_MAP
  const byQc: Record<string, string[]> = {}
  const toExclude: string[] = []

  for (const { cat, qc } of newMappings) {
    if (qc === EXCLUDE) {
      toExclude.push(cat)
    } else {
      if (!byQc[qc]) byQc[qc] = []
      byQc[qc].push(cat)
    }
  }

  let output = '\n// ─── NUEVOS MAPEOS (generados automáticamente) ─────────────────────────\n'
  for (const [qc, cats] of Object.entries(byQc).sort()) {
    output += `\n  // ${qc}\n`
    for (const cat of cats.sort()) {
      output += `  '${cat}': '${qc}',\n`
    }
  }

  output += '\n// ─── EXCLUIR ────────────────────────────────────────────────────────────\n'
  output += '// Agregar a EXCLUDED_CATEGORIES o EXCLUDED_PATTERNS:\n'
  for (const cat of toExclude.sort()) {
    output += `  // '${cat}'\n`
  }

  const outFile = 'scripts/nuevos-mapeos.txt'
  fs.writeFileSync(outFile, output)
  console.log(`\n✓ ${newMappings.length} categorías clasificadas`)
  console.log(`  → ${newMappings.filter(m => m.qc !== EXCLUDE).length} mapeadas a QC`)
  console.log(`  → ${toExclude.length} para excluir`)
  console.log(`\nResultado en: ${outFile}`)

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
