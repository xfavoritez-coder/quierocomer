export type FeedDish = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  precioDescuento: number | null
  fotoUrl: string | null
  categoria: string        // Category.name original
  categoriaNorm: string    // Categoría normalizada (para scoring)
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
  enOferta: boolean
  tags: string[]           // RECOMMENDED, NEW, MOST_ORDERED
  isHero: boolean
  // Stats (de FeedDishStats, si existen)
  avgRating: number | null
  ratingCount: number
  commentCount: number
  popularityScore: number
}
