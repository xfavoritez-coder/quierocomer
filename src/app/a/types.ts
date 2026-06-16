export type FeedDish = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  precioDescuento: number | null
  fotoUrl: string | null
  categoria: string        // Category.name original (del restaurante)
  categoriaNorm: string    // Leaf category (ej: "Ramen", "Hamburguesas") — para modal y recomendaciones
  categoriaParent?: string // Parent category (ej: "Japonesa", "Comida rápida") — para filtro del feed
  categoriaTipo: string    // "food" | "drink" | "dessert"
  sabores: string[]        // Dish.flavorTags
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
  // Stats (de FeedDishStats, si existen)
  avgRating: number | null
  ratingCount: number
  commentCount: number
  popularityScore: number
}
