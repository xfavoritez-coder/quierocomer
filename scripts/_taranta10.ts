import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  // The /products page SSR only renders search section, categories are lazy-loaded via JS
  // But individual category pages DO render server-side. Let's probe common Italian restaurant slugs
  const base = "https://tarantarestaurante.ola.click";
  
  const candidateSlugs = [
    // From what we know (antipastos)
    "antipastos-italianos", "antipastos-tradicionales",
    // Italian restaurant categories
    "pastas", "pasta", "pizzas", "pizza", "risottos", "risotto",
    "carnes", "carne", "pescados", "pescado", "mariscos",
    "ensaladas", "ensalada", "sopas", "sopa", "cremas",
    "postres", "postre", "bebidas", "bebida", "vinos", "vino",
    "tragos", "trago", "cocktails", "cocktail", "cocteles",
    "cervezas", "cerveza", "jugos", "agua", "aguas",
    "entradas", "entrada", "platos-de-fondo", "platos-fondo", "fondos", "fondo",
    "principales", "principal", "especiales", "especial",
    "menu-del-dia", "almuerzo", "almuerzos",
    "aperitivos", "antipasti", "primi", "secondi",
    "contorni", "dolci", "calzones", "calzone",
    "lasagna", "lasagnas", "ravioles", "ravioli",
    "gnocchi", "ñoquis", "spaghetti",
    "paninis", "panini", "focaccia", "focaccias",
    "bruschetta", "bruschettas",
    "tiramisu", "gelato", "helados",
    "tabla", "tablas", "parrilla", "parrillada",
    "sandwich", "sandwiches", "hamburguesas", "hamburguesa",
    "agregados", "acompañamientos", "complementos", "extras",
    "promociones", "ofertas", "combos", "combo",
    "infantil", "niños", "kids",
    "menu-almuerzo", "menu-ejecutivo",
    "platos-principales", "platos-italianos",
    "pastas-largas", "pastas-cortas", "pastas-rellenas",
    "carnes-rojas", "carnes-blancas", "aves",
    "pollo", "cerdo", "cordero",
    "salmon", "atun", "pulpo",
    "bar", "barra", "licores",
    "cafe", "cafes", "te",
    "brunch", "desayuno", "desayunos",
    "aperol", "spritz", "gin",
    "pisco", "whisky",
  ];

  console.log(`Probing ${candidateSlugs.length} slugs...\n`);
  
  const found: { slug: string; chars: number }[] = [];
  
  // Batch of 10 parallel
  for (let i = 0; i < candidateSlugs.length; i += 10) {
    const batch = candidateSlugs.slice(i, i + 10);
    const results = await Promise.all(batch.map(async slug => {
      try {
        const r = await fetch(`${base}/${slug}`, { redirect: "follow" });
        const html = await r.text();
        // Check if it has products (prices)
        const hasPrices = /\$\s*[\d.,]+/.test(html);
        const productCount = (html.match(/product-card/g) || []).length;
        if (hasPrices && productCount > 0) {
          return { slug, chars: html.length, products: productCount };
        }
        return null;
      } catch { return null; }
    }));
    for (const r of results) {
      if (r) {
        found.push(r);
        console.log(`  ✅ /${r.slug} — ${r.products} products, ${r.chars} chars`);
      }
    }
  }

  console.log(`\n=== Found ${found.length} category pages ===`);
  for (const f of found) console.log(`  /${f.slug}`);
}
main().catch(e => { console.error(e); process.exit(1); });
