/**
 * Módulo compartido de clasificación taxonómica de platos.
 * Usado por: /api/pruebanuevo/classify, pipeline de importación, /api/mapalocales/carta/taxonomy
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export type DishTaxonomyInput = {
  id: string;
  name: string;
  description: string | null;
  category: string;
};

export type DishTaxonomy = {
  dishType: string[];
  cuisine: string[];
  mealSlot: string[];
  mainIngredient: string[];
  flavor: string[];
  estilo: string[];
  diet: "OMNIVORE" | "VEGETARIAN" | "VEGAN";
};

export const VALID_DISH_TYPES = [
  // Especiales
  "combo","extra",
  // Sándwiches y panes
  "hamburguesa","completo","sándwich","wrap","croissant","bagel","tostada",
  // Carnes
  "churrasco","milanesa","asado","costillas","pernil","anticucho","kebab",
  // Pollo
  "pollo asado","pollo frito","tenders","alitas","nuggets",
  // Pescados y mariscos
  "ceviche","tiradito",
  // Pastas y arroces
  "pasta","lasagna","risotto","arroz","fideos",
  // Pizza y masas
  "pizza","calzone","quiche","empanada",
  // Sopas
  "sopa","cazuela","ramen",
  // Ensaladas y bowls
  "ensalada","bowl",
  // Asiática
  "sushi","hand roll","curry","pad thai","gyoza","wantan",
  // Mexicana/Venezolana
  "taco","burrito","quesadilla","arepa","salchipapa",
  // Chilena
  "sopaipilla","pastel de choclo",
  // Desayunos
  "huevos","pancake","waffle","crepe","avena","omelet",
  // Snacks y entradas
  "papas fritas","nachos","aros de cebolla","croquetas","arrollado de primavera","spring roll",
  // Postres
  "helado","torta","brownie","galleta","muffin","cheesecake","churros","donut","flan",
  // Bebidas
  "café","café con leche","té","jugo","batido","bebida","alcohol","mocktail",
];

export const VALID_CUISINES = [
  "chilena","peruana","nikkei","venezolana","italiana","americana","mexicana","japonesa",
  "china","árabe","mediterránea","francesa","asiática","coreana","india","thai","griega","española","brasileña","fusión",
];

export const VALID_MEAL_SLOTS = ["desayuno","almuerzo","cena","snack"];

export const VALID_INGREDIENTS = [
  "carne","pollo","cerdo","cordero","pescado","salmón","camarones","pulpo","mariscos",
  "huevo","pasta","arroz","papa","verduras","legumbres","queso","queso crema","pan",
  "fruta","tofu","tomate","lechuga","palta","cebolla","cebollín","jamón","salame",
  "choclo","nutella","manjar","almendra","maní","nuez","plátano","frutilla",
];

export const VALID_FLAVORS = ["dulce","salado","picante","frito","grillado","asado"];

export const VALID_ESTILOS = ["comida rapida","saludable"];

function buildPrompt(dishes: DishTaxonomyInput[]): string {
  return `Clasifica cada plato con estas dimensiones. Responde SOLO con JSON válido, sin texto adicional.

OPCIONES VÁLIDAS:

dishType (array — puede ser más de uno, especialmente en combos):
${VALID_DISH_TYPES.join(", ")}
Reglas dishType:
- Si es un combo/pack con varios productos → incluye "combo" MÁS los tipos que contiene (ej: ["combo","hamburguesa","papas fritas"])
- Bebidas: "café" (espresso, americano, cortado, café negro), "café con leche" (latte, cappuccino, flat white, macchiato), "té" (cualquier té o infusión), "jugo" (jugos naturales o en caja), "batido" (smoothie, milkshake, malteada), "bebida" (sodas, agua, bebidas embotelladas), "alcohol" (cerveza, vino, pisco, coctel, destilados), "mocktail" (coctel sin alcohol).
- Bebidas → cuisine siempre [].
- Bebidas → mealSlot: café/té/jugo/batido → [desayuno, snack]. bebida (sodas) → [almuerzo, cena, snack]. alcohol → [almuerzo, cena]. mocktail → [almuerzo, cena, snack].
- Bebidas → diet: café negro/té/jugo/bebida/alcohol/mocktail → VEGAN. café con leche/batido con leche/latte/cappuccino → VEGETARIAN.
- "extra" para salsas, condimentos, aderezos y porciones adicionales. Si el nombre empieza con "salsa", "extra de", "adicional", "porción de", o es un condimento solo (ají, jengibre, chimichurri, tamarindo, soya, acevichada, huancaína, golf, mayo, ketchup, mostaza, etc.) → siempre ["extra"]. Estos NO son platos principales.
- Elige SOLO de la lista de arriba. Si ninguno aplica, deja []
- La mayoría de platos tendrá 1 solo tipo. Los combos tendrán 2-3.

cuisine (array, solo si aplica claramente):
${VALID_CUISINES.join(", ")}
Reglas cuisine:
- "chilena" SOLO para platos tradicionales chilenos: cazuela, empanada, sopaipilla, pastel de choclo, chorrillana, charquicán, humitas, porotos granados, prietas, longaniza, completo. Sándwiches comunes como ave mayo, lomito, barros luco → NO son "chilena" → cuisine: []. Una hamburguesa en Chile NO es chilena → [].
- "nikkei" para fusión japonesa-peruana (tiradito con toques japoneses, ceviche con soja, etc.)
- Deja [] si no hay cocina clara (ej: un helado de vainilla no tiene cocina específica, una hamburguesa genérica tampoco)

mealSlot (array):
desayuno, almuerzo, cena, snack
Un waffle puede ser [desayuno, snack]. Una hamburguesa es [almuerzo, cena].

mainIngredient (array, los más importantes):
${VALID_INGREDIENTS.join(", ")}
- "salmón" cuando el plato tiene salmón como protagonista o ingrediente clave. "pescado" para otros pescados genéricos (reineta, merluza, corvina sin especificar). "mariscos" para mejillones, ostras, almejas, centolla, mix de mariscos.
- "pan" SOLO para productos con pan real: sándwich, hamburguesa (el bun), tostada, bagel, croissant, marraqueta, hallulla, baguette. La masa de pizza, empanada, wantan, arrollado, pasta, crepe → NO es "pan".
- wantan/wonton → NO usar "pan". Pon solo el relleno (cerdo, camarones, verduras, etc.).
- arrollado de primavera / rollito primavera → frito, masa de trigo, estilo chino. NO usar "pan". "spring roll" reservar para el fresco vietnamita con papel de arroz.
- Usa "queso crema" cuando veas: queso crema, cream cheese, philadelphia, philly, queso untable, vegadelphia, queso crema vegano, queso crema de almendras, o similar. Usa "queso" para el resto: cheddar, mozzarella, gouda, queso fresco, queso amarillo.
- Vegadelphia o queso crema vegano → ingrediente "queso crema" + diet VEGAN (si no hay otros ingredientes animales).

flavor (array, solo los que aplican claramente):
dulce, salado, picante, frito, grillado, asado
Un helado → [dulce]. Papas fritas → [frito, salado]. Pollo a la parrilla → [grillado, salado].

estilo (array, solo si aplica claramente):
comida rapida, saludable
Deja [] si no encaja en ninguno. Sushi → []. Ensalada verde → [saludable]. Hamburguesa → [comida rapida].

diet:
OMNIVORE (tiene carne/ave/pescado/mariscos — aunque lleve queso o vegetales)
VEGETARIAN (sin carne/pescado/mariscos visible en nombre o descripción)
VEGAN → SOLO si el plato dice explícitamente "vegano" en su nombre o descripción, O si el restaurante es claramente vegano (ej: "Horus Vegan"). Sin esa señal explícita, nunca uses VEGAN — usa VEGETARIAN.
Hamburguesa, pollo, completo, mariscos → OMNIVORE siempre.
Pesto, pizza sin carne, ensalada sin proteína animal → VEGETARIAN (nunca VEGAN por defecto).
Ante cualquier duda → VEGETARIAN, nunca VEGAN.

PLATOS A CLASIFICAR:
${JSON.stringify(dishes, null, 2)}

JSON respuesta exacta (usa los IDs tal como están):
{
  "id1": { "dishType": ["hamburguesa"], "cuisine": ["americana"], "mealSlot": ["almuerzo","cena"], "mainIngredient": ["carne","pan"], "flavor": ["salado"], "estilo": ["comida rapida"], "diet": "OMNIVORE" },
  "id2": { ... }
}`;
}

/**
 * Clasifica un batch de platos con Claude.
 * Lanza error si falla la llamada a la API.
 */
