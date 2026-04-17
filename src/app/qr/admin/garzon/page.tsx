"use client";

import { useState } from "react";
import { Bell } from "lucide-react";

export default function GarzonSetup() {
  const [slug, setSlug] = useState("");

  const connect = () => {
    if (!slug.trim()) return;
    window.location.href = `/qr/admin/garzon/${slug.trim().toLowerCase()}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-[family-name:var(--font-dm)]" style={{ background: "#0e0e0e", color: "white", padding: 32 }}>
      <Bell size={40} color="#F4A623" />
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 16, marginBottom: 8 }}>Panel Garzón</h1>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", textAlign: "center", marginBottom: 24 }}>
        Escribe el nombre del local para conectarte
      </p>
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="ej: juana-la-brava"
        onKeyDown={(e) => e.key === "Enter" && connect()}
        style={{
          width: "100%",
          maxWidth: 300,
          padding: "14px 18px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(255,255,255,0.05)",
          color: "white",
          fontSize: "1.1rem",
          textAlign: "center",
          outline: "none",
        }}
      />
      <button
        onClick={connect}
        style={{
          marginTop: 16,
          width: "100%",
          maxWidth: 300,
          padding: "14px 0",
          borderRadius: 50,
          background: "#F4A623",
          color: "#0e0e0e",
          fontSize: "1rem",
          fontWeight: 700,
          border: "none",
        }}
      >
        Conectar
      </button>
    </div>
  );
}
