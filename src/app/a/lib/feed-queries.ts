import { prisma } from '@/lib/prisma'
import { normalizeCategory, inferCategoryFromDishName, isExcludedCategory, inferMealTime, inferDishType, QC_LEAVES, AMBIGUOUS_CATEGORIES, getParentCategory, CUISINE_TAGS } from './categories'
import type { FeedDish } from '../types'
import { unstable_cache } from 'next/cache'

// Categorías que solo son válidas inferidas desde el nombre del plato, NO desde la descripción.
// "Papas fritas" y "Ensaladas" suelen aparecer en descripciones como acompañamiento,
// no como el plato principal → ignorarlas cuando inferimos desde description.
const SIDE_ONLY_FROM_NAME = new Set(['Papas fritas', 'Ensaladas'])

/**
 * Tipos de txDishType que representan bebidas o extras (no platos reales).
 * Si TODOS los tipos de un plato están en este set, el plato se excluye del feed.
 * Cubre tanto los valores legacy ("bebida","drink","extra") como los del taxonomizador
 * ("té","jugo","batido","café","latte","cappuccino","mocaccino","chocolate caliente","alcohol","mocktail").
 * Los combos (["combo","hamburguesa","bebida"]) NO se excluyen porque contienen tipos de comida.
 */
const DRINK_ONLY_TYPES = new Set([
  'extra', 'bebida', 'drink',
  'té', 'jugo', 'batido', 'café', 'latte', 'cappuccino', 'mocaccino',
  'chocolate caliente', 'alcohol', 'mocktail',
])

/**
 * Detecta productos envasados/ingredientes crudos por el gramaje en el nombre.
 * Ej: "Tagliatelle N° 2 Granoro 500 grs." → excluir del feed.
 * Aplica en el importer y en el filtro del feed como última línea de defensa.
 */
const PACKAGED_PRODUCT_RE = /\d+\s*(grs?\.?|kg\.?|ml\.?|lt\.?)\s*$/i
export function isPackagedProduct(name: string, description?: string | null): boolean {
  if (PACKAGED_PRODUCT_RE.test(name)) return true
  if (description && /formato\s+\d/i.test(description)) return true
  return false
}

/**
 * Detecta bebidas de marca industrial que nunca deberían aparecer en el feed de platos.
 * Sprite Zero, Fanta, Coca-Cola, etc. suelen importarse desde cartas con txDishType=[]
 * y no son filtrados por el check de DRINK_ONLY_TYPES (que requiere length>0).
 */
const BRANDED_DRINK_RE = /\b(sprite|fanta|coca.?cola|pepsi|7\s*up|seven\s*up|gatorade|powerade|monster|red\s*bull|lipton|nestea|crush|inca\s*kola|bilz|pap[iy]|rc\s*cola|canada\s*dry|schweppes|agua\s*mineral|agua\s*de\s*manantial|evian|vittel|san\s*pellegrino|guaraná|guarana)\b/i
export function isBrandedDrink(name: string): boolean {
  return BRANDED_DRINK_RE.test(name)
}

/**
 * Detecta bebidas alcohólicas y no alcohólicas por nombre genérico.
 * Cubre vinos, cervezas sin volumen (ya capturadas por isVolumeBeverage), licores, jugos, aguas.
 * Ej: "Vino Carmen 34", "Cerveza Artesanal", "Jugo Natural", "Agua Saborizada"
 */
const NAMED_DRINK_RE = /^(vino\b|cerveza\b|bebida\b|jugo\b|n[eé]ctar\b|agua\b|limonada\b|naranjada\b|chicha\b|champagne\b|prosecco\b|espumante\b|pisco\b|ron\b|vodka\b|whisky\b|whiskey\b|gin\b|tequila\b|mezcal\b|fernet\b|aperol\b|cointreau\b|licor\b|cóctel\b|cocktail\b|mockt?ail\b|sangr[ií]a\b|cava\b|sidra\b|kombuch[ae]\b|infusi[oó]n\b|t[eé]\b|caf[eé]\b)/i
export function isNamedDrink(name: string): boolean {
  return NAMED_DRINK_RE.test(name.trim())
}

/**
 * Detecta cócteles y tragos por nombre específico que no están cubiertos por isNamedDrink.
 * Ej: "Mojito Corona Sabores XL", "Caipirinha de Maracuyá", "Pisco Sour", "Piña Colada"
 */
