import type { Metadata } from "next";
import PlanesClient from "./PlanesClient";

export const metadata: Metadata = {
  title: "Planes | QuieroComer",
  description: "Elige el plan que mejor se adapte a tu restaurante. Desde gratis hasta Premium.",
};

export default function PlanesPage() {
  return <PlanesClient />;
}
