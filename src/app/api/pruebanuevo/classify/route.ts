import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type DishInput = {
  id: string;
  name: string;
  description: string | null;
  category: string;
};

const VALID_DISH_TYPES = [
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
  "sushi","curry","pad thai","gyoza","wantan",
  // Mexicana
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

export async function POST(req: NextRequest) {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const body = await req.json();
    const dishes: DishInput[] = body.dishes;

    if (!dishes || dishes.length === 0) {
      return NextResponse.json({ error: "No dishes provided" }, { status: 400 });
    }

    const prompt = `Clasifica cada plato con estas dimensiones. Responde SOLO con JSON válido, sin texto adicional.

OPCIONES VÁLIDAS:

dishType (array — puede ser más de uno, especialmente en combos):
${VALID_DISH_TYPES.join(", ")}
Reglas dishType:
- Si es un combo/pack con varios productos → incluye "combo" MÁS los tipos que contiene (ej: ["combo","hamburguesa","papas fritas"])
- Bebidas: "café" (espresso, americano, cortado, café negro), "café con leche" (latte, cappuccino, flat white, macchiato), "té" (cualquier té o infusión), "jugo" (jugos naturales o en caja), "batido" (smoothie, milkshake, malteada), "bebida" (sodas, agua, bebidas embotelladas), "alcohol" (cerveza, vino, pisco, coctel, destilados), "mocktail" (coctel sin alcohol).
- "extra" para salsas, condimentos, aderezos y porciones adicionales. Si el nombre empieza con "salsa", "extra de", "adicional", "porción de", o es un condimento solo (ají, jengibre, chimichurri, tamarindo, soya, acevichada, huancaína, golf, mayo, ketchup, mostaza, etc.) → siempre ["extra"]. Estos NO son platos principales.
- Elige SOLO de la lista de arriba. Si ninguno aplica, deja []
- La mayoría de platos tendrá 1 solo tipo. Los combos tendrán 2-3.

cuisine (array, solo si aplica claramente):
chilena, peruana, nikkei, venezolana, italiana, americana, mexicana, japonesa, china, árabe, mediterránea, francesa, asiática, coreana, india, thai, griega, española, brasileña, fusión
Reglas cuisine:
- "chilena" SOLO para platos tradicionales chilenos: cazuela, empanada, sopaipilla, pastel de choclo, chorrillana, charquicán, humitas, porotos granados, prietas, longaniza, completo. Sándwiches comunes como ave mayo, lomito, barros luco → NO son "chilena" → cuisine: []. Una hamburguesa en Chile NO es chilena → [].
- "nikkei" para fusión japonesa-peruana (tiradito con toques japoneses, ceviche con soja, etc.)
- Deja [] si no hay cocina clara (ej: un helado de vainilla no tiene cocina específica, una hamburguesa genérica tampoco)

mealSlot (array):
desayuno, almuerzo, cena, snack
Un waffle puede ser [desayuno, snack]. Una hamburguesa es [almuerzo, cena].

mainIngredient (array, los más importantes):
carne, pollo, cerdo, cordero, pescado, salmón, camarones, pulpo, mariscos, huevo, pasta, arroz, papa, verduras, legumbres, queso, queso crema, pan, fruta, tofu, tomate, lechuga, palta, cebolla, cebollín, jamón, salame, choclo, nutella
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
      console.error("[classify] Anthropic error:", err);
      return NextResponse.json({ error: "Error calling Claude API" }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[classify] No JSON in response:", text);
      return NextResponse.json({ error: "Invalid response from Claude" }, { status: 500 });
    }

    const classifications = JSON.parse(jsonMatch[0]);
    return NextResponse.json(classifications);
  } catch (e) {
    console.error("[classify]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
