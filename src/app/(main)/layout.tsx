import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import GenieShell from "@/components/GenieShell";
import VisitorTrackerInit from "@/components/VisitorTrackerInit";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "QuieroComer | La carta QR inteligente que vende más por ti",
  description: "Descubre qué comer hoy. El Genio aprende tus gustos y te recomienda el plato perfecto.",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
  },
  openGraph: {
    title: "QuieroComer | La carta QR inteligente que vende más por ti",
    description: "Descubre qué comer hoy. El Genio aprende tus gustos y te recomienda el plato perfecto.",
    url: "https://quierocomer.com",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
    images: [{ url: "https://quierocomer.com/og-square.jpg", width: 400, height: 400 }],
  },
  twitter: {
    card: "summary",
    images: ["https://quierocomer.com/og-square.jpg"],
  },
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ '--font-display': '"Space Grotesk", system-ui, sans-serif', '--font-body': '"Inter", system-ui, sans-serif' } as React.CSSProperties}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');`}</style>
      <ErrorBoundary>
        <AuthProvider>
          <VisitorTrackerInit />
          <GenieShell>
            {children}
          </GenieShell>
          <Toaster
            position="bottom-center"
            toastOptions={{
              duration: 3000,
              style: { fontFamily: "var(--font-display), system-ui, sans-serif", fontSize: "0.85rem" },
            }}
          />
        </AuthProvider>
      </ErrorBoundary>
    </div>
  );
}
