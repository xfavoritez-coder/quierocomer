import type { DemoData } from "./types";

// Local ficticio para demos sin datos o cuando falla la extracción. Viene incluido en
// el build (funciona sin internet). Las fotos reales quedan pendientes: por ahora cada
// plato se muestra con su emoji sobre un degradado del color del local.
const d = (name: string, price: number, emoji: string, description: string) => ({ name, price, emoji, description, photo: null });

export function fictionalDemo(name?: string | null): DemoData {
  return {
    leadId: null,
    name: name?.trim() || "Café Ejemplo",
    logoUrl: null,
    color: "#B4532A",
    bannerUrl: null,
    cuisine: "Cocina chilena de autor",
    commune: "Providencia",
    slug: null,
    isFictional: true,
    plans: [],
    storePlan: null,
    categories: [
      { name: "Para compartir", dishes: [
        d("Empanaditas de pino", 6900, "🥟", "Seis empanaditas de horno, pino de la casa"),
        d("Machas a la parmesana", 12900, "🐚", "Gratinadas con queso parmesano y vino blanco"),
        d("Tabla Pacífico", 16900, "🦐", "Ceviche, camarones al pil pil y pebre"),
        d("Sopaipillas con pebre", 4900, "🫓", "Ocho sopaipillas pasadas y pebre cuchareado"),
        d("Provoleta al merkén", 8900, "🧀", "Provoleta a la plancha, merkén y oliva"),
      ] },
      { name: "Fondos", dishes: [
        d("Pastel de choclo", 11900, "🌽", "Pino, pollo, huevo y aceituna, gratinado"),
        d("Charquicán de autor", 10900, "🥔", "Zapallo, papa, choclo y huevo frito"),
        d("Lomo a lo pobre", 15900, "🥩", "Lomo liso, papas fritas, cebolla y huevos"),
        d("Merluza austral", 13900, "🐟", "Con puré rústico y salsa de alcaparras"),
        d("Plateada al jugo", 14900, "🍖", "Cocción lenta 12 horas, puré picante"),
        d("Porotos granados", 9900, "🫘", "Con mazamorra y albahaca"),
        d("Risotto de hongos del bosque", 12900, "🍄", "Hongos de temporada y parmesano"),
        d("Salmón a la mantequilla", 14500, "🍣", "Con quinoa y verduras salteadas"),
      ] },
      { name: "Sándwiches", dishes: [
        d("Chacarero", 8900, "🥪", "Lomo, poroto verde, tomate y ají verde"),
        d("Barros Luco", 8500, "🥩", "Lomo y queso derretido en marraqueta"),
        d("Italiano", 7900, "🥑", "Palta, tomate y mayo casera"),
        d("Churrasco vegetal", 8400, "🥬", "Seitán, palta y tomate"),
      ] },
      { name: "Postres", dishes: [
        d("Leche asada", 4500, "🍮", "Receta de la abuela, caramelo tostado"),
        d("Torta tres leches", 4900, "🍰", "Bizcocho húmedo y merengue"),
        d("Mote con huesillo", 3900, "🍑", "Bien helado"),
        d("Calzones rotos", 3500, "🍩", "Con azúcar flor, recién hechos"),
        d("Sorbete de chirimoya", 4200, "🍨", "Hecho en casa"),
      ] },
      { name: "Bebidas", dishes: [
        d("Limonada menta jengibre", 3900, "🍋", "Natural, 500 ml"),
        d("Jugo de frambuesa", 3900, "🍓", "Natural, 500 ml"),
        d("Café de grano", 2500, "☕", "Espresso, americano o cortado"),
        d("Pisco sour", 5900, "🍸", "Pisco reservado, limón de pica"),
        d("Terremoto", 5500, "🍹", "Pipeño, helado de piña y granadina"),
        d("Copa de carmenere", 4900, "🍷", "Valle del Colchagua"),
        d("Agua mineral", 1900, "💧", "Con o sin gas"),
        d("Cerveza artesanal", 4500, "🍺", "Rubia o roja, 500 ml"),
      ] },
    ],
  };
}
