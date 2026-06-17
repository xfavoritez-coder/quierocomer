# Taxonomía multidimensional de platos

Sistema de clasificación que reemplaza la jerarquía de categoría/subcategoría. Cada plato se clasifica en múltiples dimensiones independientes. La clasificación la hace Claude AI y puede ser editada manualmente en `/pruebanuevo`.

---

## Dimensiones

### `dishType` — array, multi-select
El **formato o preparación** del plato. Nunca un ingrediente puro.
- Un combo/pack incluye `"combo"` + los tipos que contiene: `["combo", "hamburguesa", "papas fritas"]`
- Si ninguno aplica → `[]`

```
combo
hamburguesa, completo, sándwich, wrap, croissant, bagel, tostada
churrasco, milanesa, asado, costillas, pernil, anticucho, kebab
pollo asado, pollo frito, tenders, alitas, nuggets
ceviche, tiradito
pasta, lasagna, risotto, arroz, fideos
pizza, calzone, quiche, empanada
sopa, cazuela, ramen
ensalada, bowl
sushi, curry, pad thai, gyoza
taco, burrito, quesadilla
sopaipilla, pastel de choclo
huevos, pancake, waffle, crepe, avena, omelet
papas fritas, nachos, aros de cebolla, croquetas, spring roll
helado, torta, brownie, galleta, muffin, cheesecake, churros, donut, flan
```

---

### `cuisine` — array, solo si aplica claramente
La cocina de origen. `[]` si es ambiguo (una hamburguesa genérica no es "americana" por defecto).

- `"chilena"` SOLO para platos tradicionales chilenos: cazuela, empanada, sopaipilla, pastel de choclo, chorrillana, etc.
- `"nikkei"` para fusión japonesa-peruana.

```
chilena, peruana, nikkei, venezolana
italiana, americana, mexicana, japonesa, china
árabe, mediterránea, francesa, asiática, coreana, india, thai
griega, española, brasileña, fusión
```

---

### `mealSlot` — array
Momento del día en que se consume.

```
desayuno, almuerzo, cena, snack
```

Un waffle → `[desayuno, snack]`. Una hamburguesa → `[almuerzo, cena]`.

---

### `mainIngredient` — array
Los ingredientes protagonistas del plato.

```
carne, pollo, cerdo, cordero
pescado, salmón, camarones, pulpo, mariscos
huevo, pasta, arroz, papa
verduras, legumbres, tomate, lechuga, cebollín
queso, queso crema, pan, fruta, tofu, nutella
```

**Reglas:**
- `queso crema` cuando aparece: cream cheese, philadelphia, vegadelphia, queso untable, queso crema vegano
- `queso` para el resto: cheddar, mozzarella, gouda, queso fresco, queso amarillo
- `salmón` cuando es protagonista. `pescado` para otros (reineta, merluza, corvina genérica)
- `mariscos` para mejillones, ostras, almejas, centolla, mix de mariscos

---

### `flavor` — array, solo los que aplican claramente
```
dulce, salado, picante, frito, grillado, asado
```

Ejemplos: helado → `[dulce]`. Papas fritas → `[frito, salado]`. Pollo parrilla → `[grillado, salado]`.

---

### `estilo` — array, solo si encaja claramente
```
comida rapida, saludable
```

`[]` si no encaja. Hamburguesa → `[comida rapida]`. Ensalada verde → `[saludable]`. Sushi → `[]`.

---

### `diet` — single value
```
OMNIVORE    → tiene carne/ave/pescado/mariscos (aunque lleve queso o vegetales)
VEGETARIAN  → sin carne ni pescado, pero con lácteos o huevo
VEGAN       → 100% vegetal, sin ningún ingrediente animal
```

Vegadelphia o queso crema vegano → `VEGAN` (si no hay otros ingredientes animales).

---

## Motor de recomendaciones (futuro)

El sistema aprende las preferencias del usuario a través de sus interacciones (ver, tocar, ordenar un plato). Cada interacción suma score a las dimensiones del plato tocado.

### Cómo funciona

1. Usuario toca una hamburguesa (`dishType: hamburguesa`, `estilo: comida rapida`, `mainIngredient: carne`)
2. El perfil del usuario incrementa el score de esos valores
3. Si el patrón se repite con completos y tenders → `estilo: comida rapida` acumula mucho score
4. El feed reordena: sube al tope los platos que comparten dimensiones de alto score
5. No "recomienda" un plato específico — reordena la carta de cada local

### Ejemplo de perfil acumulado
```
dishType:   hamburguesa ×5, pizza ×3, empanada ×2
estilo:     comida rapida ×8
flavor:     salado ×9, frito ×4
diet:       OMNIVORE ×10
```
→ El feed prioriza locales con comida rápida y muestra primero los platos que matchean.

### Combos
Un combo `["combo", "hamburguesa", "papas fritas"]` suma score a cada valor por separado. Si el usuario pide muchos combos pero también toca hamburguesas sueltas, el sistema entiende que le gustan las hamburguesas independientemente del formato combo.

### Valor vacío = sin datos aún
Arrays vacíos `[]` significan "no clasificado todavía", no "sin preferencia". El motor los ignora hasta tener datos.

---

## Página de prueba

`/pruebanuevo` — carga un restaurante aleatorio con ≥5 platos con foto, clasifica todos con AI en un click, y permite editar cada dimensión manualmente. Sirve para validar y refinar la taxonomía antes de correrla sobre toda la base de datos.
