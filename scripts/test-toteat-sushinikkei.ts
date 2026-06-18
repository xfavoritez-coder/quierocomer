import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { extractToteat } from '../src/lib/extractors/toteat'

async function main() {
  const url = 'https://toteat.app/r/cl/Sushinikkei17/4932/checkin/menu'
  console.log('Extrayendo:', url)
  console.log('---')
  try {
    const result = await extractToteat(url)
    console.log('Restaurante:', result.restaurantName)
    console.log('Platos:', result.dishes.length)
    console.log('Logo:', result.logoUrl)
    if (result.dishes.length > 0) {
      console.log('\nPrimeros 3 platos:')
      result.dishes.slice(0, 3).forEach(d => {
        console.log(`  - ${d.name} ($${d.price}) [${d.category}]`)
      })
    }
  } catch (e: any) {
    console.error('ERROR:', e.message)
  }
}

main()
