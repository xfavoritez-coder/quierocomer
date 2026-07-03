/**
 * Seed ~110 InsumoMaestro chilenos para el módulo Control.
 * Usage: npx tsx scripts/seed-insumos-maestro.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const INSUMOS = [
  // ─── PROTEÍNA ───────────────────────────────────────────────
  { nombre: "Pechuga de pollo",    categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["pechuga", "pollo", "pollo entero", "pollo trozado"] },
  { nombre: "Muslo de pollo",      categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["muslo", "pierna de pollo", "trutro", "pierna muslo"] },
  { nombre: "Filete de vacuno",    categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["filete", "lomo liso", "lomo vetado", "carne de vacuno", "bife"] },
  { nombre: "Carne molida",        categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["carne picada", "picada de vacuno", "molida", "carne para hamburguesa"] },
  { nombre: "Lomo de cerdo",       categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["lomo cerdo", "cerdo", "chancho", "lomo"] },
  { nombre: "Costillar de cerdo",  categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["costillas", "costillar", "ribs", "costillar parrilla"] },
  { nombre: "Salmón",              categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["salmon", "filete de salmon", "salmon fresco", "salmon noruego"] },
  { nombre: "Reineta",             categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["reineta entera", "pez espada", "reineta fresca"] },
  { nombre: "Merluza",             categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["merluza entera", "filete de merluza", "merluza austral"] },
  { nombre: "Camarones",           categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["camaron", "gambas", "camarones congelados", "camarones frescos", "langostinos"] },
  { nombre: "Atún en conserva",    categoria: "PROTEINA",     unidadBase: "UN",      aliases: ["atun", "tuna", "lata de atun", "atun al agua", "atun en lata"] },
  { nombre: "Huevos",              categoria: "PROTEINA",     unidadBase: "UN",      aliases: ["huevo", "huevos de gallina", "huevo entero", "docena huevos"] },
  { nombre: "Chorizo",             categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["chorizo fresco", "choricillo", "longaniza chorizo"] },
  { nombre: "Longaniza",           categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["longaniza parrillera", "vienesa", "frankfurt", "salchicha"] },
  { nombre: "Bacon / Tocino",      categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["bacon", "tocino", "panceta", "tocineta"] },
  { nombre: "Jamón",               categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["jamon cocido", "fiambre", "jamón de pavo"] },
  { nombre: "Tofu",                categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["tofu firme", "tofu blando", "cuajada de soja", "soja"] },
  { nombre: "Camarón entero",      categoria: "PROTEINA",     unidadBase: "KG",      aliases: ["camaron entero", "camarón con cabeza"] },

  // ─── VERDURA / FRUTA ────────────────────────────────────────
  { nombre: "Tomate",              categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["tomate redondo", "tomate cherry", "tomates", "tomate perita"] },
  { nombre: "Lechuga",             categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["lechuga costina", "lechuga americana", "lechuga morada", "mix lechugas", "baby lechuga"] },
  { nombre: "Cebolla",             categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["cebolla blanca", "cebolla cabezona", "cebollas"] },
  { nombre: "Cebolla morada",      categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["cebolla roja", "cebolla morada"] },
  { nombre: "Ajo",                 categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["cabeza de ajo", "diente de ajo", "ajos", "ajito"] },
  { nombre: "Palta",               categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["aguacate", "palta hass", "avocado", "palta negra"] },
  { nombre: "Limón",               categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["limon sutil", "limon pica", "limon de pica", "limon verde"] },
  { nombre: "Naranja",             categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["naranja fresca", "jugo de naranja", "naranja navel"] },
  { nombre: "Papa",                categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["papa corriente", "papa blanca", "papas", "patata", "papa amarilla"] },
  { nombre: "Zanahoria",           categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["zanahorias", "zanahoria fresca", "zanahoria baby"] },
  { nombre: "Zapallo italiano",    categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["zucchini", "calabacin", "zapallito italiano", "zuchini"] },
  { nombre: "Zapallo",             categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["zapallo camote", "calabaza", "zapallo de guarda", "pumpkin"] },
  { nombre: "Brócoli",             categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["brocoli", "broccoli", "brocolis"] },
  { nombre: "Espinaca",            categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["espinacas", "baby spinach", "hojas espinaca"] },
  { nombre: "Pimentón rojo",       categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["pimiento rojo", "morron rojo", "capsicum rojo"] },
  { nombre: "Pimentón verde",      categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["pimiento verde", "morron verde", "capsicum verde"] },
  { nombre: "Pepino",              categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["pepino español", "pepino ensalada", "cucumber"] },
  { nombre: "Champiñones",         categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["champignon", "hongos", "setas", "portobello", "mushrooms"] },
  { nombre: "Cilantro",            categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["culantro", "coriandro", "hierba cilantro"] },
  { nombre: "Perejil",             categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["perejil fresco", "hierba perejil"] },
  { nombre: "Albahaca",            categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["basilico", "basil", "albahaca fresca"] },
  { nombre: "Choclo",              categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["maiz dulce", "maiz", "choclo desgranado", "corn", "elote"] },
  { nombre: "Betarraga",           categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["remolacha", "betabel", "beet"] },
  { nombre: "Puerro",              categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["ajo porro", "porro", "leek"] },
  { nombre: "Espárragos",          categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["esparragos", "espárrago verde", "asparagus"] },
  { nombre: "Mango",               categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["mango fresco", "mango tropical"] },
  { nombre: "Frutilla",            categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["fresa", "strawberry", "fresón", "frutillas"] },
  { nombre: "Rúcula",              categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["rucula", "arugula", "rucola"] },
  { nombre: "Apio",                categoria: "VERDURA_FRUTA", unidadBase: "KG",     aliases: ["apio fresco", "celery", "apio verde"] },

  // ─── ABARROTE ────────────────────────────────────────────────
  { nombre: "Arroz",               categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["arroz grano largo", "arroz parbolizado", "arroz integral", "rice"] },
  { nombre: "Fideos cortos",       categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["fideos", "pasta corta", "macarrones", "penne", "rigatoni", "farfalle"] },
  { nombre: "Espaguetis",          categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["spaghetti", "fideos largos", "linguine", "tallarines", "vermicelli"] },
  { nombre: "Aceite de oliva",     categoria: "ABARROTE",     unidadBase: "LT",      aliases: ["aceite oliva", "olive oil", "aove", "aceite extra virgen"] },
  { nombre: "Aceite vegetal",      categoria: "ABARROTE",     unidadBase: "LT",      aliases: ["aceite girasol", "aceite canola", "aceite maravilla", "aceite"] },
  { nombre: "Sal",                 categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["sal de mesa", "sal de cocina", "sal fina", "sal gruesa"] },
  { nombre: "Pimienta negra",      categoria: "ABARROTE",     unidadBase: "GR",      aliases: ["pimienta", "pimienta molida", "pimienta entera", "pepper"] },
  { nombre: "Azúcar",              categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["azucar blanca", "azucar granulada", "sugar"] },
  { nombre: "Harina",              categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["harina sin polvos", "harina todo uso", "harina blanca", "flour"] },
  { nombre: "Mayonesa",            categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["mayo", "salsa mayo", "mayonesa casera"] },
  { nombre: "Ketchup",             categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["catsup", "salsa de tomate", "salsa ketchup"] },
  { nombre: "Mostaza",             categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["mostaza amarilla", "mostaza dijon", "salsa mostaza"] },
  { nombre: "Salsa de soja",       categoria: "ABARROTE",     unidadBase: "LT",      aliases: ["soya", "soja", "salsa soya", "tamari", "soy sauce"] },
  { nombre: "Caldo de pollo",      categoria: "ABARROTE",     unidadBase: "LT",      aliases: ["caldo", "consomé de pollo", "concentrado pollo", "bouillon"] },
  { nombre: "Crema de leche UHT",  categoria: "ABARROTE",     unidadBase: "LT",      aliases: ["crema larga vida", "nata uht", "crema en caja", "crema de leche"] },
  { nombre: "Pasta de tomate",     categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["puré de tomate", "concentrado de tomate", "salsa de tomate"] },
  { nombre: "Tomates en conserva", categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["tomates pelados", "tomates en lata", "diced tomatoes"] },
  { nombre: "Vinagre",             categoria: "ABARROTE",     unidadBase: "LT",      aliases: ["vinagre de vino", "vinagre blanco", "vinagre de manzana"] },
  { nombre: "Pan rallado",         categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["breadcrumbs", "apanado", "pan molido", "pan tostado molido"] },
  { nombre: "Panko",               categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["pan molido japones", "panko japones", "japanese breadcrumbs"] },
  { nombre: "Merkén",              categoria: "ABARROTE",     unidadBase: "GR",      aliases: ["merquen", "aji merken", "aji cacho de cabra", "paprika chilena"] },
  { nombre: "Aceitunas",           categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["aceitunas negras", "aceitunas verdes", "olivas", "aceituna"] },
  { nombre: "Maicena",             categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["almidón de maíz", "fecula de maiz", "corn starch", "chuño"] },
  { nombre: "Azúcar flor",         categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["azucar glass", "azucar impalpable", "azucar en polvo"] },
  { nombre: "Lentejas",            categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["lenteja", "lentils", "lentejas verdes"] },
  { nombre: "Garbanzos",           categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["garbanzo", "chickpeas", "garbanzos cocidos"] },
  { nombre: "Porotos",             categoria: "ABARROTE",     unidadBase: "KG",      aliases: ["frejoles", "frijoles", "beans", "porotos negros", "porotos blancos"] },

  // ─── LÁCTEO ─────────────────────────────────────────────────
  { nombre: "Leche",               categoria: "LACTEO",       unidadBase: "LT",      aliases: ["leche entera", "leche semidescremada", "leche descremada", "milk"] },
  { nombre: "Queso",               categoria: "LACTEO",       unidadBase: "KG",      aliases: ["queso mantecoso", "queso de campo", "queso chanco", "queso fresco", "queso laminado"] },
  { nombre: "Queso parmesano",     categoria: "LACTEO",       unidadBase: "KG",      aliases: ["parmesano", "queso rallado", "reggiano", "grana padano"] },
  { nombre: "Yogurt natural",      categoria: "LACTEO",       unidadBase: "KG",      aliases: ["yogur", "yoghurt natural", "yogurt griego", "yogurt sin azucar"] },
  { nombre: "Crema fresca",        categoria: "LACTEO",       unidadBase: "LT",      aliases: ["crema agria", "sour cream", "crema batida", "crema de leche fresca"] },
  { nombre: "Quesillo",            categoria: "LACTEO",       unidadBase: "KG",      aliases: ["queso fresco", "ricotta", "cuajada", "queso cottage"] },
  { nombre: "Mantequilla",         categoria: "LACTEO",       unidadBase: "KG",      aliases: ["manteca", "butter", "mantequilla sin sal"] },

  // ─── PANADERÍA ──────────────────────────────────────────────
  { nombre: "Pan de molde",        categoria: "PANADERIA",    unidadBase: "UN",      aliases: ["pan lactal", "pan sandwich", "rebanadas de pan"] },
  { nombre: "Pan de hamburguesa",  categoria: "PANADERIA",    unidadBase: "UN",      aliases: ["pan hamburguesa", "bun", "pan de brioche", "pan burger"] },
  { nombre: "Pan ciabatta",        categoria: "PANADERIA",    unidadBase: "UN",      aliases: ["ciabatta", "pan italiano", "pan artesanal"] },
  { nombre: "Pan baguette",        categoria: "PANADERIA",    unidadBase: "UN",      aliases: ["baguette", "pan francés", "marraqueta", "hallulla"] },
  { nombre: "Pan pita",            categoria: "PANADERIA",    unidadBase: "UN",      aliases: ["pita", "pan árabe", "pita bread"] },
  { nombre: "Masa de pizza",       categoria: "PANADERIA",    unidadBase: "UN",      aliases: ["masa pizza", "base pizza", "disco de pizza", "masa para pizza"] },
  { nombre: "Tortilla de trigo",   categoria: "PANADERIA",    unidadBase: "UN",      aliases: ["wrap", "tortilla", "tortilla de harina", "flour tortilla"] },

  // ─── BEBIDA ─────────────────────────────────────────────────
  { nombre: "Agua mineral",        categoria: "BEBIDA",       unidadBase: "LT",      aliases: ["agua con gas", "agua sin gas", "agua purificada", "agua embotellada"] },
  { nombre: "Bebida cola",         categoria: "BEBIDA",       unidadBase: "LT",      aliases: ["coca cola", "pepsi", "bebida negra", "cola"] },
  { nombre: "Bebida sin azúcar",   categoria: "BEBIDA",       unidadBase: "LT",      aliases: ["bebida zero", "bebida light", "cola zero", "bebida dieta"] },
  { nombre: "Jugo de naranja",     categoria: "BEBIDA",       unidadBase: "LT",      aliases: ["zumo naranja", "jugo natural naranja", "OJ"] },
  { nombre: "Cerveza",             categoria: "BEBIDA",       unidadBase: "LT",      aliases: ["cerveza lager", "cerveza artesanal", "beer", "schop", "lata de cerveza"] },
  { nombre: "Vino tinto",          categoria: "BEBIDA",       unidadBase: "LT",      aliases: ["vino", "cabernet sauvignon", "malbec", "carmenere", "vino de mesa"] },
  { nombre: "Vino blanco",         categoria: "BEBIDA",       unidadBase: "LT",      aliases: ["chardonnay", "sauvignon blanc", "vino blanco seco"] },
  { nombre: "Pisco",               categoria: "BEBIDA",       unidadBase: "LT",      aliases: ["pisco sour", "aguardiente", "pisco premium", "pisco especial"] },

  // ─── LICOR ──────────────────────────────────────────────────
  { nombre: "Ron",                 categoria: "LICOR",        unidadBase: "LT",      aliases: ["ron blanco", "ron oscuro", "rhum", "ron añejo"] },
  { nombre: "Vodka",               categoria: "LICOR",        unidadBase: "LT",      aliases: ["vodka premium", "vodka destilado"] },
  { nombre: "Whisky",              categoria: "LICOR",        unidadBase: "LT",      aliases: ["whiskey", "bourbon", "scotch"] },

  // ─── DESECHABLE ─────────────────────────────────────────────
  { nombre: "Vasos desechables",   categoria: "DESECHABLE",   unidadBase: "PAQUETE", aliases: ["vasos plastico", "vasos papel", "vasos descartables", "vasos carton"] },
  { nombre: "Platos desechables",  categoria: "DESECHABLE",   unidadBase: "PAQUETE", aliases: ["platos plastico", "platos descartables", "platos carton"] },
  { nombre: "Bolsas de papel",     categoria: "DESECHABLE",   unidadBase: "PAQUETE", aliases: ["bolsa kraft", "bolsa papel", "bolsa delivery", "bolsita papel"] },
  { nombre: "Papel aluminio",      categoria: "DESECHABLE",   unidadBase: "UN",      aliases: ["alusa foil", "papel de aluminio", "foil", "aluminio"] },
  { nombre: "Film plástico",       categoria: "DESECHABLE",   unidadBase: "UN",      aliases: ["film", "wrap", "papel film", "papel stretch", "cling film"] },
  { nombre: "Guantes de látex",    categoria: "DESECHABLE",   unidadBase: "CAJA",    aliases: ["guantes desechables", "guantes plastico", "guantes cocina"] },
  { nombre: "Servilletas",         categoria: "DESECHABLE",   unidadBase: "PAQUETE", aliases: ["servilletas de papel", "servilletas blancas", "napkins"] },

  // ─── LIMPIEZA ────────────────────────────────────────────────
  { nombre: "Detergente lavavajilla", categoria: "LIMPIEZA",  unidadBase: "LT",      aliases: ["lavaplatos", "quix", "detergente", "líquido loza", "lava todo"] },
  { nombre: "Cloro",               categoria: "LIMPIEZA",     unidadBase: "LT",      aliases: ["lejía", "blanqueador", "hipoclorito de sodio", "cloro liquido"] },
  { nombre: "Desengrasante",       categoria: "LIMPIEZA",     unidadBase: "LT",      aliases: ["quitagrasa", "degreaser", "limpia cocina", "limpiador fuerte"] },
  { nombre: "Esponjas",            categoria: "LIMPIEZA",     unidadBase: "PAQUETE", aliases: ["esponja", "estropajo", "fibra de limpieza", "scotch brite"] },
  { nombre: "Jabón de manos",      categoria: "LIMPIEZA",     unidadBase: "LT",      aliases: ["jabón antibacterial", "gel desinfectante", "jabón liquido", "hand soap"] },
  { nombre: "Bolsas de basura",    categoria: "LIMPIEZA",     unidadBase: "PAQUETE", aliases: ["bolsas plástico", "bolsas residuos", "bolsas negras", "bolsas verdes"] },
  { nombre: "Papel absorbente",    categoria: "LIMPIEZA",     unidadBase: "PAQUETE", aliases: ["papel cocina", "papel secador", "paper towel", "toalla nova", "nova"] },
];

async function main() {
  console.log(`Seeding ${INSUMOS.length} insumos maestros...`);
  let created = 0;
  let skipped = 0;

  for (const insumo of INSUMOS) {
    const existing = await prisma.insumoMaestro.findUnique({
      where: { nombre: insumo.nombre },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.insumoMaestro.create({
      data: {
        nombre: insumo.nombre,
        categoria: insumo.categoria as any,
        unidadBase: insumo.unidadBase as any,
        aliases: insumo.aliases,
      },
    });
    created++;
  }

  console.log(`✅ Listo. Creados: ${created}, Ya existían: ${skipped}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
