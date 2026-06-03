"use client";

import { useState, useEffect } from "react";

interface Props {
  restaurantSlug: string;
  restaurantName: string;
}

export default function DemoFirstViewModal({ restaurantSlug, restaurantName }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const key = `qc_first_view_${restaurantSlug}`;
    if (!localStorage.getItem(key)) {
      setShow(true);
      localStorage.setItem(key, "1");
    }
  }, [restaurantSlug]);

  if (!show) return null;

  return (
    <div
      onClick={() => setShow(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: 20,
        animation: "demoFirstFadeIn 0.3s ease-out",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes demoFirstFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes demoFirstSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#151210",
          border: "1px solid rgba(232,163,61,0.18)",
          borderRadius: 20,
          padding: "32px 26px 26px",
          maxWidth: 340,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          animation: "demoFirstSlideUp 0.4s ease-out",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 10, lineHeight: 1 }}>⚡</div>

        <h3 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 28,
          fontWeight: 600,
          color: "#F2E5CF",
          marginBottom: 14,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}>
          Importante sobre tu carta
        </h3>

        <p style={{
          fontSize: 16,
          color: "#CDBB9D",
          lineHeight: 1.6,
          margin: "0 0 26px",
        }}>
          Es posible que algunos precios, nombres o secciones no se hayan importado exactamente. Desde tu panel puedes corregir cualquier dato y subir tus fotos de forma simple, facil y rapida.
        </p>

        <button
          onClick={() => setShow(false)}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 14,
            border: "none",
            background: "#E8A33D",
            color: "#0e0e0e",
            fontSize: 16,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Revisar mi carta
        </button>
      </div>
    </div>
  );
}
