/**
 * Seed experience templates with results for: sushi, cafeteria, bar, vegan
 * + assign Horus Vegan to egyptian-gods
 *
 * Usage: node scripts/seed-experiences.js
 */
require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TEMPLATES = [
  {
    name: "¿Qué dios egipcio eres?",
    slug: "egyptian-gods",
    theme: "egyptian-gods",
    category: "vegan",
    description: "Descubre qué deidad ancestral habita en ti según tus gustos",
    accentColor: "#C9A84C",
    iconEmoji: "𓂀",
    results: [
      { name: "Ra", description: "El dios sol, líder supremo. Irradias energía y confianza.", traits: ["líder", "intenso", "solar"], matchCriteria: { birthMonths: [1, 7], hungerLevel: "heavy", ingredients: ["curry", "jengibre"] } },
      { name: "Isis", description: "La diosa madre, sabia y protectora. Tu intuición es tu poder.", traits: ["sabio", "protector", "dulce"], matchCriteria: { birthMonths: [3, 9], dietTypes: ["vegetarian"], ingredients: ["chocolate", "mango"] } },
      { name: "Osiris", description: "El dios de la resurrección. Equilibrio y renovación te definen.", traits: ["equilibrado", "resiliente", "profundo"], matchCriteria: { birthMonths: [2, 8], ingredients: ["arroz", "tofu"] } },
      { name: "Anubis", description: "El guardián del inframundo. Misterioso e introspectivo.", traits: ["misterioso", "solo", "profundo"], matchCriteria: { birthMonths: [10, 11], hungerLevel: "light", ingredients: ["sésamo", "trufa"] } },
      { name: "Thoth", description: "El dios del conocimiento. Tu mente es tu templo.", traits: ["intelectual", "curioso", "analítico"], matchCriteria: { birthMonths: [5, 12], ingredients: ["matcha", "café"] } },
      { name: "Hathor", description: "La diosa del amor y la alegría. Donde vas, brilla la vida.", traits: ["alegre", "social", "creativo"], matchCriteria: { birthMonths: [4, 6], ingredients: ["mango", "maracuyá", "frutilla"] } },
      { name: "Sekhmet", description: "La diosa guerrera. Tu fuerza interior es inigualable.", traits: ["fuerte", "picante", "decidido"], matchCriteria: { ingredients: ["curry", "chipotle", "wasabi"], isSpicy: true } },
      { name: "Horus", description: "El dios halcón, protector del cielo. Visión clara y justicia.", traits: ["protector", "justo", "visionario"], matchCriteria: { birthMonths: [1, 3, 7], dietTypes: ["vegan"], ingredients: ["palta", "quinoa"] } },
      { name: "Bastet", description: "La diosa gata. Elegancia, independencia y un toque salvaje.", traits: ["elegante", "independiente", "nocturno"], matchCriteria: { birthMonths: [8, 10], hungerLevel: "light", ingredients: ["edamame", "jengibre"] } },
    ],
  },
  {
    name: "¿Qué samurái eres?",
    slug: "samurai-spirit",
    theme: "samurai",
    category: "sushi",
    description: "El bushido revelará tu espíritu guerrero a través de tus gustos",
    accentColor: "#8B0000",
    iconEmoji: "⚔️",
    results: [
      { name: "Miyamoto Musashi", description: "El espadachín invicto. Estrategia pura.", traits: ["estratega", "solitario", "preciso"], matchCriteria: { hungerLevel: "heavy", ingredients: ["salmón", "atún"] } },
      { name: "Tomoe Gozen", description: "La guerrera legendaria. Gracia y fuerza en perfecta armonía.", traits: ["valiente", "elegante", "equilibrado"], matchCriteria: { birthMonths: [3, 6, 9], ingredients: ["camarón", "mango"] } },
      { name: "Oda Nobunaga", description: "El unificador. Visión audaz y ambición sin límites.", traits: ["líder", "audaz", "intenso"], matchCriteria: { hungerLevel: "heavy", ingredients: ["wasabi", "jengibre"] } },
      { name: "Takeda Shingen", description: "El tigre de Kai. Fuerza tranquila y dominio absoluto.", traits: ["fuerte", "calmado", "honorable"], matchCriteria: { birthMonths: [1, 4, 10], ingredients: ["arroz", "soja"] } },
      { name: "Sen no Rikyū", description: "El maestro del té. La belleza está en la simplicidad.", traits: ["minimalista", "sereno", "sabio"], matchCriteria: { hungerLevel: "light", ingredients: ["matcha", "edamame", "tofu"] } },
      { name: "Date Masamune", description: "El dragón de un ojo. Impredecible y carismático.", traits: ["impredecible", "carismático", "aventurero"], matchCriteria: { birthMonths: [5, 8, 11], ingredients: ["tempura", "panko"] } },
    ],
  },
  {
    name: "¿Qué alma de café eres?",
    slug: "coffee-soul",
    theme: "coffee",
    category: "cafeteria",
    description: "Tu forma de tomar café dice más de ti de lo que crees",
    accentColor: "#6F4E37",
    iconEmoji: "☕",
    results: [
      { name: "Espresso Puro", description: "Directo, sin rodeos. La esencia en su forma más concentrada.", traits: ["directo", "intenso", "eficiente"], matchCriteria: { hungerLevel: "light", ingredients: ["café", "chocolate"] } },
      { name: "Cappuccino", description: "Equilibrio perfecto entre fuerza y suavidad. El clásico eterno.", traits: ["equilibrado", "clásico", "social"], matchCriteria: { birthMonths: [3, 6, 9, 12], ingredients: ["leche de avena", "canela"] } },
      { name: "Cold Brew", description: "Cool, paciente, sofisticado. Las mejores cosas toman tiempo.", traits: ["paciente", "moderno", "sofisticado"], matchCriteria: { birthMonths: [1, 5, 7], hungerLevel: "normal" } },
      { name: "Matcha Latte", description: "Zen y consciente. Buscas bienestar en cada sorbo.", traits: ["zen", "saludable", "mindful"], matchCriteria: { dietTypes: ["vegan", "vegetarian"], ingredients: ["matcha"] } },
      { name: "Mocha", description: "No puedes elegir solo uno. La vida es para disfrutarla toda.", traits: ["indulgente", "creativo", "dulce"], matchCriteria: { hungerLevel: "heavy", ingredients: ["chocolate", "mango", "frutilla"] } },
    ],
  },
  {
    name: "¿Qué espíritu de cocktail eres?",
    slug: "cocktail-spirit",
    theme: "cocktail",
    category: "bar",
    description: "Tu personalidad se destila en un trago. Descubre cuál",
    accentColor: "#4A0E4E",
    iconEmoji: "🍸",
    results: [
      { name: "Old Fashioned", description: "Clásico, sofisticado, con carácter. No necesitas ser moderno para ser relevante.", traits: ["clásico", "sofisticado", "fuerte"], matchCriteria: { hungerLevel: "heavy", birthMonths: [1, 10, 11] } },
      { name: "Mojito", description: "Fresco, social, la vida de la fiesta. Donde estás tú, hay buena energía.", traits: ["social", "alegre", "fresco"], matchCriteria: { birthMonths: [3, 6, 7, 12], ingredients: ["limón", "menta"] } },
      { name: "Negroni", description: "Amargo, complejo, adictivo. No eres para todos, pero los que te entienden no te dejan ir.", traits: ["complejo", "intenso", "selectivo"], matchCriteria: { hungerLevel: "light", ingredients: ["café", "chocolate"] } },
      { name: "Margarita", description: "Atrevido, vibrante, con un toque ácido. La vida es corta para ser aburrido.", traits: ["atrevido", "vibrante", "picante"], matchCriteria: { ingredients: ["limón", "chipotle", "cilantro"], isSpicy: true } },
      { name: "Aperol Spritz", description: "Ligero, elegante, europeo. Disfrutas los pequeños placeres sin prisa.", traits: ["elegante", "relajado", "social"], matchCriteria: { birthMonths: [4, 5, 8, 9], hungerLevel: "light" } },
      { name: "Pisco Sour", description: "Auténtico, con raíces profundas. Orgulloso de dónde vienes.", traits: ["auténtico", "patriota", "equilibrado"], matchCriteria: { birthMonths: [2, 9, 10], ingredients: ["limón", "maracuyá"] } },
    ],
  },
];

