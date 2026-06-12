# QuieroComer Feed — `/a` — Documento Maestro

> Última actualización: 2026-06-11
> Estado: Pre-construcción — diseño cerrado, schema definido

---

## 1. Visión del producto

### Qué es
Un **feed de descubrimiento de platos** montado en `quierocomer.cl/a`. La unidad del sistema
es el **plato**, no el restaurante. El usuario no pregunta "¿a qué local voy?", pregunta
"¿qué se me antoja comer?".

### Para quién
Cualquier persona que quiera descubrir platos nuevos. No necesita cuenta, no necesita estar
registrado en ningún restaurante. Es un producto **B2C abierto**.

### Referentes de diseño
- **Pinterest** (referente principal): masonry grid, exploración visual libre, guardar en colecciones
- **TikTok**: el algoritmo de recomendación que aprende del comportamiento, no de lo que declaras
- **Instagram Explore**: tocar un elemento abre un modal inmersivo
- **Airbnb**: cards con fotos de calidad, diseño limpio y cálido

### Modelo de negocio (futuro)
No hay modelo de negocio inmediato. Para validar tracción primero. Ideas futuras:
- Publicidad: platos promocionados que aparecen primero (como TikTok ads)
- Posicionamiento: restaurantes pagan por aparecer más arriba
- Anuncios intercalados en el feed
- Datos de preferencias para los restaurantes

### Los restaurantes
Los restaurantes que aparecen **no necesariamente saben** que están en el feed. Se usan los
platos que ya existen en el sistema de Carta QR Viva. En el futuro:
- Un restaurante puede **reclamar su perfil** y gestionarlo
- Cada plato muestra el perfil del local que lo publicó
- Tocando el local se ve su carta completa (link a `/carta/{slug}`)

---

## 2. Principios de diseño

1. **Mobile-first.** Se diseña para teléfono. Ancho ~460px centrado.
2. **Fondo oscuro** (`#0e0e0e`) siempre. Sin modo claro.
3. **Tipografía:** Playfair Display (títulos/nombres de platos), DM Sans (cuerpo/UI).
4. **Color acento:** ámbar `#F4A623`.
5. **Solo platos con foto** en el MVP. Sin foto = no aparece.
6. **Sin bebidas.** Solo comida y postres. Excluir: Cervezas, Bebidas, Bebestibles,
   Mocktails, Jugos, Destilados, Cócteles y similares.
7. **Design system existente.** Reusar variables CSS/Tailwind, fuentes, colores del proyecto.

---

## 3. Datos reales (snapshot 2026-06-11)

| Dato                          | Cantidad |
|-------------------------------|----------|
| Platos activos total          | 14,666   |
| Con foto + precio > 0         | 3,307    |
| Restaurantes con foto         | 42       |
| Con flavorTags                | 0        |
| Con ingredientes estructurados| 270      |
| Vegano/Vegetariano            | 463      |
| En oferta (discountPrice)     | 4        |
| Ratings existentes            | 0        |
| Favoritos existentes          | 13       |

### Implicaciones
- **FlavorTags**: no existen. El scoring funciona solo con categorías. Se pueden agregar después.
- **Ratings**: arrancan en 0, los generan los usuarios del feed.
- **Ingredientes**: solo 8% de platos. El filtro "qué no comes" se omite en onboarding.
- **Ofertas**: se muestran si hay, se ocultan si no hay. Sección dinámica.

---

## 4. Modelo de datos (BD real)

### Modelos existentes que se usan (solo lectura)

- **`Dish`**: plato con name, price, discountPrice, photos[], dishDiet, flavorTags[],
  isSpicy, isGlutenFree, isLactoseFree, isSoyFree, containsNuts, isHero, tags[], categoryId,
  restaurantId, isActive, deletedAt
- **`Category`**: name, dishType ("food"/"drink"/"dessert"), restaurantId
- **`Restaurant`**: name, slug, logoUrl, address, isActive, isDemo
- **`DishIngredient`** → **`Ingredient`**: ingredientes estructurados por plato

### Modelos nuevos del Feed (lectura + escritura)

