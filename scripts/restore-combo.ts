import { prisma } from '@/lib/prisma'

// Dishes that are legitimately combos but got "combo" removed wrongly
// Criteria: name OR types suggest it's a real set/bundle
const REAL_COMBO_NAME = /tabla|menú|menu|piez[ao]s|cortes|bocados|barco|\d+\s*mix|\bpara\s*\d|\d+\s*pers|selección|surtida|\bmixta\b|\bmixto\b|trilog[ií]a|trilogia|dueto|\bpar[ao]\s*dos\b|\bparrillada\b|rosticceria|ronda\s+inka|carreta|barco|opci[oó]n\s*\d|\d\s*x\s*\d|para\s*compartir|\bset\b|\bpack\b|\bmenú\s+\d|\d+\s+piezas|\d+\s+rolls|\d+\s+cortes|\bkids\s+menú\b|menú\s+kids|bolsita\s+niño|plato\s+niño|opción\s+popular|opción\s+clásica|opción\s+preferida|\+\s*papas|\bpromo\b|gaby.s\s+\d|oceanika|entrad[ao]\s*\+|fondo\s*\+|colación/i

async function main() {
  // Find dishes that currently DON'T have "combo" but likely should
  // We find dishes where: txDishType has sushi/sharing-meal types but no combo
  const candidates = await prisma.dish.findMany({
    where: {
      NOT: { txDishType: { has: 'combo' } },
      txDishType: { isEmpty: false }
    },
    select: { id: true, name: true, txDishType: true }
  })
  
  let toRestore = candidates.filter(d => {
    const types = d.txDishType
    const name = d.name
    
    // Sushi sets / plates: has sushi + more types OR name suggests multiple pieces
    if (types.includes('sushi') && (types.length >= 2 || /\d+\s*(piez|corte|mix|bocado)/i.test(name))) return true
    // Name clearly indicates a combo/set
    if (REAL_COMBO_NAME.test(name)) return true
    // Multiple food types (3+) suggests a sharing platter
    const FOOD_TYPES = ['hamburguesa','sándwich','pizza','taco','alitas','empanada','aros de cebolla','nuggets','tenders','ceviche','sushi','gyoza','hand roll','churrasco','completo']
    const foodTypeCount = types.filter(t => FOOD_TYPES.includes(t)).length
    if (foodTypeCount >= 2) return true
    // Chapsui + arroz (Chinese restaurant set menus)
    if (types.includes('chapsui') && types.includes('arroz')) return true
    // wantan sets
    if (types.includes('wantan') && types.length >= 2) return true
    
    return false
  })
  
  console.log('To restore "combo":', toRestore.length)
  toRestore.slice(0, 30).forEach(d => console.log(' ', d.name.slice(0,60), JSON.stringify(d.txDishType)))
  if (toRestore.length > 30) console.log('  ...and', toRestore.length - 30, 'more')
  
  for (const d of toRestore) {
    await prisma.dish.update({
      where: { id: d.id },
      data: { txDishType: ['combo', ...d.txDishType] }
    })
  }
  console.log('Restored', toRestore.length, 'dishes')
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