async function main() {
  console.log("🎭 Seeding experience templates...\n");

  for (const tpl of TEMPLATES) {
    const existing = await prisma.experienceTemplate.findUnique({ where: { slug: tpl.slug } });
    if (existing) {
      console.log(`  ⏭️  ${tpl.name} (ya existe)`);
      continue;
    }

    const template = await prisma.experienceTemplate.create({
      data: {
        name: tpl.name,
        slug: tpl.slug,
        theme: tpl.theme,
        category: tpl.category,
        description: tpl.description,
        accentColor: tpl.accentColor,
        iconEmoji: tpl.iconEmoji,
      },
    });

    for (let i = 0; i < tpl.results.length; i++) {
      const r = tpl.results[i];
      await prisma.experienceResult.create({
        data: {
          templateId: template.id,
          name: r.name,
          description: r.description,
          traits: r.traits,
          matchCriteria: r.matchCriteria,
          position: i,
        },
      });
    }

    console.log(`  ✅ ${tpl.name} (${tpl.results.length} resultados)`);
  }

  // Assign egyptian-gods to Horus Vegan
  const horus = await prisma.restaurant.findUnique({ where: { slug: "horusvegan" } });
  const egyptianTemplate = await prisma.experienceTemplate.findUnique({ where: { slug: "egyptian-gods" } });
  if (horus && egyptianTemplate) {
    await prisma.experience.upsert({
      where: { restaurantId: horus.id },
      create: { restaurantId: horus.id, templateId: egyptianTemplate.id },
      update: { templateId: egyptianTemplate.id, isActive: true },
    });
    console.log(`\n  🏛️ Horus Vegan → ¿Qué dios egipcio eres?`);
  }

  console.log("\n✅ Listo.\n");
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
