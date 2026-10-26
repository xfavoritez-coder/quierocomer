import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import MetaPixel from "@/components/MetaPixel";

export const metadata: Metadata = {
  metadataBase: new URL("https://quierocomer.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="alternate" hrefLang="es" href="https://quierocomer.com" />
        <link rel="alternate" hrefLang="es-CL" href="https://quierocomer.com" />
        <link rel="alternate" hrefLang="x-default" href="https://quierocomer.com" />
        <link rel="preconnect" href="https://awbeyxfqtrdfhengabmw.supabase.co" />
        <link rel="preconnect" href="https://cdn.bistrify.app" />
        <link rel="dns-prefetch" href="https://cdn.mer-cat.com" />
        {/* Bloquea el render hasta leer el tema guardado — evita flash al recargar */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('qc_theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-GRX2MV6SDD" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-GRX2MV6SDD');
        `}</Script>
        {/* Meta Pixel: solo en quierocomer.com (marketing); NO en las tiendas de los locales. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(c,l,a,r,i,t,y){var x=['alleria-pizza','alleria-delivery','hand-roll','horusvegan','el-menu-de-la-esquina','guffsushi','nascosto-pizzeria','la-oveja-negra-restaurante','cuartel-50-restaurante'];if(x.indexOf(window.location.pathname.split('/')[1])!==-1)return;c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","ykbsgbbc68");` }} />
      </head>
      <body>
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
