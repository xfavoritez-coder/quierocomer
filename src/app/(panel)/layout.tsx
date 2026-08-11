import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = { title: "Panel · QuieroComer" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function PanelRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-light" style={{ '--font-display': '"Space Grotesk", system-ui, sans-serif', '--font-body': '"Inter", system-ui, sans-serif' } as React.CSSProperties}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');`}</style>
      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          var t=localStorage.getItem('qc_panel_theme');
          if(t==='dark'){document.currentScript.parentElement.classList.remove('theme-light');document.currentScript.parentElement.classList.add('theme-dark');}
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
