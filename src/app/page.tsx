import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "QuieroComer — Carta digital QR y fidelización para restaurantes",
  description:
    "Crea tu carta digital con fotos, programa de sellos y pedidos online. Sin app, sin contratos. Úsalo desde el primer día. Prueba gratis 7 días.",
  keywords: [
    "carta digital restaurante",
    "carta QR restaurante Chile",
    "menú digital con fotos",
    "programa fidelización restaurante",
    "pedidos online restaurante",
    "software restaurante Chile",
    "QuieroComer",
  ],
  openGraph: {
    title: "QuieroComer — Carta digital QR y fidelización para restaurantes",
    description:
      "Carta digital con fotos, programa de sellos y pedidos online para tu restaurante. Sin app, sin contratos. Prueba gratis 7 días.",
    url: "https://quierocomer.com",
    siteName: "QuieroComer",
    images: [
      {
        url: "https://quierocomer.com/og.png",
        width: 1200,
        height: 630,
        alt: "QuieroComer — Carta digital y fidelización para restaurantes",
      },
    ],
    locale: "es_CL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "QuieroComer — Carta digital QR y fidelización para restaurantes",
    description:
      "Carta digital con fotos, programa de sellos y pedidos online. Sin app, sin contratos.",
    images: ["https://quierocomer.com/og.png"],
  },
  alternates: {
    canonical: "https://quierocomer.com",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
