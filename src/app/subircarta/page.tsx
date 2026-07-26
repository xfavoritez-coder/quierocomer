import { Metadata } from "next";
import { headers } from "next/headers";
import SubirCartaClient from "./SubirCartaClient";

export const dynamic = "force-dynamic"; // necesario para leer x-vercel-ip-country

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
  const h = await headers();
  // Vercel inyecta el país del visitante en este header automáticamente
  const ipCountry = h.get("x-vercel-ip-country") || null;
  const defaultCountry: "CL" | "US" = ipCountry === "US" ? "US" : "CL";
  return <SubirCartaClient defaultCountry={defaultCountry} />;
}
