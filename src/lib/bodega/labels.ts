// Etiquetas y orden de categorías y unidades del inventario (pilar Bodega).

export const CATEGORIA_LABEL: Record<string, string> = {
  PROTEINA: "Proteínas",
  VERDURA_FRUTA: "Verduras y frutas",
  ABARROTE: "Abarrotes",
  LACTEO: "Lácteos",
  PANADERIA: "Panadería",
  BEBIDA: "Bebidas",
  LICOR: "Licores",
  DESECHABLE: "Desechables",
  LIMPIEZA: "Limpieza",
  OTRO: "Otros",
};

// Orden en que se muestran las categorías en la vista de stock.
export const CATEGORIA_ORDER: string[] = [
  "PROTEINA", "VERDURA_FRUTA", "ABARROTE", "LACTEO", "PANADERIA",
  "BEBIDA", "LICOR", "DESECHABLE", "LIMPIEZA", "OTRO",
];

export const CATEGORIAS = CATEGORIA_ORDER;

export const UNIDAD_LABEL: Record<string, string> = {
  KG: "kg",
  GR: "g",
  LT: "L",
  ML: "ml",
  UN: "un",
  DOCENA: "doc",
  PAQUETE: "paq",
  CAJA: "caja",
  BANDEJA: "band",
  ATADO: "atado",
};

export const UNIDADES: string[] = ["KG", "GR", "LT", "ML", "UN", "DOCENA", "PAQUETE", "CAJA", "BANDEJA", "ATADO"];

/** Formatea un monto en pesos chilenos sin decimales: 1030353 -> "$1.030.353". */
export function clp(n: number): string {
  return "$" + Math.round(n || 0).toLocaleString("es-CL");
}

/** Formatea una cantidad de stock (hasta 2 decimales, sin ceros sobrantes). */
export function fmtStock(n: number): string {
  const v = Math.round((n || 0) * 100) / 100;
  return v.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}
