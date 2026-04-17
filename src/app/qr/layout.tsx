import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, Fraunces } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-playfair",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Carta QR Viva — QuieroComer",
  description: "La carta digital inteligente que se adapta a ti.",
};

export default function QRLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${playfair.variable} ${dmSans.variable} ${fraunces.variable}`}>
      {children}
    </div>
  );
}
