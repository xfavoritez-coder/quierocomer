import { config } from 'dotenv'
config({ path: '.env.local' })

const url = 'https://www.pedidosya.cl/restaurantes/santiago/la-pica-de-vicente-menu'

async function main() {
  // Test 1: fetch directo buscando __NEXT_DATA__
  console.log('=== Fetch directo ===')
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'es-CL,es;q=0.9',
    }
  })
  const html = await res.text()
  console.log('Status:', res.status, '| Length:', html.length)

  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextData) {
    console.log('Tiene __NEXT_DATA__, longitud:', nextData[1].length)
    try {
      const data = JSON.parse(nextData[1])
      const pageProps = data?.props?.pageProps ?? {}
      console.log('Keys en pageProps:', Object.keys(pageProps).join(', '))
      // Buscar algo que parezca menú
      const str = JSON.stringify(pageProps)
      console.log('Contiene "menuSection":', str.includes('menuSection'))
      console.log('Contiene "product":', str.includes('product'))
      console.log('Contiene "sections":', str.includes('sections'))
      console.log('Longitud pageProps JSON:', str.length)
    } catch { console.log('No parseable') }
  } else {
    console.log('Sin __NEXT_DATA__')
    console.log('HTML snippet:', html.substring(0, 300))
  }

  // Test 2: Jina
  console.log('\n=== Jina (markdown) ===')
  const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      'Accept': '*/*',
      'X-Timeout': '30000',
    }
  })
  const jinaText = await jinaRes.text()
  console.log('Jina status:', jinaRes.status, '| Length:', jinaText.length)
  // Mostrar primeros 1000 chars para ver si tiene contenido útil
  console.log('Jina snippet:\n', jinaText.substring(0, 1000))
}

main()
