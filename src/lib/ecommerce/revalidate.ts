import { revalidateTag } from "next/cache";

/**
 * Invalida el catálogo cacheado del storefront de ecommerce de un restaurante.
 * Llamar después de cualquier mutación que afecte el MENÚ o la config de la tienda
 * (platos, categorías, modificadores, ofertas, colores, delivery, horarios…).
 * La disponibilidad/precio por horario y los agotados NO necesitan esto: se
 * recalculan frescos en cada request (loadEcommerceLive).
 *
 * El catálogo se cachea taggeado por id Y por slug, así que se puede invalidar por
 * cualquiera de los dos. revalidateQrCache(slug) ya lo invalida por slug (el mismo
 * hook que corre al editar el menú); estas funciones sirven para los endpoints de
 * ecommerce (config de tienda) que no pasan por revalidateQrCache.
 */
export function revalidateEcommerceCache(opts?: { id?: string | null; slug?: string | null }) {
  // { expire: 0 } = expiración inmediata: la siguiente visita recarga desde la BD.
  // "max" usaría stale-while-revalidate (sirve viejo mientras carga en background).
  revalidateTag("ecom-storefront", { expire: 0 });
  if (opts?.id) revalidateTag(`ecom-storefront-id-${opts.id}`, { expire: 0 });
  if (opts?.slug) revalidateTag(`ecom-storefront-slug-${opts.slug}`, { expire: 0 });
}
