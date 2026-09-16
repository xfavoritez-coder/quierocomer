import type { Metadata } from "next";
import PreciosClient from "./PreciosClient";

export const metadata: Metadata = {
  title: "Precios · QuieroComer",
  description: "Planes simples para tu restaurante. Empieza gratis, sube cuando quieras.",
};

export default function PreciosPage() {
  return <PreciosClient />;
}
