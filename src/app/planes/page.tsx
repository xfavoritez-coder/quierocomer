import type { Metadata } from "next";
import PlanesClient from "./PlanesClient";

export const metadata: Metadata = {
  title: "Planes y precios · Carta QR para restaurantes | QuieroComer",
  description: "Crea tu carta QR gratis y acepta pedidos online. Planes desde $0 hasta Premium con IA, fotos, análisis de ventas y más para tu restaurante.",
  openGraph: {
    title: "Planes y precios · Carta QR para restaurantes | QuieroComer",
    description: "Crea tu carta QR gratis y acepta pedidos online. Planes desde $0 hasta Premium con IA, fotos, análisis de ventas y más para tu restaurante.",
    url: "https://quierocomer.com/planes",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
  },
};

export default function PlanesPage() {
  return <PlanesClient />;
}
