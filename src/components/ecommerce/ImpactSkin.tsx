"use client";
// ═══════════════════════════════════════════════════════════
//  "Skin" oscuro del tema Impact: remapea las clases claras de
//  Tailwind que usan los sub-componentes de flujo (CartDrawer,
//  ProductModal, DeliveryModal, CustomerMenu, CheckoutForm) a la
//  paleta oscura, sin tener que reescribir cada componente.
//  Se activa envolviendo el árbol en un contenedor con class "qc-impact".
// ═══════════════════════════════════════════════════════════
export default function ImpactSkin() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

const CSS = `
.qc-impact{color:#f0f0f0}
.qc-impact .bg-white{background:#1a1a1a !important}
.qc-impact .bg-gray-50{background:#151515 !important}
.qc-impact .bg-gray-100{background:#242424 !important}
.qc-impact .bg-gray-200{background:#2e2e2e !important}
.qc-impact .bg-gray-900{background:#000 !important}
.qc-impact .hover\\:bg-gray-50:hover{background:#222 !important}
.qc-impact .hover\\:bg-gray-100:hover{background:#2a2a2a !important}
.qc-impact .text-gray-900{color:#f5f5f5 !important}
.qc-impact .text-gray-800{color:#ededed !important}
.qc-impact .text-gray-700{color:#d5d5d5 !important}
.qc-impact .text-gray-600{color:#b5b5b5 !important}
.qc-impact .text-gray-500{color:#9a9a9a !important}
.qc-impact .text-gray-400{color:#7c7c7c !important}
.qc-impact .text-gray-300{color:#5a5a5a !important}
.qc-impact .border-gray-50,
.qc-impact .border-gray-100{border-color:#262626 !important}
.qc-impact .border-gray-200{border-color:#333 !important}
.qc-impact .divide-gray-100 > * + *{border-color:#262626 !important}
.qc-impact .divide-gray-200 > * + *{border-color:#333 !important}
.qc-impact input:not([type=checkbox]):not([type=radio]),
.qc-impact textarea,
.qc-impact select{background:#222 !important;color:#f0f0f0 !important;border-color:#333 !important}
.qc-impact input::placeholder,
.qc-impact textarea::placeholder{color:#777 !important}
.qc-impact .bg-green-50{background:rgba(34,197,94,0.14) !important}
.qc-impact .text-green-600,.qc-impact .text-green-700{color:#4ade80 !important}
.qc-impact .border-green-400{border-color:rgba(34,197,94,0.5) !important}
.qc-impact .bg-red-50{background:rgba(239,68,68,0.14) !important}
.qc-impact .border-red-200{border-color:rgba(239,68,68,0.4) !important}
.qc-impact .text-red-700{color:#f87171 !important}
.qc-impact .shadow-sm,.qc-impact .shadow,.qc-impact .shadow-md,.qc-impact .shadow-lg,.qc-impact .shadow-xl,.qc-impact .shadow-2xl{box-shadow:0 8px 30px rgba(0,0,0,0.5) !important}
/* Botón cerrar (X) 100% liquid glass */
.qc-impact .qc-glass-x{
  background:rgba(255,255,255,0.07) !important;
  -webkit-backdrop-filter:blur(14px) saturate(185%) brightness(1.08);
  backdrop-filter:blur(14px) saturate(185%) brightness(1.08);
  border:1px solid rgba(255,255,255,0.16) !important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.32), 0 6px 18px rgba(0,0,0,0.35) !important;
}
.qc-impact .qc-glass-x svg{color:#fff !important}
`;
