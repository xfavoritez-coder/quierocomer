/**
 * Módulo compartido de clasificación taxonómica de platos.
 * Usado por: /api/pruebanuevo/classify, pipeline de importación, /api/mapalocales/carta/taxonomy
 */

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
  // Sándwiches chilenos
  "churrasco","mechada","as",
  // Carnes
  "milanesa","asado","costillas","pernil","anticucho","kebab","satay",
  // Pollo
  "pollo asado","pollo frito","tenders","alitas","nuggets",
  // Pescados y mariscos
  "ceviche","tiradito",
  // Pastas y arroces
  "pasta","lasagna","risotto","arroz","fideos",
  // Pizza y masas
  "pizza","calzone","quiche","empanada",
  // Sopas
  "sopa","cazuela","chupe","ramen",
  // Ensaladas y bowls
  "ensalada","bowl",
  // Asiática
  "sushi","hand roll","sushiburger","kimbap","bao","curry","pad thai","gyoza","dumpling","mandu","wantan",
  // Peruana
  "causa","lomo saltado","ají de gallina","arroz con leche",
  // Mexicana/Venezolana
  "taco","burrito","quesadilla","arepa","salchipapa",
  // China-chilena
  "chapsui",
  // Chilena
  "sopaipilla","pastel de choclo","chorrillana","lomo a lo pobre",
  // Desayunos
  "huevos","pancake","waffle","crepe","avena","omelet",
  // Snacks y entradas
  "papas fritas","nachos","aros de cebolla","croquetas","arrollado de primavera","spring roll",
  // Postres
  "helado","torta","brownie","galleta","muffin","cheesecake","churros","donut","flan",
  // Bebidas
  "café","latte","cappuccino","mocaccino","chocolate caliente","té","jugo","batido","bebida","alcohol","mocktail",
];

export const VALID_CUISINES = [
  "chilena","peruana","nikkei","venezolana","italiana","americana","mexicana","japonesa",
  "china","árabe","mediterránea","francesa","asiática","coreana","india","thai","griega","española","brasileña","fusión",
];

export const VALID_MEAL_SLOTS = ["desayuno","almuerzo","cena","snack"];

export const VALID_INGREDIENTS = [
  "carne","pollo","cerdo","cordero","pescado","salmón","camarones","pulpo","mariscos",
  "vienesa","jamón","salame","longaniza","tocino",
  "congrio","reineta","calamar","jaiba","ostión","mejillones","machas","centolla",
  "huevo","pasta","arroz","papa","verduras","legumbres","queso","queso crema","pan",
  "fruta","tofu","tomate","lechuga","palta","cebolla","cebollín","pepino","pimiento","rúcula","zapallo","betarraga","zanahoria","aceitunas",
  "choclo","champiñon","piña","nutella","manjar","almendra","maní","nuez","plátano","frutilla","edamame","wakame","atún","quinoa","limón","chocolate","masa madre",
  "crema","mantequilla","espinaca","albahaca","jengibre","durazno","naranja","lúcuma","frambuesa",
];

export const VALID_FLAVORS = ["dulce","salado","picante","frito","grillado","asado"];

export const VALID_ESTILOS = ["comida rapida","saludable"];

