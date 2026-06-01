import type { Metadata } from "next";
import FuncionesClient from "./FuncionesClient";

export const metadata: Metadata = {
  title: "QuieroComer | Funciones",
  description:
    "Tu carta QR también puede vender, atender y fidelizar. Descubre todas las funciones inteligentes de QuieroComer.",
  openGraph: {
    title: "QuieroComer | Funciones",
    description:
      "Tu carta QR también puede vender, atender y fidelizar. Descubre todas las funciones inteligentes de QuieroComer.",
    url: "https://quierocomer.cl/funciones",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
  },
};

export default function FuncionesPage() {
  return <FuncionesClient />;
}
