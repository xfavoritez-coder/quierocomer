import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Carta QR Viva — QuieroComer",
  description: "La carta digital inteligente que se adapta a ti.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function QRLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ '--font-playfair': '"Playfair Display", Georgia, serif', '--font-dm': '"DM Sans", system-ui, sans-serif', '--font-fraunces': '"Fraunces", Georgia, serif', '--font-bebas': '"Bebas Neue", Impact, sans-serif', background: "#0a0908", minHeight: "100vh" } as React.CSSProperties}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,200;0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Bebas+Neue&display=swap');`}</style>
      {children}
    </div>
  );
}
