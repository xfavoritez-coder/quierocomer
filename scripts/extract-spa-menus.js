/**
 * Extract menus from SPA/iframe restaurants using Puppeteer headless browser.
 * Handles: restomovil (iframe), toteat (Vue SPA), Wix, OlaClick, custom sites.
 */
require('dotenv').config({ path: '.env.local' })
const puppeteer = require('puppeteer')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const RESTAURANTS = [
  {
    slug: 'el-gusto-peruano',
    name: 'El Gusto Peruano',
    url: 'https://www.restomovil.com/mkt/carta/MTQ2_landing.html',
    type: 'restomovil',
  },
  {
    slug: 'moray',
    name: 'Moray',
    url: 'https://www.restomovil.com/mkt/carta/MTQ3_landing.html',
    type: 'restomovil',
  },
  {
    slug: 'sherpa-comida-india',
    name: 'Sherpa Comida India',
    url: 'https://toteat.app/r/cl/SHERPA/8229/checkin/menu',
    type: 'toteat',
  },
  {
    slug: 'siam-thai',
    name: 'Siam Thai',
    url: 'https://www.siamthai.cl/la-carta',
    type: 'wix',
  },
  {
    slug: 'sapiens',
    name: 'Sapiens',
    url: 'https://sapiens.ola.click/products/?type=read&from=qrcode',
    type: 'olaclick',
  },
  {
    slug: 'galpon-italia',
    name: 'Galpón Italia',
    url: 'https://galponitalia.cl/carta/',
    type: 'custom',
  },
  {
    slug: 'tio-tomate',
    name: 'Tío Tomate',
    url: 'https://menu.tu-mesa.com/tio-tomate/7612/menu?idLinktree=2391&locale=es',
    type: 'tumesa',
  },
  {
    slug: 'fuente-chilena',
    name: 'Fuente Chilena',
    url: 'https://qr.recafy.com/es/fuentechilena-barrioitalia/',
    type: 'recafy',
  },
]

async function extractItems(page) {
  // Generic extraction: find all elements that look like menu items
  return await page.evaluate(() => {
    const items = []

    // Strategy 1: Look for price patterns in the page
    const allText = document.body.innerText
    const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

    let currentCategory = ''
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Detect price patterns: $X.XXX, $XX.XXX, or just numbers like 5990, 12990
      const priceMatch = line.match(/\$\s*([\d.,]+)/)
      const numMatch = line.match(/^([\d.,]+)$/)

      if (priceMatch || numMatch) {
        const priceStr = (priceMatch ? priceMatch[1] : numMatch[1]).replace(/\./g, '').replace(',', '')
        const price = parseInt(priceStr)
        if (price < 500 || price > 200000) continue

        // Look backwards for the dish name (usually 1-2 lines above price)
        let name = ''
        let description = null
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const prev = lines[j]
          if (prev.length > 2 && prev.length < 120 && !prev.match(/^\$/) && !prev.match(/^\d+$/)) {
            if (!name) {
              name = prev
            } else if (!description && prev.length > 10) {
              description = prev
            }
            break
          }
        }

        if (name && name.length >= 3) {
          items.push({ name, price, description, category: currentCategory || 'General' })
        }
      }

      // Detect categories: short uppercase lines or lines that are headers
      if (line.length >= 3 && line.length <= 40 && !line.match(/\$/) && !line.match(/^\d/)) {
        const isUpper = line === line.toUpperCase() && line.length > 3
        const looksLikeCategory = isUpper || (line.length < 25 && !line.includes('.') && !line.match(/\d/))
        if (looksLikeCategory && i < lines.length - 2) {
          // Check if next few lines have prices
          const nextLines = lines.slice(i + 1, i + 6).join(' ')
          if (nextLines.match(/\$|[\d]{4,5}/)) {
            currentCategory = line
          }
        }
      }
    }

    return items
  })
}

