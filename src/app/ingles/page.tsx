"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStats } from "@/lib/english-srs";

type Stats = { totalCards: number; mature: number; due: number; streak: number };

export default function EnglishDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getStats().then(setStats);
  }, []);

  const due = stats?.due ?? 0;
  const hasSession = due > 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", gap: "32px" }}>

      {/* Logo / header */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--en-accent) 0%, #8b5cf6 100%)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32
        }}>
          🇺🇸
        </div>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", margin: 0 }}>English Practice</h1>
          <p style={{ color: "var(--en-text-2)", fontSize: 14, marginTop: 4 }}>Repaso espaciado · SM-2</p>
        </div>
      </div>

      {/* Stats */}
      {stats ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 360 }}>
          <StatTile
            icon="🔥"
            value={stats.streak > 0 ? String(stats.streak) : "–"}
            label="días seguidos"
            accent={stats.streak > 0 ? "gold" : undefined}
          />
          <StatTile
            icon="📋"
            value={String(due)}
            label="para hoy"
            accent={due > 0 ? "accent" : undefined}
          />
          <StatTile icon="🗂" value={String(stats.totalCards)} label="tarjetas" />
          <StatTile icon="✅" value={String(stats.mature)} label="dominadas" />
        </div>
      ) : (
        <div style={{ width: "100%", maxWidth: 360, height: 160, borderRadius: 18, background: "var(--en-surface)", opacity: 0.4 }} />
      )}

      {/* Actions */}
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
        {hasSession ? (
          <Link href="/ingles/session" style={{
            display: "block", textAlign: "center", textDecoration: "none",
            background: "linear-gradient(135deg, var(--en-accent) 0%, #8b5cf6 100%)",
            color: "#fff", borderRadius: 16, padding: "16px 24px",
            fontWeight: 800, fontSize: 16, letterSpacing: "0.2px",
            boxShadow: "0 8px 32px rgba(99,102,241,0.35)"
          }}>
            ▶ Empezar sesión · {due} {due === 1 ? "tarjeta" : "tarjetas"}
          </Link>
        ) : (
          <div style={{
            textAlign: "center", borderRadius: 16, padding: "16px 24px",
            background: "var(--en-surface)", color: "var(--en-text-2)", fontWeight: 600
          }}>
            {stats === null ? "Cargando..." : "Listo por hoy ✓"}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Link href="/ingles/add" style={{
            display: "block", textAlign: "center", textDecoration: "none",
            background: "var(--en-surface)", color: "var(--en-text)",
            borderRadius: 14, padding: "12px 16px",
            fontWeight: 600, fontSize: 14,
            border: "1px solid var(--en-border)"
          }}>
            + Agregar tarjeta
          </Link>
          <Link href="/ingles/cards" style={{
            display: "block", textAlign: "center", textDecoration: "none",
            background: "var(--en-surface)", color: "var(--en-text)",
            borderRadius: 14, padding: "12px 16px",
            fontWeight: 600, fontSize: 14,
            border: "1px solid var(--en-border)"
          }}>
            📚 Ver todas
          </Link>
        </div>
      </div>

      {stats && stats.totalCards === 0 && (
        <p style={{ color: "var(--en-text-2)", fontSize: 14, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
          Todavía no tenés tarjetas. Agregá la primera para empezar.
        </p>
      )}
    </div>
  );
}

function StatTile({ icon, value, label, accent }: { icon: string; value: string; label: string; accent?: "gold" | "accent" }) {
  const bg = accent === "gold" ? "var(--en-gold-dim)" : accent === "accent" ? "rgba(99,102,241,0.12)" : "var(--en-surface)";
  const valueColor = accent === "gold" ? "var(--en-gold)" : accent === "accent" ? "var(--en-accent-hover)" : "var(--en-text)";

  return (
    <div style={{
      background: bg,
      border: "1px solid var(--en-border)",
      borderRadius: 18,
      padding: "18px 16px",
      display: "flex", flexDirection: "column", gap: 4
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color: valueColor, letterSpacing: "-0.5px" }}>{value}</span>
      <span style={{ fontSize: 12, color: "var(--en-text-2)" }}>{label}</span>
    </div>
  );
}
