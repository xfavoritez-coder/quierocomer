import type { Viewport } from "next";
import ScrollToTop from "./ScrollToTop";
import Script from "next/script";

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function SubirCartaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#090806", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: `html, body { background: #090806 !important; color: #F2E5CF !important; overflow-x: hidden !important; }` }} />
      <ScrollToTop />
      {children}
      <Script id="tawk-to" strategy="lazyOnload">{`
        var Tawk_API=Tawk_API||{};
        Tawk_API.onLoad = function(){ Tawk_API.hideWidget(); };
        var Tawk_LoadStart=new Date();
        (function(){
          var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
          s1.async=true;
          s1.src='https://embed.tawk.to/6a0c7aa00454421c389d6a22/1jp0bu0si';
          s1.charset='UTF-8';
          s1.setAttribute('crossorigin','*');
          s0.parentNode.insertBefore(s1,s0);
        })();
      `}</Script>
    </div>
  );
}
