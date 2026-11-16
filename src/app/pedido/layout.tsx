// viewport-fit=cover habilita env(safe-area-inset-*) dentro de la app nativa
// (WebView de Capacitor). Sin esto los insets valen 0 y el paddingTop del
// seguimiento (/pedido/[orderId]) no tiene efecto → el contenido quedaba detrás
// de la hora/notch. La página es "use client" y no puede exportar viewport, por
// eso va en este layout (server component). Mismo patrón que /ecommerce/[slug].
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function PedidoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
