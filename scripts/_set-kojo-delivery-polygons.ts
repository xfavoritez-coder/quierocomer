/**
 * Establece los polígonos de delivery de Kojo Recoleta y Kojo La Florida
 * para que coincidan con las zonas del mapa de referencia.
 */
import { prisma } from "@/lib/prisma";
import { revalidateEcommerceCache } from "@/lib/ecommerce/revalidate";

// ── Zona azul (Recoleta) ────────────────────────────────────────────────────
// Cubre desde Quilicura/Huechuraba al norte hasta Cerrillos al sur,
// desde Pudahuel al oeste hasta Las Condes al este.
const RECOLETA_POLYGON = [
  { lat: -33.340, lng: -70.645 }, // Norte (Huechuraba N)
  { lat: -33.355, lng: -70.565 }, // Noreste
  { lat: -33.390, lng: -70.528 }, // Este norte (Barrio Golf)
  { lat: -33.430, lng: -70.520 }, // Este
  { lat: -33.468, lng: -70.545 }, // Sureste
  { lat: -33.500, lng: -70.590 }, // Sur-sureste
  { lat: -33.520, lng: -70.655 }, // Sur (Cerrillos)
  { lat: -33.505, lng: -70.725 }, // Sur-suroeste
  { lat: -33.465, lng: -70.770 }, // Oeste (Pudahuel)
  { lat: -33.412, lng: -70.782 }, // Oeste
  { lat: -33.362, lng: -70.752 }, // Noroeste (Quilicura)
  { lat: -33.340, lng: -70.700 }, // Norte-noroeste
];

// ── Zona amarilla (La Florida) ──────────────────────────────────────────────
// Cubre desde Lo Hermida al norte hasta Puente Alto al sur,
// desde El Bosque/La Pintana al oeste hasta Las Pircas al este.
const LA_FLORIDA_POLYGON = [
  { lat: -33.478, lng: -70.600 }, // Norte (Lo Hermida)
  { lat: -33.490, lng: -70.548 }, // Noreste
  { lat: -33.520, lng: -70.520 }, // Este-noreste
  { lat: -33.558, lng: -70.518 }, // Este (Las Pircas)
  { lat: -33.590, lng: -70.543 }, // Sur-sureste
  { lat: -33.622, lng: -70.578 }, // Sur (Puente Alto N)
  { lat: -33.618, lng: -70.625 }, // Sur-suroeste
  { lat: -33.585, lng: -70.665 }, // Suroeste (La Pintana)
  { lat: -33.540, lng: -70.675 }, // Oeste (El Bosque)
  { lat: -33.504, lng: -70.652 }, // Noroeste
  { lat: -33.482, lng: -70.620 }, // Norte-noroeste
];

const RECOLETA_ID = "cmvcjbx090001jn074i0eg9zu";
const LA_FLORIDA_ID = "cmubc0yoq0001jv041si8zicn";

async function main() {
  // Recoleta
  const recol = await prisma.restaurant.findUnique({
    where: { id: RECOLETA_ID },
    select: { ecommerceDeliveryConfig: true },
  });
  const recolConfig = (recol?.ecommerceDeliveryConfig ?? {}) as Record<string, unknown>;
  await prisma.restaurant.update({
    where: { id: RECOLETA_ID },
    data: {
      ecommerceDeliveryConfig: {
        ...recolConfig,
        polygonIncluded: RECOLETA_POLYGON,
        polygonExcluded: [],
      } as unknown as object,
    },
  });
  console.log("✅ Recoleta actualizado");

  // La Florida
  const flor = await prisma.restaurant.findUnique({
    where: { id: LA_FLORIDA_ID },
    select: { ecommerceDeliveryConfig: true },
  });
  const florConfig = (flor?.ecommerceDeliveryConfig ?? {}) as Record<string, unknown>;
  await prisma.restaurant.update({
    where: { id: LA_FLORIDA_ID },
    data: {
      ecommerceDeliveryConfig: {
        ...florConfig,
        polygonIncluded: LA_FLORIDA_POLYGON,
        polygonExcluded: [],
      } as unknown as object,
    },
  });
  console.log("✅ La Florida actualizado");

  revalidateEcommerceCache({ id: RECOLETA_ID });
  revalidateEcommerceCache({ id: LA_FLORIDA_ID });
  console.log("🔄 Cache invalidado");
}

main().catch(console.error).finally(() => prisma.$disconnect());