```prisma
model FeedUser {
  id                String   @id @default(cuid())
  fingerprint       String   @unique           // cookie persistente
  displayName       String?                    // nombre opcional
  avatarUrl         String?

  // Restricciones dietéticas (filtro duro)
  isVegan           Boolean  @default(false)
  isVegetarian      Boolean  @default(false)
  isGlutenFree      Boolean  @default(false)
  isLactoseFree     Boolean  @default(false)

  // Perfil de gustos (aprendido del comportamiento)
  categoryScores    Json     @default("{}")    // { "Sushi": 45, "Pizza": 23, ... }
  restaurantScores  Json     @default("{}")    // { "rest_id": 12, ... }
  priceMin          Float?                     // rango de precio aprendido
  priceMax          Float?

  // Estado
  totalInteractions Int      @default(0)
  onboardingDone    Boolean  @default(false)
  lastSeenAt        DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  interactions      FeedInteraction[]
  savedDishes       FeedSaved[]
  ratings           FeedRating[]
  comments          FeedComment[]

  @@index([lastSeenAt])
}

model FeedInteraction {
  id          String     @id @default(cuid())
  feedUserId  String
  dishId      String
  action      FeedAction
  dwellMs     Int?                             // para VIEW: ms que el plato fue visible
  category    String?                          // snapshot de categoría normalizada
  createdAt   DateTime   @default(now())

  feedUser    FeedUser   @relation(fields: [feedUserId], references: [id])
  dish        Dish       @relation(fields: [dishId], references: [id])

  @@index([feedUserId, createdAt])
  @@index([dishId])
  @@index([action, createdAt])
}

enum FeedAction {
  VIEW
  TAP
  LIKE
  SAVE
  ANTOJO
  PASS
  SCROLL_BACK
}

model FeedSaved {
  id          String       @id @default(cuid())
  feedUserId  String
  dishId      String
  type        FeedSaveType
  createdAt   DateTime     @default(now())

  feedUser    FeedUser     @relation(fields: [feedUserId], references: [id])
  dish        Dish         @relation(fields: [dishId], references: [id])

  @@unique([feedUserId, dishId])
  @@index([feedUserId, type])
}

enum FeedSaveType {
  ANTOJO
  SAVED
}

model FeedRating {
  id          String   @id @default(cuid())
  feedUserId  String
  dishId      String
  stars       Int                              // 1-5
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  feedUser    FeedUser @relation(fields: [feedUserId], references: [id])
  dish        Dish     @relation(fields: [dishId], references: [id])

  @@unique([feedUserId, dishId])
  @@index([dishId])
}

model FeedComment {
  id          String   @id @default(cuid())
  feedUserId  String
  dishId      String
  text        String
  createdAt   DateTime @default(now())

  feedUser    FeedUser @relation(fields: [feedUserId], references: [id])
  dish        Dish     @relation(fields: [dishId], references: [id])

  @@index([dishId, createdAt])
  @@index([feedUserId])
}

model FeedDishStats {
  id              String   @id @default(cuid())
  dishId          String   @unique
  totalViews      Int      @default(0)
  totalTaps       Int      @default(0)
  totalLikes      Int      @default(0)
  totalSaves      Int      @default(0)
  totalAntojos    Int      @default(0)
  totalPasses     Int      @default(0)
  avgRating       Float?
  ratingCount     Int      @default(0)
  commentCount    Int      @default(0)
  popularityScore Float    @default(0)         // ponderado compuesto
  trendingScore   Float    @default(0)         // actividad reciente, decae con el tiempo
  updatedAt       DateTime @updatedAt

  dish            Dish     @relation(fields: [dishId], references: [id])

  @@index([popularityScore])
  @@index([trendingScore])
}
```

Relaciones inversas en `Dish` (agregar al modelo existente):
```prisma
feedInteractions  FeedInteraction[]
feedSaved         FeedSaved[]
feedRatings       FeedRating[]
feedComments      FeedComment[]
feedStats         FeedDishStats?
```

---

## 5. Categorías normalizadas

Las categorías de la BD son inconsistentes (duplicados, mayúsculas). Se normalizan en código
con un mapa estático. Este mapa se usa para:
- Scoring (agrupar categorías equivalentes)
- Chips en Explorar
- Onboarding (si se agrega en el futuro)
- Motivos de recomendación

