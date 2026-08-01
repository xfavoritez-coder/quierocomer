import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Programa de fidelización digital para restaurantes | QuieroComer",
  description:
    "Tarjeta de sellos digital en Apple Wallet y Google Wallet. Sin papel, sin app. Notificaciones por cercanía y horario. Prueba gratis 7 días.",
  keywords: [
    "fidelización restaurante",
    "tarjeta de sellos digital",
    "loyalty restaurante Chile",
    "programa puntos restaurante",
    "wallet digital restaurante",
    "fidelización clientes gastronomía",
  ],
  openGraph: {
    title: "Programa de fidelización digital para tu restaurante | QuieroComer",
    description:
      "Tarjeta de sellos en Apple Wallet y Google Wallet. Tus clientes vuelven solos. Pruébalo 7 días gratis.",
    url: "https://quierocomer.com/fidelizacion",
    siteName: "QuieroComer",
    images: [
      {
        url: "https://quierocomer.com/og-loyalty.png",
        width: 1200,
        height: 630,
        alt: "Programa de fidelización digital — QuieroComer Loyalty",
      },
    ],
    locale: "es_CL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Programa de fidelización digital para tu restaurante | QuieroComer",
    description:
      "Tarjeta de sellos en Apple Wallet y Google Wallet. Tus clientes vuelven solos.",
    images: ["https://quierocomer.com/og-loyalty.png"],
  },
  alternates: {
    canonical: "https://quierocomer.com/fidelizacion",
  },
};

export default function FidelizacionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
