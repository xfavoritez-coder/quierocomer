"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";

interface DesktopWrapperProps {
  restaurantName: string;
  slug: string;
  children: React.ReactNode;
}

export default function DesktopWrapper({ restaurantName, slug, children }: DesktopWrapperProps) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    // Allow desktop preview via ?preview=true (for restaurant owners from panel)
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "true";
    if (isPreview) {
      setIsDesktop(false);
      return;
    }
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const url = `https://quierocomer.cl/qr/${slug}`;
    QRCode.toDataURL(url, { width: 400, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0e0e0e", light: "#ffffff" } })
      .then(setQrDataUrl).catch(() => {});
  }, [slug]);

  // Still checking — show nothing to avoid flash on either platform
  if (isDesktop === null) return <div style={{ minHeight: "100dvh", background: "#f7f7f5" }} />;
  // Mobile — render carta normally
  if (!isDesktop) return <>{children}</>;

  // Hide floating buttons on desktop
  const hideButtonsStyle = `
    .fixed { display: none !important; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: hideButtonsStyle }} />
      <div
        className="font-[family-name:var(--font-dm)]"
        style={{
        minHeight: "100dvh",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
        padding: "40px 60px",
      }}
    >
      {/* Left side — info */}
      <div style={{ maxWidth: 360, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
            </svg>
          </div>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", fontWeight: 500 }}>
            Carta QR Viva
          </span>
        </div>

        <h1
          className="font-[family-name:var(--font-playfair)]"
          style={{
            fontSize: "2.8rem",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          {restaurantName}
        </h1>

        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "1.05rem", lineHeight: 1.7, marginBottom: 32 }}>
          Esta carta está diseñada para verse en tu celular. Escanea el QR o abre el link desde tu teléfono.
        </p>

        {/* QR code */}
        {qrDataUrl && (
          <div style={{ background: "white", borderRadius: 16, padding: 16, width: 180, marginBottom: 24 }}>
            <img src={qrDataUrl} alt="QR" style={{ width: "100%", borderRadius: 8 }} />
          </div>
        )}

        <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.82rem" }}>
          quierocomer.cl/qr/{slug}
        </p>

        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.75rem" }}>Powered by</span>
          <span className="font-[family-name:var(--font-playfair)]" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.9rem", fontWeight: 700 }}>
            QuieroComer<span style={{ color: "#F4A623" }}>.cl</span>
          </span>
        </div>
      </div>

      {/* Right side — phone mockup */}
      <div
        style={{
          width: 375,
          height: 812,
          background: "#111",
          borderRadius: 50,
          padding: 12,
          boxShadow: "0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 28,
            background: "#111",
            borderRadius: "0 0 18px 18px",
            zIndex: 10,
          }}
        />

        {/* Screen */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 38,
            overflowX: "hidden",
            overflowY: "auto",
            background: "#f7f7f5",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {children}
        </div>
      </div>
    </div>
    </>
  );
}