function buildPrompt(dishes: DishTaxonomyInput[], restaurantName?: string): string {
  const veganRestaurant = restaurantName && /vegan/i.test(restaurantName);
  const veganNote = veganRestaurant
    ? `\nCONTEXTO IMPORTANTE: Este restaurante se llama "${restaurantName}" y es un local VEGANO. Por defecto, TODOS sus platos son VEGAN, a menos que el nombre o descripción mencione explícitamente ingredientes animales (carne, pollo, pescado, mariscos, huevo, leche, queso, miel). Si hay duda → VEGAN.\n`
    : "";
  return `Clasifica cada plato con estas dimensiones. Responde SOLO con JSON válido, sin texto adicional.${veganNote}

OPCIONES VÁLIDAS:

dishType (array — puede ser más de uno, especialmente en combos):
${VALID_DISH_TYPES.join(", ")}
Reglas dishType:
- Si es un combo/pack con varios productos → incluye "combo" MÁS los tipos que contiene (ej: ["combo","hamburguesa","papas fritas"])
- Postres: "torta" (torta, cake, layer cake, torta de cumpleaños, torta helada, selva negra — cualquier torta de pastelería aunque en inglés diga "cake"). "brownie" (brownie, brownie cake, brownie de chocolate — SIEMPRE postre, NUNCA bebida aunque lleve "cake"). "cheesecake" (cheesecake, cheese cake). "helado" (helado, ice cream, sorbete). "muffin" (muffin, cupcake). "galleta" (galleta, cookie). "churros". "donut". "flan". IMPORTANTE: "brownie cake", "chocolate cake", "carrot cake", "red velvet cake" → son POSTRES → dishType ["brownie"] o ["torta"]. NUNCA clasificar un postre como "té" u otra bebida.
- Bebidas: "café" (espresso, americano, cortado, café negro, cold brew, pour over, chemex, café de filtro), "latte" (latte, flat white, latte de cualquier tipo — matcha latte, turmeric latte, etc.), "cappuccino" (cappuccino, macchiato, cortado con mucha leche), "mocaccino" (moca, mocha, mocaccino — café + chocolate), "chocolate caliente" (chocolate caliente, hot chocolate, cocoa), "té" (SOLO para bebidas líquidas: cualquier té, infusión, hierba, manzanilla, menta — usar también para "infusiones". NUNCA para pasteles, tortas o postres sólidos aunque lleven "cake"), "jugo" (jugos naturales o en caja), "batido" (smoothie, milkshake, malteada), "bebida" (sodas, agua, bebidas embotelladas), "alcohol" (cerveza, vino, pisco, coctel, destilados), "mocktail" (coctel sin alcohol).
- Bebidas → cuisine siempre [].
- Bebidas → mealSlot: café/té/jugo/batido → [desayuno, snack]. bebida (sodas) → [almuerzo, cena, snack]. alcohol → [almuerzo, cena]. mocktail → [almuerzo, cena, snack].
- Bebidas → diet: café/té/jugo/bebida/alcohol/mocktail → VEGAN. latte/cappuccino/mocaccino/chocolate caliente/batido con leche → VEGETARIAN. Si dice explícitamente "leche de avena", "leche vegetal", "oat milk", "almendra" → VEGAN.
- "extra" SOLO para salsas líquidas, condimentos y porciones adicionales que van pegadas a otro plato — NO son comida independiente. Criterios estrictos: el nombre empieza con "salsa", "extra de", "adicional", "porción de", "dip de", o es un condimento puro solo (ají, jengibre, chimichurri, tamarindo, soya, acevichada, huancaína, golf, mayo, ketchup, mostaza, guacamole, etc.). Si el plato es comida real que se come solo — aunque lleve ajo, queso, pan, o sea pequeño — NO es "extra". Ejemplos que NO son extra: palitos de ajo, pan de ajo, focaccia, tostadas de ajo, camembert al horno, tabla de quesos, palitos de pan, papas al horno. Ante la duda → deja dishType: [].
- "kimbap": rollo coreano de arroz y relleno envuelto en alga nori, cortado en rodajas (similar al maki pero coreano). Incluye: kimbap de X, rollitos de algas nori coreanos, gimbap. cuisine siempre ["coreana"]. NUNCA clasificar kimbap como "sushi".
- "bao": pan al vapor chino relleno (baozi, bao bun, steamed bun, gua bao). Incluye: bao de cerdo, bao de pollo, bao de salmón, bao vegano, etc. cuisine siempre ["china"] o ["asiática"]. mainIngredient incluir el relleno + "pan".
- "dumpling": masa rellena genérica de tradición asiática (incluye cualquier variante que no sea específicamente gyoza/wantan/mandu). Incluye: dumplings de X, potstickers, jiaozi. cuisine ["china"] o ["asiática"].
- "mandu": dumpling coreano (empanadita coreana, mandu de X, wang mandu). Incluye: empanaditas coreanas de cualquier relleno. cuisine siempre ["coreana"]. NUNCA clasificar mandu como "empanada" (que es latinoamericana).
- "sushiburger": preparación japonesa donde el arroz de sushi prensado reemplaza el pan, con relleno de pescado/mariscos/carne entre dos "tapas" de arroz. Incluye: sushi burger, sushiburger de salmón, de atún, etc. cuisine siempre ["japonesa"] o ["nikkei"].
- "hand roll": cono de alga nori relleno de arroz y ingredientes, se come con la mano. Incluye: hand roll de X, temaki.
- "satay" para brochetas marinadas al estilo asiático (satay de pollo, de cerdo, de tofu, de camarones — siempre marinado en salsa de maní, curry o especias tailandesas/indonesias). No confundir con "anticucho" (peruano) ni "kebab" (árabe).
- "spring roll": rollitos vietnamitas (frescos O fritos) en papel de arroz de arroz. Incluye: Nem (chả giò), gỏi cuốn, rollitos vietnamitas, spring rolls con rice paper. "arrollado de primavera" / "rollito primavera": exclusivamente rollitos estilo chino con masa de trigo frita.
- "chupe": sopa espesa y cremosa chilena, base de leche o crema, con mariscos (jaiba, camarones, mariscos, calamar), papa, choclo. MUY DISTINTO de "cazuela" (caldo liviano con verduras enteras y un trozo de carne/pollo). Chupe de jaiba, chupe de mariscos, chupe de centolla → siempre "chupe". Si lleva crema/leche y mariscos → "chupe".
- "chapsui": plato salteado en wok estilo chino-chileno con salsa. Incluye: chapsui de X, chop suey, X a la china, X mongoliano/mongoliana, X chitén, diente de X (cuando el contexto es restaurante chino), cualquier salteado chino con salsa. cuisine siempre ["china"]. NO confundir con "pollo frito" — chapsui es salteado en wok, no frito/apanado.
- "pollo frito" SOLO para pollo realmente frito/apanado/empanado: broaster, chicharrón de pollo, nuggets, tenders, pollo crocante. Un "pollo a la china" o "pollo mongoliano" NO es pollo frito → es chapsui.
- "completo": hot dog chileno en pan con salchicha/vienesa. Incluye: completo X, vienesa X (vienesa napolitana, vienesa champiluco, vienesa italiana, etc.), italiano, completo alemán, completo dinámico. NUNCA sándwich — aunque lleve pan, la salchicha lo hace completo. cuisine siempre ["chilena"].
- "churrasco": EXCLUSIVAMENTE el sándwich de carne delgada en pan (churrasco italiano, churrasco alemán, churrasco con palta, etc.). NUNCA para un corte de carne a la parrilla servido como plato de fondo. Un "lomo liso", "punta de ganso", "asado de tira", "pechuga a la parrilla" servidos como plato → dishType ["asado"] o ["pollo asado"], NO "churrasco". Churrasco = sándwich con carne + pan + aderezos.
- "mechada": sándwich chileno con carne de vacuno mechada (braseada/deshebrada) en pan. Incluye: mechada italiana, mechada completa, mechada dinámica, mechada brasilera, mechada luco, mechada chacarero, sándwich de mechada. La mechada es el método de preparación (carne braseada/deshebrada), NO el ingrediente. cuisine ["chilena"]. mainIngredient ["carne","pan"].
- "as": sándwich chileno con carne de vacuno muy delgada en pan (distinto del churrasco — el as lleva carne más fina/pequeña). Incluye: as italiano, as completo, as dinámico, as brasilero, as palta mayo, as tomate mayo, as luco, as italiano queso. cuisine ["chilena"]. mainIngredient ["carne","pan"].
- "causa": plato peruano de papa amarilla aliñada rellena con pollo, atún, mariscos u otro. Incluye: causa limeña, causa de pollo, causa de atún, causa rellena. cuisine siempre ["peruana"]. mainIngredient incluir "papa" + el relleno.
- "lomo saltado": salteado peruano de tiras de carne con cebolla, tomate y papas fritas. cuisine ["peruana"]. mainIngredient ["carne","papa","tomate","cebolla"].
- "ají de gallina": guiso peruano cremoso de pollo desmenuzado con salsa de ají amarillo. cuisine ["peruana"]. mainIngredient ["pollo"].
- "arroz con leche": postre de arroz cocido en leche con azúcar y canela. cuisine [] o ["peruana"]. diet VEGETARIAN.
- "chorrillana": plato chileno de papas fritas cubiertas con carne de vacuno en tiras, cebolla caramelizada y huevos fritos. Siempre ["chorrillana"], cuisine ["chilena"].
- "lomo a lo pobre": bistec/lomo con papas fritas, huevo frito y cebolla caramelizada. Siempre ["lomo a lo pobre"], cuisine ["chilena"]. mainIngredient incluir: carne, papa, huevo, cebolla.
- "bowl": SOLO para bowls modernos tipo poke/buddha bowl/grain bowl, con base de arroz/quinoa/granos + toppings curados encima. NUNCA para platos de fondo tradicionales: lomo a lo pobre, lomo a la pastelera, lomo saltado, pescado frito, canasto marino, fuente de mariscos, chupe, cazuela, arroz con pollo estilo casero. Si el plato es claramente una preparación tradicional servida en plato, NO es bowl.
- Elige SOLO de la lista de arriba. Si ninguno aplica, deja []
- La mayoría de platos tendrá 1 solo tipo. Los combos tendrán 2-3.

cuisine (array, solo si aplica claramente):
${VALID_CUISINES.join(", ")}
Reglas cuisine:
- "chilena" SOLO para platos tradicionales chilenos: cazuela, chupe, empanada, sopaipilla, pastel de choclo, chorrillana, lomo a lo pobre, lomo a la pastelera, charquicán, humitas, porotos granados, prietas, longaniza, completo, canasto marino, fuente de mariscos. Sándwiches comunes como ave mayo, lomito, barros luco → NO son "chilena" → cuisine: []. Una hamburguesa en Chile NO es chilena → [].
- "nikkei" para fusión japonesa-peruana (tiradito con toques japoneses, ceviche con soja, etc.)
- Deja [] si no hay cocina clara (ej: un helado de vainilla no tiene cocina específica, una hamburguesa genérica tampoco)

mealSlot (array):
desayuno, almuerzo, cena, snack
Un waffle puede ser [desayuno, snack]. Una hamburguesa es [almuerzo, cena].

mainIngredient (array): incluye TODOS los ingredientes de la lista que aparezcan explícitamente mencionados en el nombre o descripción del plato, aunque sean secundarios o guarnición (cebollín, tomate, lechuga, palta, etc.). No te limites solo a los "principales".
${VALID_INGREDIENTS.join(", ")}
- "salmón" cuando el plato tiene salmón como protagonista o ingrediente clave. "pescado" para otros pescados genéricos (merluza, corvina sin especificar). "reineta" → usar ingrediente "reineta" directamente. "calamar" → usar ingrediente "calamar". "jaiba" → usar ingrediente "jaiba". "mariscos" para mejillones, ostras, almejas, centolla, mix de mariscos.
- "papas fritas" en el nombre o descripción → incluir "papa" en mainIngredient + "frito" en flavor. También aplica para "papas", "patatas fritas", "fritas" en contexto de guarnición.
- "pan" SOLO para productos con pan real: sándwich, hamburguesa (el bun), tostada, bagel, croissant, marraqueta, hallulla, baguette. La masa de pizza, empanada, wantan, arrollado, pasta, crepe → NO es "pan".
- wantan/wonton → NO usar "pan". Pon solo el relleno (cerdo, camarones, verduras, etc.).
- arrollado de primavera / rollito primavera → frito, masa de trigo, estilo chino. NO usar "pan".
- spring roll / nem / chả giò / gỏi cuốn → siempre papel de arroz, estilo vietnamita (frito o fresco). Usar ingrediente principal del relleno, NO "pan".
- "piña" cuando el plato mencione piña, ananá, pineapple explícitamente. No usar "fruta" si se menciona piña específicamente.
- Usa "queso crema" cuando veas: queso crema, cream cheese, philadelphia, philly, queso untable, vegadelphia, queso crema vegano, queso crema de almendras, o similar. Usa "queso" para el resto: cheddar, mozzarella, gouda, queso fresco, queso amarillo.
- Vegadelphia o queso crema vegano → ingrediente "queso crema" + diet VEGAN (si no hay otros ingredientes animales).

flavor (array, solo los que aplican claramente):
dulce, salado, picante, frito, grillado, asado
Un helado → [dulce]. Papas fritas → [frito, salado]. Pollo a la parrilla → [grillado, salado].
- Si el nombre o descripción menciona "spicy", "salsa spicy", "ají", "chipotle", "jalapeño" o "sriracha" → siempre incluir "picante".
- Si el nombre o descripción menciona "salsa dulce", "salsa unagi", "unagi" o "salsa teriyaki" → siempre incluir "dulce".

estilo (array, solo si aplica claramente):
comida rapida, saludable
Deja [] si no encaja en ninguno. Sushi → []. Ensalada verde → [saludable]. Hamburguesa → [comida rapida].

diet:
Si el nombre del plato contiene "veggie" → diet: VEGETARIAN siempre, sin excepción.
Si la categoría del plato contiene "vegano", "vegana", "veganos", "veganas" o similar → asumir VEGAN para todos los platos de esa categoría, a menos que el plato tenga ingredientes animales explícitos.
Si la categoría contiene "vegetariano", "vegetarianos", "veggie", "vegetales", "plant" o similar → asumir VEGETARIAN por defecto, a menos que el nombre/descripción diga explícitamente "vegano" (→ VEGAN).
OMNIVORE → SOLO si el plato contiene carne (vacuno, cerdo, cordero), ave (pollo, pavo), pescado o mariscos. Ejemplos: hamburguesa, pollo, completo, ceviche, salmón.
Palabras chilenas que son siempre OMNIVORE: vienesa (salchicha de cerdo/ave), longaniza, prieta, churrasco, mechada, as (sándwich de carne), vacuno, lomo, costilla, pernil, plateada, osobuco, pollo, cerdo, pescado, mariscos, ceviche, chupe, cazuela con carne/pollo. "2X Vienesas" o "Promo vienesas" → OMNIVORE aunque el nombre no diga "carne".
Términos japoneses que son OMNIVORE: kani (cangrejo), kanikama (palito de cangrejo), ebi (camarón), maguro (atún), hamachi (pez limón), hotate (vieira), unagi (anguila), tako (pulpo), tobiko/masago/ikura (huevas de pescado), gyoza (suele tener cerdo/camarones), tonkatsu (cerdo), yakitori (pollo), katsu (cerdo), gyudon (carne), karaage (pollo), negitoro, spicy tuna, tekka.
VEGETARIAN → sin carne/ave/pescado/mariscos. Huevo, queso, leche, mantequilla, crema, miel NO hacen OMNIVORE — son ingredientes vegetarianos.
Waffle, pancake, crepe, omelet, huevos, pasta con queso, pizza sin carne → VEGETARIAN aunque lleven huevo o lácteos.
VEGAN → SOLO si el plato dice explícitamente "vegano" en su nombre o descripción. Sin esa señal, nunca VEGAN — usa VEGETARIAN.
Pesto, pizza sin carne, ensalada sin proteína animal, waffles, postres con frutas/chocolate/nutella → VEGETARIAN.
Ante cualquier duda → VEGETARIAN, nunca VEGAN.

PLATOS A CLASIFICAR:
${JSON.stringify(dishes, null, 2)}
${veganRestaurant ? `\nRECORDATORIO: Restaurante vegano → diet VEGAN por defecto salvo ingredientes animales explícitos.` : ""}

JSON respuesta exacta (usa los IDs tal como están):
{
  "id1": { "dishType": ["hamburguesa"], "cuisine": ["americana"], "mealSlot": ["almuerzo","cena"], "mainIngredient": ["carne","pan"], "flavor": ["salado"], "estilo": ["comida rapida"], "diet": "OMNIVORE" },
  "id2": { ... }
}`;
}

