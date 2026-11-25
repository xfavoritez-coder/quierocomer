import type { Metadata } from "next";
import "./ventas.css";

export const metadata: Metadata = {
  title: "QuieroComer Ventas",
  robots: { index: false, follow: false },
};

export default function VentasRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ventas-root">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`}</style>
      {children}
    </div>
  );
}
