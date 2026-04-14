import type { Metadata } from "next";
import { Cinzel_Decorative, Cinzel, Lato } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";

const cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cinzel-decorative",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-cinzel",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://quierocomer.cl"),
  title: "QuieroComer — Dime qué quieres. El Genio se encarga.",
  description: "Descubre qué comer hoy. El Genio aprende tus gustos y te recomienda el plato perfecto.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "QuieroComer — Dime qué quieres. El Genio se encarga. 🧞",
    description: "Descubre qué comer hoy. El Genio aprende tus gustos y te recomienda el plato perfecto.",
    url: "https://quierocomer.cl",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){
          var s=document.documentElement.style;
          s.setProperty("--bg-primary","#0a0812");s.setProperty("--bg-secondary","#080d18");
          s.setProperty("--text-primary","#f0ead6");s.setProperty("--text-muted","rgba(240,234,214,0.65)");
          s.setProperty("--accent","#e8a84c");s.setProperty("--border-color","rgba(232,168,76,0.22)");
          s.setProperty("--color-title","#f5d080");s.setProperty("--color-link","#3db89e");
        })()` }} />
      </head>
      <body className={`${cinzelDecorative.variable} ${cinzel.variable} ${lato.variable}`} suppressHydrationWarning>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
