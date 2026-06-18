import { prisma } from '@/lib/prisma'

// Keywords in dish names that clearly indicate a combo
const COMBO_NAME_KEYWORDS = /combo|pack|promo|colaci[oó]n|box|menú\s*del\s*d[ií]a|du[ao]|tr[ií]o|familiar|para\s*\d|2x|3x|4x|\+\s*bebida|\+\s*postre/i

// dishType values that indicate a drink or dessert (confirming it's a real combo)
const DRINK_DESSERT_TYPES = new Set(['bebida','café','latte','cappuccino','mocaccino','chocolate caliente','té','jugo','batido','alcohol','mocktail','helado','torta','brownie','galleta','muffin','cheesecake','churros','donut','flan'])

async function main() {
  const all = await prisma.dish.findMany({
    where: { txDishType: { has: 'combo' } },
    select: { id: true, name: true, txDishType: true }
  })
  console.log('Total with combo in txDishType:', all.length)

  const wrongCombos = all.filter(d => {
    // Has combo keyword in name → keep
    if (COMBO_NAME_KEYWORDS.test(d.name)) return false
    // Has a drink or dessert type → keep (real combo)
    if (d.txDishType.some(t => DRINK_DESSERT_TYPES.has(t))) return false
    // "papas fritas" alone with combo → likely wrong
    return true
  })

  console.log('Likely wrong combos (no combo name keyword, no drink/dessert):', wrongCombos.length)
  for (const d of wrongCombos) {
    console.log(' ', d.name.slice(0, 60), JSON.stringify(d.txDishType))
  }

  if (wrongCombos.length > 0) {
    for (const d of wrongCombos) {
      await prisma.dish.update({
        where: { id: d.id },
        data: { txDishType: d.txDishType.filter(t => t !== 'combo') }
      })
    }
    console.log('Fixed', wrongCombos.length, 'dishes — removed incorrect "combo" label')
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
