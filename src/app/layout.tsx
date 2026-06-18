import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://quierocomer.cl"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
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
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '1532906358481871');
          fbq('track', 'PageView');
        `}</Script>
        <noscript><img height="1" width="1" style={{ display: "none" }} src="https://www.facebook.com/tr?id=1532906358481871&ev=PageView&noscript=1" /></noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
