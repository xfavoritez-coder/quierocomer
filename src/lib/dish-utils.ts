const DISH_CAT_LABELS: Record<string, string> = {
  PASTA: "Pasta", PIZZA: "Pizza", SUSHI: "Sushi", SANDWICH: "Sándwich",
  BURGER: "Hamburguesa", BREAKFAST: "Desayuno", BRUNCH: "Brunch",
  SALAD: "Ensalada", SOUP: "Sopa", ICE_CREAM: "Helado", DESSERT: "Postre",
  SEAFOOD: "Mariscos", MAIN_COURSE: "Plato de fondo", VEGETARIAN: "Vegetariano",
  VEGAN: "Vegano", OTHER: "Otro",
};

const CARNES = ["pollo", "carne", "vacuno", "cerdo", "cordero", "asado", "pavo", "tocino"];

function has(ingredients: string[], keywords: string[]): boolean {
  return ingredients.some(i => keywords.some(k => i.includes(k)));
}

export function inferCategory(ingredients: string[], precio?: number): string {
  const ings = ingredients.map(i => i.toLowerCase());

  if (has(ings, ["pasta", "spaghetti", "fettuccine", "penne", "lasaña"])) return "PASTA";
  if (has(ings, ["pizza", "masa de pizza"])) return "PIZZA";
  if (has(ings, ["arroz", "soja", "alga nori", "salmón ahumado"])) return "SUSHI";
  if (has(ings, ["pan", "marraqueta", "hallulla", "baguette"])) return "SANDWICH";
  if (has(ings, ["carne molida", "hamburguesa", "brioche"])) return "BURGER";
  if (has(ings, ["huevo", "tostada", "mermelada", "mantequilla", "granola"])) return "BREAKFAST";
  if (has(ings, ["palta", "queso crema", "salmón", "prosciutto"]) && (precio ?? 99999) < 8000) return "BRUNCH";
  if (has(ings, ["lechuga", "rúcula", "espinaca", "mix de hojas"])) return "SALAD";
  if (has(ings, ["caldo", "crema de", "bisque"])) return "SOUP";
  if (has(ings, ["helado", "sorbete"])) return "ICE_CREAM";
  if (has(ings, ["chocolate", "manjar", "crema pastelera", "mousse"])) return "DESSERT";
  if (has(ings, ["camarón", "pulpo", "jaiba", "machas", "ostras", "corvina", "reineta"])) return "SEAFOOD";
  if (has(ings, CARNES)) return "MAIN_COURSE";
  if (has(ings, ["tofu", "champiñones", "berenjena", "zucchini"]) && !has(ings, CARNES)) return "VEGETARIAN";

  return "MAIN_COURSE";
}

export function getCategoryLabel(slug: string): string {
  return DISH_CAT_LABELS[slug] ?? slug;
}