const COCKTAIL_RE = /^(mojito|caipiri[nñ]a?|caipiroska|caipifruta|da[iy]k?iri|daiquiri|negroni|spritz\b|pisco\s+sour|clericot|chilcano|cuba\s+libre|gin\s*[-\s]tonic|bloody\s+mary|cosmopolitan|mai\s+tai|pi[ñn]a\s+colada|paloma\b|michelada|chelado\b|pinche\s+michelada|chopp?\b|fanschop\b|schop\b|draft\b|long\s+island|b52\b|fernet\b|aperol\b|mule\b|moscow\s+mule|london\s+mule|manhattan\b|old\s+fashioned|dry\s+martini|espresso\s+martini|amaretto\b|chardonnay\b|clavo\s+oxidado|j[aä]ger|kir\s+royal|kir\s+|kross\b|austral\b|ramazzotti\b|ruso\s+negro|terremoto\b|tom\s+collins|juan\s+collins|vaina\b|bob\s+marley|infusiones?\b|tequila\s+margarita|st\s+germain|lemon\s+stone|maracuy[aá]\s+stone)/i
export function isCocktailDrink(name: string): boolean {
  return COCKTAIL_RE.test(name.trim())
}

/**
 * Detecta extras, condimentos y guarniciones sueltas que no son platos en sí.
 * Ej: "Salsa Soya", "Ají Cacho de Cabra", "Mostaza", "Almendras", "Maníes"
 */
const CONDIMENT_RE = /^(salsa\b|ají\b|aj[íi]\b|mostaza\b|ketchup\b|mayo[n]?esa\b|vinagre\b|aceite\b|aliño\b|aderezo\b|chimichurri\b|pebre\b|guacamole\b|hummus\b)/i
const STANDALONE_EXTRA_RE = /^(almendras?|man[íi]es?|man[íi]\b|nueces?\b|pistachos?\b|cas[eé]w\b|anacardos?\b|pasta\s+de\s+man[íi]|granola\b)$/i
export function isCondimentOrExtra(name: string): boolean {
  const n = name.trim()
  return CONDIMENT_RE.test(n) || STANDALONE_EXTRA_RE.test(n)
}

/**
 * Detecta bebestibles por medida de volumen líquido en el nombre.
 * Ej: "Kunstmann Trigo 330 ml", "Cerveza 473 cc", "Vino 750ml", "Jugo 1 lt"
 * Aplica en feed, buscador y extractor. No aplica a sólidos (grs/kg son alimentos).
 */
const VOLUME_BEVERAGE_RE = /\b\d+\s*(ml|cl|cc|oz|lt)\b/i
// Palabras que indican comida sólida aunque tengan volumen en el nombre (ej: "Bowl 350ml", "Açaí 470ml")
const VOLUME_FOOD_EXCEPTION_RE = /\b(bowl|bol\b|a[cç]a[ií]|poke|smoothie\s+bowl|granola|parfait)\b/i
export function isVolumeBeverage(name: string): boolean {
  if (VOLUME_FOOD_EXCEPTION_RE.test(name)) return false
  return VOLUME_BEVERAGE_RE.test(name)
}

/**
 * Detecta ítems no alimenticios: ropa, accesorios, insumos, merchandising.
 * Ej: "Polera Rapa Nui", "Vasos Polipapel Grande 12oz", "Envase"
 */
const NON_FOOD_RE = /\b(polera|camiseta|remera|buzo|hoodie|gorra|chaleco|pantalon|polipapel|vaso\s+polipapel|manga\s+pastelera|pitillo|palillo|mondadientes|llavero|im[aá]n|p[oó]ster|sticker|merchandising)\b/i
const NON_FOOD_EXACT = new Set(['envase', 'envases', 'bolsa', 'bolsas', 'vaso', 'vasos', 'cajas'])
export function isNonFoodItem(name: string, categoryName?: string | null): boolean {
  const n = name.toLowerCase().trim()
  if (NON_FOOD_EXACT.has(n)) return true
  if (NON_FOOD_RE.test(name)) return true
  if (categoryName && /\b(merch|merchandising|ropa|indumentaria)\b/i.test(categoryName)) return true
  return false
}

/**
 * Resuelve la leaf category de un plato con prioridad:
 * 1. leafOverride manual (set desde panel de revisión)
 * 2. Si la categoría es ambigua (Combos, Especiales…) → usar primaryCategory del restaurante
 * 3. Inferir desde el nombre del plato
 * 4. Normalizar el nombre de la categoría del restaurante
 * 5. Fallback: nombre de la categoría tal cual
 */
