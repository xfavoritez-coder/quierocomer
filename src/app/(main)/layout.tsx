import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import GenieShell from "@/components/GenieShell";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "QuieroComer — Dime qué quieres. El Genio se encarga.",
  description: "Descubre qué comer hoy. El Genio aprende tus gustos y te recomienda el plato perfecto.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "QuieroComer — Dime qué quieres. El Genio se encarga.",
    description: "Descubre qué comer hoy. El Genio aprende tus gustos y te recomienda el plato perfecto.",
    url: "https://quierocomer.cl",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
  },
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <ErrorBoundary>
        <AuthProvider>
          <GenieShell>
            {children}
          </GenieShell>
        </AuthProvider>
      </ErrorBoundary>
    </div>
  );
}
