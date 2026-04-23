"use client";

import { useState, useEffect } from "react";

interface DesktopWrapperProps {
  restaurantName: string;
  slug: string;
  children: React.ReactNode;
}

export default function DesktopWrapper({ restaurantName, slug, children }: DesktopWrapperProps) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isDesktop === null) return <div style={{ minHeight: "100dvh", background: "#f7f7f5" }} />;

  // Mobile: render as-is
  if (!isDesktop) return <>{children}</>;

  // Desktop: centered layout with adapted styles
  return (
    <div className="qr-desktop-wrap">
      {children}
      <style>{`
        .qr-desktop-wrap {
          max-width: 900px;
          margin: 0 auto;
          min-height: 100dvh;
          background: #f7f7f5;
          box-shadow: 0 0 60px rgba(0,0,0,0.06);
        }

        /* Category nav: wrap instead of horizontal scroll */
        .qr-desktop-wrap nav.sticky .flex.overflow-x-auto,
        .qr-desktop-wrap .sticky.top-0 .flex.overflow-x-auto {
          flex-wrap: wrap !important;
          overflow-x: visible !important;
          gap: 4px 20px;
          padding-top: 4px;
          padding-bottom: 4px;
        }
        .qr-desktop-wrap nav.sticky,
        .qr-desktop-wrap .sticky.top-0 {
          height: auto !important;
          min-height: 44px;
        }

        /* CartaPremium: convert horizontal scroll to wrapping grid */
        .qr-desktop-wrap [data-scroll-container] {
          flex-wrap: wrap !important;
          overflow-x: visible !important;
          scroll-snap-type: none !important;
          padding: 0 20px 8px !important;
          gap: 12px;
        }
        .qr-desktop-wrap [data-scroll-container] > div {
          scroll-snap-align: unset !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
        /* Hide scroll fade arrows on desktop */
        .qr-desktop-wrap [data-scroll-container] + div {
          display: none !important;
        }

        /* CartaLista: 2-column grid for dish cards */
        .qr-desktop-wrap section > div[style*="flex-direction: column"] {
          display: grid !important;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        /* Genio nudge: centered */
        .qr-desktop-wrap div[style*="margin: 55px"] {
          max-width: 600px;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        /* Fixed buttons: position relative to container */
        .qr-desktop-wrap .fixed.z-50 {
          position: fixed;
          right: calc(50% - 450px + 12px);
        }

        /* Footer */
        .qr-desktop-wrap footer {
          padding-bottom: 40px !important;
        }
      `}</style>
    </div>
  );
}