export function resolveDishLeaf(
  dishName: string,
  catName: string,
  leafOverride: string | null,
  restaurantPrimaryCategory: string | null,
  dishDescription?: string | null,
  catNormOverride?: string | null,
): string {
  if (leafOverride && QC_LEAVES.has(leafOverride)) return leafOverride
  // Asignación manual de la sección (normOverride en Category) — tiene prioridad sobre inferencia automática
  if (catNormOverride && QC_LEAVES.has(catNormOverride)) return catNormOverride
  const catNorm = normalizeCategory(catName)
  // "Entradas" es genérica: muchos restaurantes agrupan ahí gyozas, spring rolls, tapas, etc.
  // Intentar inferir desde el nombre del plato antes de aceptar "Entradas" como leaf.
  if (catNorm === 'Entradas') {
    const fromName = inferCategoryFromDishName(dishName)
    if (fromName) return fromName
    if (dishDescription) {
      const fromDesc = inferCategoryFromDishName(dishDescription)
      if (fromDesc && !SIDE_ONLY_FROM_NAME.has(fromDesc)) return fromDesc
    }
  }
  // Si la categoría normaliza a una cocina pura (ej: "Peruana", "China"),
  // preferimos inferir el tipo de plato desde el nombre/descripción primero.
  if (QC_LEAVES.has(catNorm) && !CUISINE_TAGS.has(catNorm)) return catNorm
  if (AMBIGUOUS_CATEGORIES.has(catName.trim()) || AMBIGUOUS_CATEGORIES.has(catNorm)) {
    if (restaurantPrimaryCategory && QC_LEAVES.has(restaurantPrimaryCategory)) return restaurantPrimaryCategory
  }
  // Inferir desde nombre del plato primero, luego descripción como fallback
  const fromName = inferCategoryFromDishName(dishName)
  if (fromName) return fromName
  if (dishDescription) {
    const fromDesc = inferCategoryFromDishName(dishDescription)
    if (fromDesc && !SIDE_ONLY_FROM_NAME.has(fromDesc)) return fromDesc
  }
  // Si la categoría es una cocina, úsala como leaf de último recurso
  if (QC_LEAVES.has(catNorm)) return catNorm
  // Último recurso: primaryCategory del restaurante (aunque la categoría no sea ambigua)
  if (restaurantPrimaryCategory && QC_LEAVES.has(restaurantPrimaryCategory)) return restaurantPrimaryCategory
  // Nada funcionó — marcar explícitamente como sin categoría
  return 'Sin categoría'
}

