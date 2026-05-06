/**
 * Auto-detección de flags (picante / contiene frutos secos / sin gluten / sin lactosa / sin soya)
 * desde la descripción + nombre + ingredientes (texto libre) de un plato.
 *
 * Reglas:
 * - isSpicy: true si la descripción menciona picante / chili / calabreza / etc
 * - containsNuts: true si la descripción menciona maní / nueces / pistachos / Nutella / praliné / etc
 * - isGlutenFree: true por defecto, false si menciona pan / masa / harina / pizza / pasta / etc
 * - isLactoseFree: true por defecto, false si menciona queso / leche / mozzarella / crema / etc
 * - isSoyFree: true por defecto, false si menciona soya / soja / tofu / miso / etc
 *
 * Importante: para los "sin X" usamos la asunción "no menciona = no contiene".
 * Es agresivo pero útil al importar — el dueño puede destildar manualmente luego.
 */

const NUT_REGEX = /\b(man[ií]|nuez|nueces|almendr\w*|frutos secos|avellan\w*|pistach\w*|mara[nñ]on|cashew|pec[áa]n|walnut|nutella|pralin[eé]?|gianduja)\b/i;

const SPICY_REGEX = /\b(picante|spicy|calabres[ao]?|peperoncino|diavola|aj[íi]\b|chile\b|jalape[nñ]o|rocoto|sriracha|tabasco|chimichurri picante|merqu[eé]n|caliente)\b/i;

const GLUTEN_REGEX = /\b(pan\b|masa\b|harina|trigo|pasta\b|fideos?|pizza|empanada|bao\b|wrap|tortilla|focaccia|brioche|baguette|croissant|gnocchi|gnochis?|lasagna|cous?cous|seitan|cebada|centeno|spelt|panko|tempura|empan\w*)\b/i;

const LACTOSE_REGEX = /\b(queso\b|leche|lácte\w*|lacte\w*|mozzarella|burrata|ricotta|provolone|gorgonzola|parmes\w*|grana padano|crema\b|cream\b|mantequilla|butter|yogur|natilla|fior di latte|stracciatella|chantilly|nata\b|mascarpone|kefir|cheddar|brie|camembert|feta|manchego|requesón|condensada|evaporada|leche de\b)\b/i;

const SOY_REGEX = /\b(soya|soja|salsa de soya|salsa de soja|tofu|edamame|miso|tempeh|tamari)\b/i;

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
    isGlutenFree: !GLUTEN_REGEX.test(text),
    isLactoseFree: !LACTOSE_REGEX.test(text),
    isSoyFree: !SOY_REGEX.test(text),
  };
}
