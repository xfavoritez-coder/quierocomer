import { PrismaClient } from '@prisma/client'
import https from 'https'
import http from 'http'

const prisma = new PrismaClient()

function fetchUrl(url: string): Promise<{ status: number; finalUrl: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: 10000 }, (res) => {
      // Follow up to 5 redirects manually
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString()
        res.resume()
        resolve(fetchUrl(redirectUrl))
        return
      }
      res.resume()
      resolve({
        status: res.statusCode ?? 0,
        finalUrl: url,
        contentType: res.headers['content-type'] ?? '',
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('timeout'))
    })
  })
}

function isImageUrl(contentType: string): boolean {
  return contentType.toLowerCase().includes('image/')
}

async function main() {
  // Get the restaurant
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: 'el-parron-de-pomaire' },
    select: { id: true, name: true },
  })

  if (!restaurant) {
    console.error('Restaurant el-parron-de-pomaire not found')
    process.exit(1)
  }

  console.log(`\nRestaurant: ${restaurant.name} (${restaurant.id})`)

  // Get all dishes with Google Drive photos
  const dishes = await prisma.dish.findMany({
    where: {
      restaurantId: restaurant.id,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      photos: true,
    },
  })

  const dishesWithDrive = dishes.filter((d) =>
    d.photos.some((p) => p.includes('drive.google.com'))
  )

  console.log(`\nTotal dishes: ${dishes.length}`)
  console.log(`Dishes with Google Drive photos: ${dishesWithDrive.length}`)

  // Also check "natural arandano" specifically
  const arandano = dishes.find((d) => d.name.toLowerCase().includes('arandano') || d.name.toLowerCase().includes('arándano'))
  if (arandano) {
    console.log(`\n"Natural arándano" dish found: ${arandano.name}`)
    console.log(`  Photos: ${JSON.stringify(arandano.photos)}`)
    if (!dishesWithDrive.find((d) => d.id === arandano.id)) {
      console.log(`  (no Drive URLs, not in the Drive-check list)`)
    }
  } else {
    console.log(`\n"Natural arándano" dish not found among active dishes`)
  }

  if (dishesWithDrive.length === 0) {
    console.log('\nNo dishes with Drive URLs found. Nothing to fix.')
    await prisma.$disconnect()
    return
  }

  console.log('\n--- Checking accessibility of Drive URLs ---\n')

  const broken: Array<{ id: string; name: string; photos: string[] }> = []

  for (const dish of dishesWithDrive) {
    const driveUrls = dish.photos.filter((p) => p.includes('drive.google.com'))
    let allBroken = true

    for (const url of driveUrls) {
      try {
        const result = await fetchUrl(url)
        const isImg = isImageUrl(result.contentType)
        const isLoginPage =
          result.finalUrl.includes('accounts.google.com') ||
          result.finalUrl.includes('ServiceLogin') ||
          result.finalUrl.includes('/sorry/') ||
          result.status === 403 ||
          result.status === 401

        console.log(
          `  [${dish.name}] ${url.substring(0, 80)}...`
        )
        console.log(
          `    status=${result.status} contentType="${result.contentType}" isImage=${isImg} loginRedirect=${isLoginPage} finalUrl=${result.finalUrl.substring(0, 80)}`
        )

        if (isImg && !isLoginPage && result.status === 200) {
          allBroken = false
        }
      } catch (err: any) {
        console.log(`  [${dish.name}] ERROR fetching ${url.substring(0, 80)}: ${err.message}`)
      }
    }

    if (allBroken) {
      broken.push(dish)
    }
  }

  console.log(`\n--- Results ---`)
  console.log(`Broken/inaccessible: ${broken.length}`)
  console.log(`OK: ${dishesWithDrive.length - broken.length}`)

  if (broken.length === 0) {
    console.log('\nNo broken Drive URLs found. Nothing to clear.')
    await prisma.$disconnect()
    return
  }

  console.log('\nBroken dishes:')
  for (const d of broken) {
    console.log(`  - ${d.name} (${d.id})`)
    console.log(`    photos: ${JSON.stringify(d.photos)}`)
  }

  console.log('\n--- Clearing photos for broken dishes ---')

  for (const dish of broken) {
    await prisma.dish.update({
      where: { id: dish.id },
      data: { photos: [] },
    })
    console.log(`  Cleared: ${dish.name}`)
  }

  console.log('\nDone. All broken Drive-photo dishes have been cleared.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