/** Trae platos para el feed: top 4 por restaurante + 1 por tipo de plato distinto */
async function _getFeedDishes(): Promise<FeedDish[]> {
  const MAX_POPULAR = 4  // top populares siempre incluidos
  const MAX_TOTAL = 10   // tope absoluto por restaurante

  // Dos row_numbers: uno por popularidad, otro por tipo de plato
  // Garantiza diversidad: un restaurante de sushi mostrará también su gyoza/ramen/etc.
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      d.id, d.name, d.description, d.price, d."discountPrice",
      d.photos, d."dishDiet", d."isSpicy", d."isGlutenFree", d."isLactoseFree",
      d."isSoyFree", d."containsNuts", d."flavorTags", d."isHero", d.tags, d."leafOverride", d."createdAt", d."txDishType", d."txIngredient",
      c.name AS "categoryName", c."dishType", c."cuisineTag", c."normOverride" AS "catNormOverride",
      r.id AS "restaurantId", r.name AS "restaurantName", r.slug AS "restaurantSlug",
      r."logoUrl", r.address, r.phone, r.lat, r.lng, r."primaryCategory", r."isShowcase",
      r."googleRating", r."googleRatingCount", r."googleMapsUrl", r."googlePlaceId", r.website, r."websiteIsOrderUrl", r."cartaProvider", r.instagram,
      fs."avgRating", fs."ratingCount", fs."commentCount", fs."popularityScore"
    FROM (
      SELECT d.id,
        ROW_NUMBER() OVER (PARTITION BY d."restaurantId" ORDER BY d."isHero" DESC, COALESCE(fs2."popularityScore", 0) DESC, d."createdAt" DESC) AS rn,
        ROW_NUMBER() OVER (PARTITION BY d."restaurantId", COALESCE(d."txDishType"[1], 'other') ORDER BY d."isHero" DESC, COALESCE(fs2."popularityScore", 0) DESC, d."createdAt" DESC) AS rn_type,
        ROW_NUMBER() OVER (PARTITION BY d."restaurantId" ORDER BY d."isHero" DESC, COALESCE(fs2."popularityScore", 0) DESC, d."createdAt" DESC) AS rn_total
      FROM "Dish" d
      JOIN "Category" c ON c.id = d."categoryId"
      JOIN "Restaurant" r ON r.id = d."restaurantId"
      LEFT JOIN "FeedDishStats" fs2 ON fs2."dishId" = d.id
      WHERE d."isActive" = true
        AND d."deletedAt" IS NULL
        AND d."hiddenFromFeed" = false
        AND array_length(d.photos, 1) > 0
        AND (d.price > 0 OR r."isShowcase" = true)
        AND c."dishType" != 'drink'
        AND r."isActive" = true
        AND r."isDemo" = false
        AND r.lat IS NOT NULL
        AND r.lng IS NOT NULL
        AND (r."googleMapsUrl" IS NOT NULL OR r."isShowcase" = true)
        AND (r."googleRating" IS NOT NULL OR r."isShowcase" = true)
    ) ranked
    JOIN "Dish" d ON d.id = ranked.id
    JOIN "Category" c ON c.id = d."categoryId"
    JOIN "Restaurant" r ON r.id = d."restaurantId"
    LEFT JOIN "FeedDishStats" fs ON fs."dishId" = d.id
    WHERE (ranked.rn <= ${MAX_POPULAR} OR ranked.rn_type = 1)
      AND ranked.rn_total <= ${MAX_TOTAL}
    ORDER BY COALESCE(fs."popularityScore", 0) DESC
  `

  const dishes = rows

  const feedDishes: FeedDish[] = []
  const seenKey = new Set<string>()

  for (const d of dishes) {
    const catName = d.categoryName as string
    if (isExcludedCategory(catName)) continue
    // Excluir extras y bebidas standalone (no platos reales)
    const txTypes = Array.isArray((d as any).txDishType) ? (d as any).txDishType as string[] : []
    if (txTypes.length > 0 && txTypes.every(t => DRINK_ONLY_TYPES.has(t))) continue
    // Excluir bebidas de marca industrial (Sprite Zero, Fanta, etc.) aunque txDishType esté vacío
    if (isBrandedDrink(d.name as string)) continue
    // Excluir bebidas por nombre genérico (Vino, Cerveza, Jugo, Agua, licores, etc.)
    if (isNamedDrink(d.name as string)) continue
    // Excluir cócteles y tragos por nombre (Mojito, Caipirinha, Pisco Sour, etc.)
    if (isCocktailDrink(d.name as string)) continue
    // Excluir bebestibles por medida de volumen líquido (330 ml, 473 cc, 750 ml, etc.)
    if (isVolumeBeverage(d.name as string)) continue
    // Excluir productos envasados (gramaje en nombre o "Formato X" en descripción)
    if (isPackagedProduct(d.name as string, d.description as string | null)) continue
    // Excluir ítems no alimenticios (ropa, accesorios, insumos, merchandising)
    if (isNonFoodItem(d.name as string, catName)) continue
    // Excluir condimentos, salsas y extras sueltos (Salsa Soya, Almendras, Pebre, etc.)
    if (isCondimentOrExtra(d.name as string)) continue
    // Dedup: skip if same (restaurant, dish name) already added — handles imported duplicates
    const dupKey = `${d.restaurantId}::${(d.name as string).toLowerCase().trim()}`
    if (seenKey.has(dupKey)) continue
    seenKey.add(dupKey)
    const categoriaNorm = resolveDishLeaf(d.name as string, catName, d.leafOverride ?? null, d.primaryCategory ?? null, d.description ?? null, (d as any).catNormOverride ?? null)
    const categoriaParent = getParentCategory(categoriaNorm)
    const cuisineTag = (d.cuisineTag as string | null) ?? null
    const photos = Array.isArray(d.photos) ? d.photos : []
    feedDishes.push({
      id: d.id,
      nombre: d.name,
      descripcion: d.description,
      precio: Number((d as any).price ?? 0),
      precioDescuento: d.discountPrice != null ? Number(d.discountPrice) : null,
      fotoUrl: photos[0] ?? null,
      categoria: catName,
      categoriaNorm,
      categoriaParent,
      categoriaTipo: inferDishType(categoriaNorm, d.dishType),
      sabores: Array.isArray(d.flavorTags) ? d.flavorTags : [],
      txDishType: Array.isArray(d.txDishType) ? d.txDishType : [],
      txIngredient: Array.isArray(d.txIngredient) ? d.txIngredient : [],
      dieta: {
        tipo: d.dishDiet as 'VEGAN' | 'VEGETARIAN' | 'OMNIVORE',
        sinGluten: d.isGlutenFree,
        sinLactosa: d.isLactoseFree,
        sinSoja: d.isSoyFree,
        contieneFrutosSecos: d.containsNuts,
        esPicante: d.isSpicy,
      },
      restauranteId: d.restaurantId,
      restaurante: d.restaurantName,
      restauranteSlug: d.restaurantSlug,
      restauranteLogo: d.logoUrl,
      restauranteDireccion: d.address,
      restaurantePhone: (d as any).phone ?? null,
      restaurantePlaceId: (d as any).googlePlaceId ?? null,
      restauranteLat: d.lat != null ? Number(d.lat) : null,
      restauranteLng: d.lng != null ? Number(d.lng) : null,
      isShowcase: Boolean((d as any).isShowcase ?? false),
      enOferta: d.discountPrice != null && d.price != null && Number(d.discountPrice) < Number(d.price),
      mealTime: inferMealTime(categoriaNorm),
      tags: Array.isArray(d.tags) ? d.tags : [],
      isHero: d.isHero,
      googleRating: d.googleRating != null ? Number(d.googleRating) : null,
      googleRatingCount: d.googleRatingCount != null ? Number(d.googleRatingCount) : null,
      googleMapsUrl: d.googleMapsUrl ?? null,
      restauranteWebsite: (d as any).website ?? null,
      restauranteWebsiteIsOrderUrl: Boolean((d as any).websiteIsOrderUrl ?? false),
      restauranteCartaProvider: (d as any).cartaProvider ?? null,
      restauranteInstagram: (d as any).instagram ?? null,
      avgRating: d.avgRating != null ? Number(d.avgRating) : null,
      ratingCount: Number(d.ratingCount ?? 0),
      commentCount: Number(d.commentCount ?? 0),
      popularityScore: Number(d.popularityScore ?? 0),
      cuisineTag,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    })
  }

  return feedDishes
}

/** Cached version — shared across all users, revalidates every 5 minutes */
export const getFeedDishes = unstable_cache(
  _getFeedDishes,
  ['feed-dishes-v10'],
  { revalidate: 300, tags: ['feed-dishes'] }, // 5 minutes
)


/** Cached category count map — full DB, revalidates every 12 hours via cron */
export const getCachedCategoryCountMap = unstable_cache(
  async () => {
    const rows = await prisma.$queryRaw<{ name: string; catName: string; leafOverride: string | null; primaryCategory: string | null; description: string | null; catNormOverride: string | null; txDishType: string[] }[]>`
      SELECT d.name, c.name AS "catName", d."leafOverride", r."primaryCategory", d.description,
             c."normOverride" AS "catNormOverride", d."txDishType"
      FROM "Dish" d
      JOIN "Category" c ON c.id = d."categoryId"
      JOIN "Restaurant" r ON r.id = d."restaurantId"
      WHERE d."isActive" = true
        AND d."deletedAt" IS NULL
        AND d."hiddenFromFeed" = false
        AND array_length(d.photos, 1) > 0
        AND d.price > 0
        AND c."dishType" != 'drink'
        AND r."isActive" = true
        AND r."isDemo" = false
    `
    const map: Record<string, number> = {}
    for (const row of rows) {
      if (isExcludedCategory(row.catName)) continue
      const txTypes = Array.isArray(row.txDishType) ? row.txDishType as string[] : []
      if (txTypes.length > 0 && txTypes.every((t: string) => DRINK_ONLY_TYPES.has(t))) continue
      if (isBrandedDrink(row.name)) continue
      if (isNamedDrink(row.name)) continue
      if (isCocktailDrink(row.name)) continue
      if (isVolumeBeverage(row.name)) continue
      if (isPackagedProduct(row.name, row.description)) continue
      if (isNonFoodItem(row.name, row.catName)) continue
      if (isCondimentOrExtra(row.name)) continue
      const leaf = resolveDishLeaf(row.name, row.catName, row.leafOverride, row.primaryCategory, row.description, row.catNormOverride)
      const parent = getParentCategory(leaf)
      if (parent) map[parent] = (map[parent] ?? 0) + 1
    }
    return map
  },
  ['category-count-map'],
  { revalidate: 43200, tags: ['dish-count'] }, // 12 hours, same tag as dish-count cron
)

/** Fetch specific dishes by ID (for vector-scored dishes missing from the cache) */
export async function getDishesById(ids: string[]): Promise<FeedDish[]> {
  if (ids.length === 0) return []

  const dishes = await prisma.dish.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, name: true, description: true, price: true, discountPrice: true,
      photos: true, dishDiet: true, isSpicy: true, isGlutenFree: true,
      isLactoseFree: true, isSoyFree: true, containsNuts: true, flavorTags: true,
      isHero: true, tags: true, leafOverride: true, txDishType: true, txIngredient: true,
      category: { select: { name: true, dishType: true, cuisineTag: true, normOverride: true } },
      restaurant: { select: { id: true, name: true, slug: true, logoUrl: true, address: true, phone: true, lat: true, lng: true, googleRating: true, googleRatingCount: true, googleMapsUrl: true, googlePlaceId: true, primaryCategory: true, website: true, websiteIsOrderUrl: true, cartaProvider: true, instagram: true, isShowcase: true } },
      feedStats: { select: { avgRating: true, ratingCount: true, commentCount: true, popularityScore: true } },
    },
  })

  return dishes
    .filter(d => !isExcludedCategory(d.category.name) && !(d.txDishType?.length > 0 && d.txDishType.every(t => DRINK_ONLY_TYPES.has(t))) && !isBrandedDrink(d.name) && !isNamedDrink(d.name) && !isCocktailDrink(d.name) && !isVolumeBeverage(d.name) && !isPackagedProduct(d.name, d.description) && !isNonFoodItem(d.name, d.category.name) && !isCondimentOrExtra(d.name))
    .map(dish => {
      const categoriaNorm = resolveDishLeaf(dish.name, dish.category.name, dish.leafOverride ?? null, dish.restaurant.primaryCategory ?? null, dish.description ?? null, dish.category.normOverride ?? null)
      const categoriaParent = getParentCategory(categoriaNorm)
      return {
        id: dish.id, nombre: dish.name, descripcion: dish.description,
        precio: dish.price ?? 0, precioDescuento: dish.discountPrice,
        fotoUrl: dish.photos[0] ?? null, categoria: dish.category.name,
        categoriaNorm, categoriaParent, categoriaTipo: inferDishType(categoriaNorm, dish.category.dishType),
        cuisineTag: dish.category.cuisineTag ?? null,
        sabores: dish.flavorTags,
        txDishType: dish.txDishType ?? [],
        txIngredient: dish.txIngredient ?? [],
        dieta: {
          tipo: dish.dishDiet as 'VEGAN' | 'VEGETARIAN' | 'OMNIVORE',
          sinGluten: dish.isGlutenFree, sinLactosa: dish.isLactoseFree,
          sinSoja: dish.isSoyFree, contieneFrutosSecos: dish.containsNuts, esPicante: dish.isSpicy,
        },
        restauranteId: dish.restaurant.id, restaurante: dish.restaurant.name,
        restauranteSlug: dish.restaurant.slug, restauranteLogo: dish.restaurant.logoUrl,
        restauranteDireccion: dish.restaurant.address,
        restauranteLat: dish.restaurant.lat, restauranteLng: dish.restaurant.lng,
        googleRating: dish.restaurant.googleRating ?? null,
        googleRatingCount: dish.restaurant.googleRatingCount ?? null,
        restaurantePhone: dish.restaurant.phone ?? null,
        restaurantePlaceId: (dish.restaurant as any).googlePlaceId ?? null,
        googleMapsUrl: dish.restaurant.googleMapsUrl ?? null,
        restauranteWebsite: dish.restaurant.website ?? null,
        restauranteWebsiteIsOrderUrl: Boolean((dish.restaurant as any).websiteIsOrderUrl ?? false),
        restauranteCartaProvider: (dish.restaurant as any).cartaProvider ?? null,
        restauranteInstagram: (dish.restaurant as any).instagram ?? null,
        isShowcase: Boolean((dish.restaurant as any).isShowcase ?? false),
        enOferta: dish.discountPrice != null && dish.price != null && dish.discountPrice < dish.price,
        mealTime: inferMealTime(categoriaNorm), tags: dish.tags, isHero: dish.isHero,
        avgRating: dish.feedStats?.avgRating ?? null,
        ratingCount: dish.feedStats?.ratingCount ?? 0,
        commentCount: dish.feedStats?.commentCount ?? 0,
        popularityScore: dish.feedStats?.popularityScore ?? 0,
      }
    })
}
