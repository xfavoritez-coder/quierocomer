/**
 * Auto-detección de flags (picante / contiene frutos secos / sin gluten / sin lactosa / sin soya)
 * desde la descripción + nombre + ingredientes (texto libre) de un plato.
 *
 * Reglas:
 * - isSpicy: true si la descripción menciona picante / chili / calabreza / etc
 * - containsNuts: true si la descripción menciona maní / nueces / pistachos / Nutella / praliné / etc
 * - isGlutenFree: true solo si menciona explícitamente "sin gluten", "gluten free", "celíaco", etc
 * - isLactoseFree: true solo si menciona explícitamente "sin lactosa", "lactose free", "sin lácteos", etc
 * - isSoyFree: false por defecto (no se auto-detecta)
 *
 * Conservador: solo marca "sin X" si el texto lo dice explícitamente.
 */

const NUT_REGEX = /\b(man[ií]|nuez|nueces|almendr\w*|frutos secos|avellan\w*|pistach\w*|mara[nñ]on|cashew|pec[áa]n|walnut|nutella|pralin[eé]?|gianduja)\b/i;

const SPICY_REGEX = /\b(picante|spicy|calabres[ao]?|peperoncino|diavola|aj[íi]\b|chile\b|jalape[nñ]o|rocoto|sriracha|tabasco|chimichurri picante|merqu[eé]n|caliente)\b/i;

const GLUTEN_REGEX = /\b(pan\b|masa\b|harina|trigo|pasta\b|fideos?|pizza|empanada|bao\b|wrap|tortilla|focaccia|brioche|baguette|croissant|gnocchi|gnochis?|lasagna|cous?cous|seitan|cebada|centeno|spelt|panko|tempura|empan\w*)\b/i;

const LACTOSE_REGEX = /\b(queso\b|leche|lácte\w*|lacte\w*|mozzarella|burrata|ricotta|provolone|gorgonzola|parmes\w*|grana padano|crema\b|cream\b|mantequilla|butter|yogur|natilla|fior di latte|stracciatella|chantilly|nata\b|mascarpone|kefir|cheddar|brie|camembert|feta|manchego|requesón|condensada|evaporada|leche de\b)\b/i;

const SOY_REGEX = /\b(soya|soja|salsa de soya|salsa de soja|tofu|edamame|miso|tempeh|tamari)\b/i;

// Explicit "free-from" mentions — only mark as free when the text says so
const EXPLICIT_GF_REGEX = /\b(sin gluten|gluten[ -]?free|libre de gluten|apto cel[ií]ac|cel[ií]ac[oa]s?|sin tacc)\b/i;
const EXPLICIT_LF_REGEX = /\b(sin lactosa|lactose[ -]?free|libre de lactosa|sin l[áa]cteos|dairy[ -]?free|deslactosad[oa])\b/i;

export interface DetectedFlags {
  isSpicy: boolean;
  containsNuts: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  isSoyFree: boolean;
}

/**
 * Detecta flags desde texto libre (descripción + nombre + ingredientes).
 * Concatena todos los textos disponibles y aplica regex.
 */
export function detectDishFlags(opts: { name?: string | null; description?: string | null; ingredients?: string | null }): DetectedFlags {
  const text = [opts.name, opts.description, opts.ingredients]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!text.trim()) {
    return { isSpicy: false, containsNuts: false, isGlutenFree: false, isLactoseFree: false, isSoyFree: false };
  }

  return {
    isSpicy: SPICY_REGEX.test(text),
    containsNuts: NUT_REGEX.test(text),
    isGlutenFree: EXPLICIT_GF_REGEX.test(text),
    isLactoseFree: EXPLICIT_LF_REGEX.test(text),
    isSoyFree: false,
  };
}