```ts
const CATEGORY_MAP: Record<string, string> = {
  // Sushi & Rolls
  'Sushi': 'Sushi & Rolls',
  'Handrolls': 'Sushi & Rolls',
  'California Rolls': 'Sushi & Rolls',
  'Nikkei Rolls': 'Sushi & Rolls',
  'Rolls': 'Sushi & Rolls',

  // Ceviches & Mariscos
  'Ceviches': 'Ceviches & Mariscos',
  'Ceviche': 'Ceviches & Mariscos',
  'Pescados y Mariscos': 'Ceviches & Mariscos',

  // Pizzas
  'Pizzas': 'Pizzas',
  'Pizza': 'Pizzas',

  // Hamburguesas
  'Hamburguesas': 'Hamburguesas',
  'Completos': 'Hamburguesas',

  // Sandwiches
  'Sandwiches': 'Sandwiches',
  'Sandwich': 'Sandwiches',
  'Sándwiches': 'Sandwiches',

  // Ensaladas
  'Ensaladas': 'Ensaladas',

  // Entradas
  'Entradas': 'Entradas',
  'Para Comenzar': 'Entradas',
  'Aperitivos': 'Entradas',
  'Para Compartir': 'Entradas',
  'Para compartir': 'Entradas',

  // Postres
  'Postres': 'Postres',
  'POSTRES': 'Postres',
  'Postres y Bebidas': 'Postres',

  // Parrilla & Carnes
  'Parrilladas': 'Parrilla & Carnes',
  'Platos Principales': 'Parrilla & Carnes',
  'Platos Calientes': 'Parrilla & Carnes',

  // Empanadas
  'Empanadas': 'Empanadas',

  // Mexicana
  'Fajitas': 'Mexicana',

  // Combos
  'Combos': 'Combos',
  'Promociones': 'Combos',

  // Acompañamientos
  'Acompañamientos': 'Acompañamientos',
  'Papas Fritas': 'Acompañamientos',

  // Cafetería (solo items de comida)
  'Cafetería': 'Cafetería',
  'DESAYUNOS': 'Desayunos',
}

// Categorías que se EXCLUYEN del feed (bebidas)
const EXCLUDED_CATEGORIES = [
  'Bebidas', 'Bebestibles', 'Cervezas', 'Mocktails',
  'Jugos', 'Destilados', 'COCTELES', 'Vinos', 'Tragos',
]
```

### Mapa de adyacencia (para "descubrimiento")

```ts
const ADJACENT_CATEGORIES: Record<string, string[]> = {
  'Sushi & Rolls': ['Ceviches & Mariscos'],
  'Ceviches & Mariscos': ['Sushi & Rolls', 'Entradas'],
  'Hamburguesas': ['Sandwiches', 'Combos'],
  'Sandwiches': ['Hamburguesas'],
  'Pizzas': ['Combos', 'Hamburguesas'],
  'Parrilla & Carnes': ['Entradas', 'Empanadas'],
  'Entradas': ['Ceviches & Mariscos', 'Ensaladas'],
  'Ensaladas': ['Entradas'],
  'Empanadas': ['Parrilla & Carnes', 'Entradas'],
  'Mexicana': ['Entradas', 'Parrilla & Carnes'],
  'Postres': ['Cafetería', 'Desayunos'],
  'Cafetería': ['Postres', 'Desayunos'],
}
```

### Gradientes por categoría (fallback visual cuando no hay foto)

```ts
const CATEGORY_GRADIENTS: Record<string, string> = {
  'Sushi & Rolls':       'linear-gradient(135deg, #1a1a2e, #e94560)',
  'Ceviches & Mariscos': 'linear-gradient(135deg, #0f3460, #16c79a)',
  'Pizzas':              'linear-gradient(135deg, #b83b5e, #f08a5d)',
  'Hamburguesas':        'linear-gradient(135deg, #3d1e00, #f4a623)',
  'Sandwiches':          'linear-gradient(135deg, #5c3d2e, #e6a157)',
  'Ensaladas':           'linear-gradient(135deg, #1b4332, #52b788)',
  'Entradas':            'linear-gradient(135deg, #3a0ca3, #f72585)',
  'Postres':             'linear-gradient(135deg, #7b2869, #f4a9c0)',
  'Parrilla & Carnes':   'linear-gradient(135deg, #2d0000, #c1121f)',
  'Empanadas':           'linear-gradient(135deg, #6b4226, #d4a373)',
  'Mexicana':            'linear-gradient(135deg, #3d0c02, #e36414)',
  'Combos':              'linear-gradient(135deg, #1b1b2f, #f4a623)',
  'Acompañamientos':     'linear-gradient(135deg, #4a4e69, #c9ada7)',
  'Cafetería':           'linear-gradient(135deg, #2b1a0e, #a67c52)',
  'Desayunos':           'linear-gradient(135deg, #f4a623, #ffeaa7)',
  '_default':            'linear-gradient(135deg, #1a1a2e, #f4a623)',
}
```

---

## 6. Motor de scoring

