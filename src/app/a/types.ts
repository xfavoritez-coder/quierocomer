export type FeedDish = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  isShowcase?: boolean
  precioDescuento: number | null
  fotoUrl: string | null
  categoria: string        // Category.name original (del restaurante)
  categoriaNorm: string    // Leaf category (ej: "Pollo y alitas", "Ceviches") — tipo del plato
  categoriaParent?: string // Parent category (ej: "Japonesa", "Comida rápida") — para filtro del feed
  cuisineTag: string | null // Cocina de la sección (ej: "Peruana", "China") — segunda dimensión
  categoriaTipo: string    // "food" | "drink" | "dessert"
  sabores: string[]        // Dish.flavorTags
  txDishType?: string[]    // AI taxonomy dish type (ej: "empanada", "pizza", "completo")
  txIngredient?: string[]  // AI taxonomy main ingredient (ej: "pollo", "cerdo", "salmon")
  dieta: {
    tipo: 'VEGAN' | 'VEGETARIAN' | 'OMNIVORE'
    sinGluten: boolean
    sinLactosa: boolean
    sinSoja: boolean
    contieneFrutosSecos: boolean
    esPicante: boolean
  }
  restauranteId: string
  restaurante: string      // Restaurant.name
  restauranteSlug: string
  restauranteLogo: string | null
  restauranteDireccion: string | null
  restaurantePhone?: string | null
  restaurantePlaceId?: string | null
  restauranteLat: number | null
  restauranteLng: number | null
  enOferta: boolean
  mealTime: 'desayuno' | 'almuerzo_cena'
  tags: string[]           // RECOMMENDED, NEW, MOST_ORDERED
  isHero: boolean
  // Google Places
  googleRating?: number | null
  googleRatingCount?: number | null
  googleMapsUrl?: string | null
  restauranteWebsite?: string | null  // Restaurant.website — URL de pedido online (Rappi, UberEats, web propia)
  // Stats (de FeedDishStats, si existen)
  avgRating: number | null
  ratingCount: number
  commentCount: number
  popularityScore: number
  createdAt?: string | null
}
