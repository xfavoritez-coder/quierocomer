/**
 * Calcula y guarda zonas de delivery de Kojo Recoleta y Kojo La Florida:
 * - Radio exacto de 13 km desde cada local
 * - Cortadas en la bisectriz perpendicular entre los dos centros → sin solapamiento
 */
import { prisma } from "@/lib/prisma";

const LAT_KM = 111.32;
const LNG_KM = 92.94; // cos(33.5°) * 111.32

const R = { lat: -33.4337032, lng: -70.6378453 }; // Kojo Recoleta
const F = { lat: -33.5225335, lng: -70.5969318 }; // Kojo La Florida
const RADIUS = 13; // km

// ── Distancia entre los dos centros ─────────────────────────────────────────
const dLat = (F.lat - R.lat) * LAT_KM; // km
const dLng = (F.lng - R.lng) * LNG_KM; // km
const dist = Math.sqrt(dLat ** 2 + dLng ** 2); // ≈ 10.59 km

// ── Punto medio (bisectriz pasa por aquí) ────────────────────────────────────
const M = { lat: (R.lat + F.lat) / 2, lng: (R.lng + F.lng) / 2 };

// ── Dirección perpendicular a R→F (unitaria, en km) ──────────────────────────
// Vector R→F: (dLng, dLat). Perpendicular (rotado 90° CCW): (-dLat, dLng)
const perpX = -dLat / dist; // componente este
const perpY = dLng / dist;  // componente norte

// ── Puntos de intersección de los dos círculos ────────────────────────────────
// h = distancia desde el punto medio hasta las intersecciones
const h = Math.sqrt(RADIUS ** 2 - (dist / 2) ** 2); // ≈ 11.87 km

const INT1 = {
  lat: M.lat + (perpY * h) / LAT_KM,
  lng: M.lng + (perpX * h) / LNG_KM,
}; // NE (~-33.440, -70.498)

const INT2 = {
  lat: M.lat - (perpY * h) / LAT_KM,
  lng: M.lng - (perpX * h) / LNG_KM,
}; // SW (~-33.516, -70.737)

// ── Genera un punto en el círculo de un centro dado ──────────────────────────
// θ en grados: 0=este, 90=norte, va CCW
function pt(center: typeof R, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    lat: parseFloat((center.lat + (RADIUS * Math.sin(rad)) / LAT_KM).toFixed(6)),
    lng: parseFloat((center.lng + (RADIUS * Math.cos(rad)) / LNG_KM).toFixed(6)),
  };
}

function round(p: { lat: number; lng: number }) {
  return { lat: parseFloat(p.lat.toFixed(6)), lng: parseFloat(p.lng.toFixed(6)) };
}

// ── RECOLETA ─────────────────────────────────────────────────────────────────
// INT1 está a ~-3° de R (casi due-east). INT2 está a ~225° (suroeste).
// El arco de Recoleta va CCW de -3° hasta 225° (pasando por N, O, SO).
// Generamos puntos cada 20° desde 0° hasta 220°, enmarcados por INT1 e INT2.
const RECOLETA_POLYGON = [
  round(INT1),    // -3° (límite NE compartido)
  pt(R, 20),
  pt(R, 40),
  pt(R, 60),
  pt(R, 80),
  pt(R, 90),      // norte
  pt(R, 100),
  pt(R, 120),
  pt(R, 140),
  pt(R, 160),
  pt(R, 180),     // oeste
  pt(R, 200),
  pt(R, 220),
  round(INT2),    // 225° (límite SO compartido)
  // cierre recto → INT1 = borde compartido con La Florida
];

// ── LA FLORIDA ───────────────────────────────────────────────────────────────
// INT1 está a ~45° de F (noreste). INT2 está a ~177° (casi due-west).
// El arco de La Florida va CW de 45° hasta 177° (pasando por E, S, O).
// Generamos puntos cada 20° desde 25° bajando hasta -165°, enmarcados por INT1 e INT2.
const LA_FLORIDA_POLYGON = [
  round(INT1),    // 45° (límite NE compartido)
  pt(F, 25),
  pt(F, 5),
  pt(F, -15),
  pt(F, -35),
  pt(F, -55),
  pt(F, -75),
  pt(F, -90),     // sur
  pt(F, -105),
  pt(F, -120),
  pt(F, -135),
  pt(F, -150),
  pt(F, -165),
  round(INT2),    // 177° (límite SO compartido)
  // cierre recto → INT1 = borde compartido con Recoleta
];

console.log("INT1:", INT1);
console.log("INT2:", INT2);
console.log("Distancia entre centros:", dist.toFixed(2), "km");
console.log("Recoleta puntos:", RECOLETA_POLYGON.length);
console.log("La Florida puntos:", LA_FLORIDA_POLYGON.length);

const RECOLETA_ID = "cmvcjbx090001jn074i0eg9zu";
const LA_FLORIDA_ID = "cmubc0yoq0001jv041si8zicn";

async function main() {
  const recol = await prisma.restaurant.findUnique({ where: { id: RECOLETA_ID }, select: { ecommerceDeliveryConfig: true } });
  const recolConfig = (recol?.ecommerceDeliveryConfig ?? {}) as Record<string, unknown>;
  await prisma.restaurant.update({
    where: { id: RECOLETA_ID },
    data: { ecommerceDeliveryConfig: { ...recolConfig, polygonIncluded: RECOLETA_POLYGON, polygonExcluded: [] } as unknown as object },
  });
  console.log("✅ Recoleta actualizado");

  const flor = await prisma.restaurant.findUnique({ where: { id: LA_FLORIDA_ID }, select: { ecommerceDeliveryConfig: true } });
  const florConfig = (flor?.ecommerceDeliveryConfig ?? {}) as Record<string, unknown>;
  await prisma.restaurant.update({
    where: { id: LA_FLORIDA_ID },
    data: { ecommerceDeliveryConfig: { ...florConfig, polygonIncluded: LA_FLORIDA_POLYGON, polygonExcluded: [] } as unknown as object },
  });
  console.log("✅ La Florida actualizado");
}

main().catch(console.error).finally(() => prisma.$disconnect());
