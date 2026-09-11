"use client";
// ═══════════════════════════════════════════════════════════
//  Estilos del storefront del Ecommerce.
//  quierocomer tiene un reset global `* { margin:0; padding:0 }` SIN @layer,
//  y en Tailwind v4 las utilidades van en @layer (que pierde ante lo no-capado).
//  Resultado: p-*/px-*/m-* de Tailwind quedan anuladas dentro del storefront.
//  Aquí re-declaramos ese spacing con MAYOR especificidad (.qc-storefront .clase),
//  sin capa, scoped al storefront — sin tocar el reset global de la app.
// ═══════════════════════════════════════════════════════════

const SCALE: Record<string, string> = {
  "0.5": "0.125rem", "1": "0.25rem", "1.5": "0.375rem", "2": "0.5rem",
  "2.5": "0.625rem", "3": "0.75rem", "3.5": "0.875rem", "4": "1rem",
  "5": "1.25rem", "6": "1.5rem", "8": "2rem", "10": "2.5rem", "12": "3rem", "16": "4rem",
};

function genSpacingCss(): string {
  let css = "";
  for (const [k, v] of Object.entries(SCALE)) {
    const c = k.replace(".", "\\."); // escapar el punto en el selector CSS
    css += `.qc-storefront .p-${c}{padding:${v}}`;
    css += `.qc-storefront .px-${c}{padding-left:${v};padding-right:${v}}`;
    css += `.qc-storefront .py-${c}{padding-top:${v};padding-bottom:${v}}`;
    css += `.qc-storefront .pt-${c}{padding-top:${v}}`;
    css += `.qc-storefront .pb-${c}{padding-bottom:${v}}`;
    css += `.qc-storefront .pl-${c}{padding-left:${v}}`;
    css += `.qc-storefront .pr-${c}{padding-right:${v}}`;
    css += `.qc-storefront .m-${c}{margin:${v}}`;
    css += `.qc-storefront .mx-${c}{margin-left:${v};margin-right:${v}}`;
    css += `.qc-storefront .my-${c}{margin-top:${v};margin-bottom:${v}}`;
    css += `.qc-storefront .mt-${c}{margin-top:${v}}`;
    css += `.qc-storefront .mb-${c}{margin-bottom:${v}}`;
    css += `.qc-storefront .ml-${c}{margin-left:${v}}`;
    css += `.qc-storefront .mr-${c}{margin-right:${v}}`;
  }
  css += `.qc-storefront .mx-auto{margin-left:auto;margin-right:auto}`;
  // Evitar el "mini zoom" de iOS al enfocar un campo: iOS hace zoom si el
  // font-size del control es < 16px. En dispositivos táctiles forzamos 16px
  // en TODOS los inputs/textarea/select del storefront (dirección, notas,
  // búsqueda, código, etc.), sin tocar el layout de escritorio.
  css += `@media (pointer: coarse){.qc-storefront input:not([type=checkbox]):not([type=radio]):not([type=range]),.qc-storefront textarea,.qc-storefront select{font-size:16px !important}}`;
  // Ocultar scrollbar de la barra de categorías (webkit)
  css += `.qc-storefront .no-scrollbar::-webkit-scrollbar{display:none}`;
  // Animación del carrito (bump) al agregar
  css += `@keyframes qc-cart-bump{0%{transform:scale(1)}30%{transform:scale(1.12)}100%{transform:scale(1)}}`;
  css += `.qc-storefront .cart-bump{animation:qc-cart-bump .45s ease}`;
  // ── Animaciones de overlays (entrada + salida) ──────────────────
  const EASE = "cubic-bezier(.32,.72,0,1)";
  // Bottom sheet: sube al abrir, baja (regresa hacia su icono) al cerrar
  css += `@keyframes qc-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`;
  css += `@keyframes qc-sheet-down{from{transform:translateY(0)}to{transform:translateY(100%)}}`;
  css += `.qc-storefront .qc-sheet-in{animation:qc-sheet-up .3s ${EASE}}`;
  css += `.qc-storefront .qc-sheet-out{animation:qc-sheet-down .26s ${EASE} forwards}`;
  // Backdrop: fade
  css += `@keyframes qc-fade-in{from{opacity:0}to{opacity:1}}`;
  css += `@keyframes qc-fade-out{from{opacity:1}to{opacity:0}}`;
  css += `.qc-storefront .qc-fade-in{animation:qc-fade-in .25s ease}`;
  css += `.qc-storefront .qc-fade-out{animation:qc-fade-out .25s ease forwards}`;
  // Drawer lateral (tema impact / desktop): entra/sale por su costado
  css += `@keyframes qc-dl-in{from{transform:translateX(-100%)}to{transform:translateX(0)}}`;
  css += `@keyframes qc-dl-out{from{transform:translateX(0)}to{transform:translateX(-100%)}}`;
  css += `@keyframes qc-dr-in{from{transform:translateX(100%)}to{transform:translateX(0)}}`;
  css += `@keyframes qc-dr-out{from{transform:translateX(0)}to{transform:translateX(100%)}}`;
  css += `.qc-storefront .qc-drawer-left-in{animation:qc-dl-in .3s ${EASE}}`;
  css += `.qc-storefront .qc-drawer-left-out{animation:qc-dl-out .26s ${EASE} forwards}`;
  css += `.qc-storefront .qc-drawer-right-in{animation:qc-dr-in .3s ${EASE}}`;
  css += `.qc-storefront .qc-drawer-right-out{animation:qc-dr-out .26s ${EASE} forwards}`;
  // Modal de producto/entrega: en móvil sube desde abajo; en desktop hace "pop"
  css += `@keyframes qc-pop-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`;
  css += `@keyframes qc-pop-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.95)}}`;
  css += `.qc-storefront .qc-modal-in{animation:qc-sheet-up .3s ${EASE}}`;
  css += `.qc-storefront .qc-modal-out{animation:qc-sheet-down .26s ${EASE} forwards}`;
  css += `@media(min-width:640px){.qc-storefront .qc-modal-in{animation:qc-pop-in .2s ease}.qc-storefront .qc-modal-out{animation:qc-pop-out .18s ease forwards}}`;
  // Respeta la preferencia de menos movimiento
  css += `@media(prefers-reduced-motion:reduce){.qc-storefront .qc-sheet-in,.qc-storefront .qc-sheet-out,.qc-storefront .qc-fade-in,.qc-storefront .qc-fade-out,.qc-storefront .qc-drawer-left-in,.qc-storefront .qc-drawer-left-out,.qc-storefront .qc-drawer-right-in,.qc-storefront .qc-drawer-right-out,.qc-storefront .qc-modal-in,.qc-storefront .qc-modal-out{animation-duration:.01ms}}`;
  return css;
}

export default function StoreStyles() {
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" />
      <style dangerouslySetInnerHTML={{ __html: genSpacingCss() }} />
    </>
  );
}
