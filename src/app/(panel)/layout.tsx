import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { Toaster } from "sonner";

export const metadata: Metadata = { title: "Panel · QuieroComer" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

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

export default function PanelRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${spaceGrotesk.variable} ${inter.variable} theme-dark`}>
      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          var t=localStorage.getItem('qc_panel_theme');
          if(t==='light'){document.currentScript.parentElement.classList.remove('theme-dark');document.currentScript.parentElement.classList.add('theme-light');}
        })();
      `}} />
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: { fontFamily: "var(--font-display), system-ui, sans-serif", fontSize: "0.85rem" },
        }}
      />
    </div>
  );
}
