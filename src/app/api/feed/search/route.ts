import { NextResponse } from 'next/server'
import { getSearchIndex } from '@/app/a/lib/search-index'
import { QC_CATEGORIES } from '@/app/a/lib/categories'

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ dishes: [], suggestions: [] })

  const qNorm = norm(q)
  const index = await getSearchIndex()

  // 1. Categorías QC canónicas (las 18 nuestras, no nombres de carta)
  const catSuggestions = [...QC_CATEGORIES]
    .filter(c => norm(c).includes(qNorm))
    .slice(0, 2)
    .map(c => ({ label: c, type: 'categoria' as const }))

  // 2. Locales
  const restSuggestions = index.restaurants
    .filter(r => norm(r.label).includes(qNorm))
    .slice(0, 2)
    .map(r => ({ label: r.label, type: 'local' as const }))

  // 3. Nombres de plato (sin repetir)
  const seenNames = new Set<string>()
  const platoSuggestions: { label: string; type: 'plato' }[] = []
  for (const d of index.dishes) {
    if (platoSuggestions.length >= 3) break
    const nameNorm = norm(d.nombre)
    const key = d.nombre.toLowerCase()
    if (nameNorm.includes(qNorm) && !seenNames.has(key)) {
      seenNames.add(key)
      platoSuggestions.push({ label: d.nombre, type: 'plato' })
    }
  }

  const suggestions = [...catSuggestions, ...restSuggestions, ...platoSuggestions]

  // Platos que coincidan en el _search
  const dishes = index.dishes
    .filter(d => d._search.includes(qNorm))
    .slice(0, 50)

  return NextResponse.json({ dishes, suggestions })
}