### Filosofía
No preguntamos qué le gusta al usuario. **Lo aprendemos de su comportamiento.**
Igual que TikTok: el feed inicial es diverso, y con cada interacción se personaliza más.

### Señales y pesos

| Señal              | Categoría | Restaurante | Precio | Plato individual      |
|--------------------|-----------|-------------|--------|-----------------------|
| Dwell > 2s (VIEW)  | +2        | +1          | ajusta | marcar como "visto"   |
| TAP (abrir modal)  | +5        | +2          | ajusta | —                     |
| LIKE               | +12       | +4          | ajusta | marcar como liked     |
| SAVE               | +15       | +5          | ajusta | marcar como guardado  |
| ANTOJO             | +10       | +3          | ajusta | marcar como antojo    |
| Rating 4-5⭐       | +8        | +3          | —      | —                     |
| Rating 1-2⭐       | -6        | -3          | —      | —                     |
| Comentario         | +4        | +2          | —      | —                     |
| PASS               | -9        | -2          | —      | no volver a mostrar   |
| SCROLL_BACK        | +7        | +3          | —      | —                     |
| Scroll rápido      | -1        | —           | —      | —                     |

### Ajuste de precio
Con cada interacción positiva, el sistema registra el precio del plato. Después de 10+
interacciones, calcula `priceMin` y `priceMax` como el rango donde el usuario más interactúa
(percentil 20-80 de los precios de platos con interacción positiva).

### Cálculo de afinidad

```ts
function affinity(plato: FeedDish, perfil: FeedUser): number {
  const catScore = perfil.categoryScores[plato.categoriaNorm] ?? 0
  const restScore = perfil.restaurantScores[plato.restauranteId] ?? 0

  let score = catScore + (restScore * 0.5)

  // Bonus por adyacencia (descubrimiento)
  const adjacent = ADJACENT_CATEGORIES[plato.categoriaNorm] ?? []
  for (const adj of adjacent) {
    const adjScore = perfil.categoryScores[adj] ?? 0
    if (adjScore >= 16) score += adjScore * 0.3
  }

  // Bonus por popularidad del plato
  if (plato.popularityScore) score += plato.popularityScore * 0.2

  // Bonus si está en oferta
  if (plato.enOferta) score += 5

  // Penalización si ya fue visto
  if (plato.yaVisto) score -= 12

  // Penalización si el precio está fuera del rango aprendido
  if (perfil.priceMin && perfil.priceMax) {
    if (plato.precio < perfil.priceMin || plato.precio > perfil.priceMax) {
      score -= 4
    }
  }

  // Ruido para variedad
  score += Math.random() * 3

  return score
}
```

### Motivo de recomendación

```ts
function getMotivo(plato: FeedDish, perfil: FeedUser): string | null {
  const catScore = perfil.categoryScores[plato.categoriaNorm] ?? 0

  // Por categoría directa
  if (catScore >= 16) return `Porque te gusta ${plato.categoriaNorm.toLowerCase()}`

  // Por adyacencia
  const adjacent = ADJACENT_CATEGORIES[plato.categoriaNorm] ?? []
  for (const adj of adjacent) {
    if ((perfil.categoryScores[adj] ?? 0) >= 16) {
      return `Si te gusta ${adj.toLowerCase()}, prueba esto`
    }
  }

  // Por popularidad
  if (plato.popularityScore > 50) return `Popular en ${plato.restaurante}`

  // Por oferta
  if (plato.enOferta) return `En oferta`

  // Sin motivo claro (primeras interacciones)
  return null
}
```

### Indicador de calibración
Mientras `totalInteractions < 10`: mostrar un badge sutil "Aprendiendo tus gustos..."
Después de 10: el feed ya está personalizado, no mostrar nada.

---

## 7. Onboarding

### Flujo: 1 sola pantalla

**"¿Tienes alguna restricción alimentaria?"**

Opciones con toggle:
- 🌱 Vegano
- 🥬 Vegetariano
- 🌾 Sin gluten
- 🥛 Sin lactosa

Botón grande: **"Como de todo"** (salta las restricciones).

Después de esta pantalla → directo al feed con platos diversos.

**No preguntamos gustos.** Los gustos se aprenden del comportamiento (señales implícitas
y explícitas). Si alguien "come de todo", el feed inicial es diverso y se personaliza rápido.

