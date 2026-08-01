import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Carta QR para restaurantes | QuieroComer",
  description:
    "Crea tu carta digital con fotos en minutos. Compártela por QR, WhatsApp o link. Sin impresiones, siempre actualizada. Prueba gratis 7 días.",
  keywords: [
    "carta digital restaurante",
    "carta QR",
    "menú digital",
    "carta online restaurante Chile",
    "menú QR Chile",
    "carta con fotos restaurante",
  ],
  openGraph: {
    title: "Carta QR inteligente para tu restaurante | QuieroComer",
    description:
      "Tu menú con fotos, categorías y precios siempre al día. Escanean el QR y ya. Empieza gratis hoy.",
    url: "https://quierocomer.com/carta",
    siteName: "QuieroComer",
    images: [
      {
        url: "https://quierocomer.com/og-carta.png",
        width: 1200,
        height: 630,
        alt: "Carta QR digital para restaurantes — QuieroComer",
      },
    ],
    locale: "es_CL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Carta QR inteligente para tu restaurante | QuieroComer",
    description:
      "Tu menú con fotos, categorías y precios siempre al día. Escanean el QR y ya.",
    images: ["https://quierocomer.com/og-carta.png"],
  },
  alternates: {
    canonical: "https://quierocomer.com/carta",
  },
};

export default function CartaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
