import type { AnchorHTMLAttributes } from "react";

/**
 * Enlace de navegación ENTRE PÁGINAS del storefront del ecommerce (tienda ↔ checkout ↔
 * seguimiento). Usa navegación COMPLETA (un simple <a>), NO el <Link> de Next ni
 * router.push/replace/back.
 *
 * ¿Por qué? En dominios propios (ej: haruna.cl) el middleware reescribe la URL
 * (`/checkout` → interno `/ecommerce/<host>/checkout`). La navegación SPA de Next se
 * confunde con esa reescritura y la transición queda a medias hasta refrescar. Un <a href>
 * siempre funciona porque hace una carga real que pasa por el servidor + middleware.
 *
 * REGLA: para ir a OTRA página dentro de la tienda usa SIEMPRE StoreLink (o window.location),
 * nunca <Link>/router.push. Para interacciones dentro de la misma página (modales, tabs,
 * scroll) da igual, esto no aplica.
 */
export default function StoreLink({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props}>{children}</a>;
}
