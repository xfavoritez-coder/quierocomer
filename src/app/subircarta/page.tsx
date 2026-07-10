import { Metadata } from "next";
import SubirCartaClient from "./SubirCartaClient";

// Cached (ISR) — no more force-dynamic A/B queries
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

// A/B winners hardcoded — experiment concluded
const AB_WINNERS = {
  titleId: null,
  titleText: "Tu carta, pero {inteligente}",
  ctaId: null,
  ctaText: "Subir mi carta →",
};

export default async function SubirCartaPage() {
  return <SubirCartaClient serverAb={AB_WINNERS} />;
}
