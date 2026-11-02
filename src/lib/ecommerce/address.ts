// Formateo de direcciones de Google Places → string limpio y con comas.
// En Chile el `formatted_address` a veces NO pone coma entre el número y la
// comuna ("Sta. Elena 1278 Santiago, …"). Armando desde `address_components`
// queda separado por comas: "Calle 1278, Comuna, Ciudad, Región, País".

export interface GAddressComponent { long_name: string; short_name: string; types: string[] }
export interface GPlaceLike { formatted_address?: string; address_components?: GAddressComponent[] }

export interface ParsedAddress {
  street: string;    // "Sta. Elena 1278"
  comuna: string;    // "Santiago"
  city: string;      // provincia/ciudad
  region: string;    // "Región Metropolitana"
  country: string;   // "Chile"
  formatted: string; // todo junto, separado por comas
}

/** Limpia un string de dirección (quita códigos postales de 7 dígitos y comas dobles). */
export function cleanAddressString(raw: string): string {
  return (raw || "")
    .replace(/,?\s*\d{7}\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(,\s*)+,/g, ", ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

/** Extrae calle/comuna/ciudad/región/país desde los componentes de Google. */
export function parsePlaceAddress(place: GPlaceLike | null | undefined, fallback = ""): ParsedAddress {
  const comps = place?.address_components;
  const get = (...types: string[]): string => {
    if (!Array.isArray(comps)) return "";
    for (const t of types) {
      const c = comps.find((x) => x.types.includes(t));
      if (c?.long_name) return c.long_name;
    }
    return "";
  };

  const streetNumber = get("street_number");
  const route = get("route");
  const street = [route, streetNumber].filter(Boolean).join(" ").trim();
  // En Chile la comuna suele venir como `locality`; si no, caemos a sublocalidad / nivel 3.
  const comuna = get("locality", "administrative_area_level_3", "sublocality", "sublocality_level_1");
  const city = get("administrative_area_level_2");
  const region = get("administrative_area_level_1");
  const country = get("country");

  // Arma el string con comas, sin repetir partes consecutivas iguales (ej: ciudad == comuna).
  const seq = [street, comuna, city, region, country].filter(Boolean);
  const dedup = seq.filter((p, i) => i === 0 || p.toLowerCase() !== seq[i - 1].toLowerCase());
  const formatted = dedup.length ? dedup.join(", ") : cleanAddressString(place?.formatted_address || fallback);

  return { street, comuna, city, region, country, formatted };
}

/** Atajo: solo el string formateado (lo que se guarda/muestra hoy). */
export function formatPlaceAddress(place: GPlaceLike | null | undefined, fallback = ""): string {
  return parsePlaceAddress(place, fallback).formatted;
}