async function extractRestomovil(page, url) {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))

  // Restomovil loads menu in an iframe or dynamically
  const frames = page.frames()
  for (const frame of frames) {
    try {
      const items = await frame.evaluate(() => {
        const results = []
        // Look for menu items in the frame
        const elements = document.querySelectorAll('.menu-item, .item, .producto, .dish, [class*="product"], [class*="item"]')
        elements.forEach(el => {
          const name = el.querySelector('.name, .title, h3, h4, .producto-nombre')?.textContent?.trim()
          const priceEl = el.querySelector('.price, .precio, .value, [class*="price"]')
          const desc = el.querySelector('.description, .desc, .descripcion, p')?.textContent?.trim()
          if (name && priceEl) {
            const priceText = priceEl.textContent.replace(/[^0-9]/g, '')
            const price = parseInt(priceText)
            if (price > 500 && price < 200000) {
              results.push({ name, price, description: desc || null, category: 'General' })
            }
          }
        })
        return results
      })
      if (items.length > 0) return items
    } catch {}
  }

  // Fallback: extract from main page
  return extractItems(page)
}

async function extractToteat(page, url) {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))

  // Toteat renders a Vue app - wait for content
  try {
    await page.waitForSelector('[class*="menu"], [class*="product"], [class*="item"], .v-list', { timeout: 10000 })
  } catch {}
  await new Promise(r => setTimeout(r, 2000))

  return extractItems(page)
}

async function extractGeneric(page, url) {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  return extractItems(page)
}

async function insertMenu(slug, items) {
  const rest = await prisma.restaurant.findFirst({ where: { slug } })
  if (!rest) { console.log('  NOT FOUND in DB: ' + slug); return 0 }

  let created = 0
  const seen = new Set()
  for (const item of items) {
    if (!item.name || item.price <= 0 || item.price > 100000) continue
    if (item.name.length < 3 || item.name.length > 80) continue
    if (seen.has(item.name)) continue
    seen.add(item.name)

    // Skip generic items
    const lower = item.name.toLowerCase()
    if (lower.includes('adicional') || lower.includes('agregado') || lower.includes('extra ')) continue

    let cat = await prisma.category.findFirst({ where: { name: item.category, restaurantId: rest.id } })
    if (!cat) {
      const maxPos = await prisma.category.aggregate({ where: { restaurantId: rest.id }, _max: { position: true } })
      const dishType = ['Postres', 'Desserts', 'Dulce'].some(t => item.category.toLowerCase().includes(t.toLowerCase())) ? 'dessert' : 'food'
      cat = await prisma.category.create({
        data: { name: item.category, restaurantId: rest.id, dishType, position: (maxPos._max.position ?? 0) + 1 }
      })
    }

    const existing = await prisma.dish.findFirst({ where: { name: item.name, restaurantId: rest.id } })
    if (existing) continue

    const maxDishPos = await prisma.dish.aggregate({ where: { categoryId: cat.id }, _max: { position: true } })
    await prisma.dish.create({
      data: {
        name: item.name, description: item.description || null, price: item.price,
        restaurantId: rest.id, categoryId: cat.id, isActive: true,
        position: (maxDishPos._max.position ?? 0) + 1,
      }
    })
    created++
  }
  return created
}

async function main() {
  console.log('Launching browser...')
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  for (const rest of RESTAURANTS) {
    console.log(`\n${rest.name} (${rest.type})`)
    console.log(`  URL: ${rest.url}`)

    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1280, height: 800 })

    try {
      let items = []

      if (rest.type === 'restomovil') {
        items = await extractRestomovil(page, rest.url)
      } else if (rest.type === 'toteat') {
        items = await extractToteat(page, rest.url)
      } else {
        items = await extractGeneric(page, rest.url)
      }

      console.log(`  Extracted: ${items.length} items`)
      if (items.length > 0) {
        console.log(`  Sample: ${items[0].name} - $${items[0].price}`)
        const created = await insertMenu(rest.slug, items)
        console.log(`  Inserted: ${created} dishes`)
      } else {
        console.log('  No items found')
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`)
    }

    await page.close()
  }

  await browser.close()
  await prisma.$disconnect()
  console.log('\nDone!')
}

main().catch(e => { console.error(e); process.exit(1) })
