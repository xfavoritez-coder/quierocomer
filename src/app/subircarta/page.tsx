import { Metadata } from "next";
import SubirCartaClient from "./SubirCartaClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Crear carta QR para mi restaurante gratis | QuieroComer",
  description: "Sube tu carta física, PDF o link y en minutos tendrás tu carta QR digital con fotos, filtros y recomendaciones IA. Gratis para siempre.",
  openGraph: {
    title: "Crear carta QR para mi restaurante gratis | QuieroComer",
    description: "Sube tu carta física, PDF o link y en minutos tendrás tu carta QR digital con fotos, filtros y recomendaciones IA. Gratis para siempre.",
    url: "https://quierocomer.com/subircarta",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
  },
};

export default async function SubirCartaPage() {
  return <SubirCartaClient />;
}