### Creación del FeedUser
Al completar el onboarding (o tocar "Como de todo"):
1. Generar un `fingerprint` UUID
2. Guardarlo en cookie httpOnly con maxAge largo (1 año)
3. Crear `FeedUser` en BD con las restricciones seleccionadas
4. Marcar `onboardingDone = true`

---

## 8. Vistas (las 4 tabs)

### Navegación inferior
4 tabs fijos abajo: **🔥 Para ti · 🧭 Explorar · 💾 Guardados · 👤 Perfil**

---

### 8.1 — 🔥 Para ti (feed principal)

**Layout:** Masonry grid 2 columnas, scroll infinito vertical.

**Cada card:**
- Foto del plato (altura variable, aspect ratio real)
- Nombre del plato (max 2 líneas, Playfair Display, blanco)
- Precio (DM Sans, ámbar `#F4A623`). Si tiene descuento: precio original tachado + precio oferta
- Nombre del restaurante (DM Sans, gris tenue)
- Icono ❤️ en esquina superior derecha para like rápido
- Estrellas (si tiene ratings, promedio; si no, estrellas vacías sutiles)
- Badge "Porque te gusta..." si hay motivo (pequeño, sobre la foto)

**Orden:**
- Sin datos del usuario: diverso (mezcla de categorías y restaurantes)
- Con datos: ordenado por `affinity()` descendente

**Anti-dominación:** máximo 3 platos del mismo restaurante en cada bloque de 12 platos.

**Paginación:** cargar de a 20 platos. Al llegar al 80% del scroll, cargar los siguientes 20.

---

### 8.2 — Modal del plato (al tocar una card)

Bottom sheet que ocupa ~85% de la pantalla:

1. **Foto hero** (full width, aspect ratio real, con gradiente oscuro abajo)
2. **Tag de categoría** normalizada (chip pequeño sobre la foto)
3. **Nombre** grande (Playfair Display)
4. **Precio** (con descuento tachado si aplica)
5. **Estrellas** (1-5, interactivas — el usuario puede calificar aquí)
6. **Restaurante:** logo pequeño + nombre (tocable → abre `/carta/{slug}`)
7. **Motivo:** "Porque te gusta sushi & rolls" (si hay)
8. **Descripción** del plato (si existe)
9. **Comentarios** (lista de comentarios + input para agregar uno)
10. **Botones de acción:**
    - ❤️ Me gusta
    - 💾 Guardar para después
    - 👎 No me interesa
11. **CTA grande:** "Se me antoja" → guarda como antojo + abre mini-sheet:
    - "Ver carta del local" → `/carta/{slug}`
    - "Cómo llegar" → Google Maps con dirección

---

### 8.3 — 🧭 Explorar

Mismo masonry grid pero con **chips de filtro** horizontales arriba:
`Todas · Pizzas · Sushi & Rolls · Hamburguesas · Ceviches · Ensaladas · Postres · ...`

- Tocar un chip filtra el grid por esa categoría normalizada
- "Todas" muestra todo (default)
- Si hay platos en oferta: chip especial "🏷️ Ofertas" al inicio

Este tab es **browsing libre**, no personalizado. El orden es por popularidad
(`FeedDishStats.popularityScore`) dentro de cada filtro.

---

### 8.4 — 💾 Guardados

Dos secciones:

**🤤 Se me antoja** (intención inmediata)
- Platos que el usuario marcó con "Se me antoja"
- Card compacta: foto + nombre + restaurante + botón "Ver carta"

**💾 Guardados** (para después)
- Platos guardados para más adelante
- Misma card compacta

Se pueden mover entre secciones. Se pueden eliminar (swipe o botón).

---

### 8.5 — 👤 Perfil

El **perfil gastronómico aprendido**:

- **Top categorías** con barras de afinidad horizontales (ej: Sushi 85%, Pizza 60%, Ceviche 45%)
- **Estadísticas:** platos vistos, likes dados, guardados, antojos
- **Restricciones activas** (con posibilidad de editar)
- **Botón "Resetear gustos"** → limpia scores, vuelve al feed diverso

Este perfil es la "mina de oro": el dato que permite en el futuro avisar al usuario
cuando un restaurante nuevo sube platos de su categoría favorita.

---

## 9. Arquitectura técnica

### Rutas

