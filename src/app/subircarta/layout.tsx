import type { Viewport } from "next";
import ScrollToTop from "./ScrollToTop";

const clarityScript = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","ykbsgbbc68");`;

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function SubirCartaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <script dangerouslySetInnerHTML={{ __html: clarityScript }} />
      <style dangerouslySetInnerHTML={{ __html: `html, body { background: #fff !important; color: #111 !important; overflow-x: hidden !important; }` }} />
      <ScrollToTop />
      {children}
    </div>
  );
}
