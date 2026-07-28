import type { Metadata } from "next";
import LoyaltyClient from "./LoyaltyClient";

export const metadata: Metadata = {
  title: "Loyalty · Tarjetas de fidelidad | QuieroComer",
  description:
    "Configura el programa de fidelización de tu restaurante: tarjetas de sellos que tus clientes guardan en Apple Wallet y Google Wallet.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Loyalty · Tarjetas de fidelidad | QuieroComer",
    description:
      "Configura el programa de fidelización de tu restaurante con tarjetas digitales en el wallet del teléfono.",
    url: "https://quierocomer.com/loyalty",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
  },
};

export default function LoyaltyPage() {
  return <LoyaltyClient />;
}