```
app/a/
├── page.tsx              → Server Component: onboarding check + redirect
├── layout.tsx            → Layout oscuro con nav inferior
├── feed/
│   └── page.tsx          → Tab "Para ti" (feed masonry)
├── explorar/
│   └── page.tsx          → Tab "Explorar"
├── guardados/
│   └── page.tsx          → Tab "Guardados"
├── perfil/
│   └── page.tsx          → Tab "Perfil"
├── onboarding/
│   └── page.tsx          → Pantalla de restricciones
├── components/
│   ├── FeedGrid.tsx      → Masonry grid reutilizable
│   ├── DishCard.tsx      → Card individual del plato
│   ├── DishModal.tsx     → Modal inmersivo del plato
│   ├── BottomNav.tsx     → Navegación inferior
│   ├── CategoryChips.tsx → Chips de filtro (Explorar)
│   ├── StarRating.tsx    → Componente de estrellas
│   ├── CommentSection.tsx→ Comentarios del plato
│   └── SavedList.tsx     → Lista de guardados/antojos
├── lib/
│   ├── scoring.ts        → Motor de scoring + affinity()
│   ├── categories.ts     → Mapa de normalización + gradientes + adyacencia
│   ├── feed-queries.ts   → Queries Prisma para el feed
│   └── feed-actions.ts   → Server Actions (interacciones, ratings, comments)
└── types.ts              → FeedDish, FeedProfile, etc.
```

### Middleware
La ruta `/a` es **pública** (sin auth). Agregar `/a/:path*` como excepción si el middleware
lo requiere. Actualmente el middleware solo protege `/panel`, `/admin` y sus APIs, así que
`/a` ya pasa libre — pero verificar.

### Cookie / Identificación
- Cookie `qc_feed_user` con el `FeedUser.id`
- httpOnly, secure, sameSite lax, maxAge 365 días
- Se crea al completar onboarding
- Si la cookie existe y el FeedUser existe → usuario recurrente
- Si no existe → redirigir a onboarding

### API / Server Actions
Todo se maneja con **Server Actions** de Next.js:
- `trackInteraction(dishId, action, dwellMs?)` → crea FeedInteraction + actualiza scores
- `rateDish(dishId, stars)` → crea/actualiza FeedRating
- `commentDish(dishId, text)` → crea FeedComment
- `saveDish(dishId, type)` → crea FeedSaved
- `unsaveDish(dishId)` → elimina FeedSaved
- `getDishesForFeed(cursor, limit)` → paginación con scoring
- `getDishesForExplore(category?, cursor, limit)` → paginación por popularidad

---

## 10. Plan de construcción por etapas

### Etapa 1 — Schema + ruta + datos
- Agregar modelos Feed* al schema.prisma
- `db push`
- Ruta `/a` pública
- Query de platos con foto de restaurantes activos
- Tipo `FeedDish` normalizado
- Verificar con lista cruda (conteo + 3 ejemplos)

### Etapa 2 — Feed masonry con fotos
- Grid masonry 2 columnas
- Cards con foto real + nombre + precio + restaurante
- Scroll infinito (paginación)
- Fallback gradiente para errores de carga de foto
- Fondo oscuro, tipografía correcta

### Etapa 3 — Modal inmersivo + acciones
- Bottom sheet al tocar card
- Foto hero + info completa
- Botones: like, guardar, pasar, se me antoja
- Estrellas (visualización + input)
- Comentarios (visualización + input)
- Flow "Se me antoja" con opciones

### Etapa 4 — Scoring + tracking
- Motor de scoring en `lib/scoring.ts`
- Tracking de interacciones (Server Actions → BD)
- Dwell time tracking en el cliente
- Re-ranking del feed basado en scores
- Motivos de recomendación
- Indicador "Aprendiendo tus gustos..."
- Actualización de FeedDishStats

### Etapa 5 — Onboarding
- Pantalla de restricciones dietéticas
- Creación de FeedUser
- Cookie persistente
- Redirect logic (sin cookie → onboarding, con cookie → feed)

### Etapa 6 — Tab Explorar
- Masonry con chips de categorías normalizadas
- Filtrado por categoría
- Sección ofertas (si hay)
- Orden por popularityScore

### Etapa 7 — Tabs Guardados + Perfil
- Guardados: antojos + para después
- Perfil: barras de afinidad, stats, restricciones, reset
- Eliminar / mover entre listas

---

## 11. Qué NO hacer

- No modificar schema de modelos existentes (excepto agregar relaciones inversas en Dish)
- No tocar rutas/componentes fuera de `app/a/`
- No agregar feed social, seguir usuarios, chat, delivery
- No usar IA/LLM — scoring determinístico puro
- No inventar datos que la BD no tiene
- No incluir bebidas en el feed
- No mostrar platos sin foto
