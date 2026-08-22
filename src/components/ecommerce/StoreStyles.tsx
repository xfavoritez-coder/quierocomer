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
  // Ocultar scrollbar de la barra de categorías (webkit)
  css += `.qc-storefront .no-scrollbar::-webkit-scrollbar{display:none}`;
  // Animación del carrito (bump) al agregar
  css += `@keyframes qc-cart-bump{0%{transform:scale(1)}30%{transform:scale(1.12)}100%{transform:scale(1)}}`;
  css += `.qc-storefront .cart-bump{animation:qc-cart-bump .45s ease}`;
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
