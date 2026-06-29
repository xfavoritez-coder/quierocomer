import { Metadata } from "next";
import SubirCartaClient from "./SubirCartaClient";

// Cached (ISR) — no more force-dynamic A/B queries
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Subir mi carta · QuieroComer",
  description: "Sube tu carta física, PDF o link QR y nuestra IA la transforma en una Carta Viva.",
};

// A/B winners hardcoded — experiment concluded
const AB_WINNERS = {
  titleId: null,
  titleText: "Sube tu carta y mira cómo queda",
  ctaId: null,
  ctaText: "Comenzar →",
};

export default async function SubirCartaPage() {
  return <SubirCartaClient serverAb={AB_WINNERS} />;
}