/**
 * Clasifica un batch de platos con Claude. Reintenta hasta 3 veces con backoff
 * exponencial en errores 429/529 (rate limit / overloaded).
 */
export async function classifyDishes(
  dishes: DishTaxonomyInput[],
  restaurantName?: string
): Promise<Record<string, DishTaxonomy>> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  if (dishes.length === 0) return {};

  const prompt = buildPrompt(dishes, restaurantName);
  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const wait = Math.min(8000 * 2 ** (attempt - 1), 40000); // 8s, 16s, 32s
      console.log(`[taxonomy] retry ${attempt} after ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body,
    });

    if (!response.ok) {
      const status = response.status;
      lastErr = await response.text();
      // 429 Rate limit / 529 Overloaded → retry
      if (status === 429 || status === 529) continue;
      throw new Error(`Anthropic API error ${status}: ${lastErr}`);
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in Claude response: ${text.slice(0, 200)}`);

    const result = JSON.parse(jsonMatch[0]) as Record<string, DishTaxonomy>;

    // Post-proceso: restaurante vegano → VEGETARIAN → VEGAN (OMNIVORE se respeta si Claude detectó carne real)
    if (restaurantName && /vegan/i.test(restaurantName)) {
      for (const tax of Object.values(result)) {
        if (tax.diet === "VEGETARIAN") tax.diet = "VEGAN";
      }
    }

    return result;
  }

  throw new Error(`Anthropic API error tras 4 intentos: ${lastErr}`);
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
  concurrency = 4,
  restaurantName?: string
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
    const groupResults = await Promise.all(group.map(b => classifyDishes(b, restaurantName)));
    for (const r of groupResults) Object.assign(result, r);
  }

  return result;
}