export async function classifyDishes(
  dishes: DishTaxonomyInput[]
): Promise<Record<string, DishTaxonomy>> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  if (dishes.length === 0) return {};

  const prompt = buildPrompt(dishes);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in Claude response: ${text.slice(0, 200)}`);

  return JSON.parse(jsonMatch[0]) as Record<string, DishTaxonomy>;
}

/**
 * Clasifica en batches de N platos para evitar superar el context window.
 */
/**
 * Clasifica en batches paralelos (hasta `concurrency` llamadas simultáneas).
 * 120 platos / 30 por batch = 4 batches en paralelo → ~25s en total.
 */
export async function classifyDishesBatched(
  dishes: DishTaxonomyInput[],
  batchSize = 30,
  concurrency = 4
): Promise<Record<string, DishTaxonomy>> {
  if (dishes.length === 0) return {};

  const batches: DishTaxonomyInput[][] = [];
  for (let i = 0; i < dishes.length; i += batchSize) {
    batches.push(dishes.slice(i, i + batchSize));
  }

  const result: Record<string, DishTaxonomy> = {};

  // Procesar en grupos de `concurrency` batches simultáneos
  for (let i = 0; i < batches.length; i += concurrency) {
    const group = batches.slice(i, i + concurrency);
    const groupResults = await Promise.all(group.map(b => classifyDishes(b)));
    for (const r of groupResults) Object.assign(result, r);
  }

  return result;
}
