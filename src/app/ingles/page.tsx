"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStats } from "@/lib/english-srs";

type Stats = Awaited<ReturnType<typeof getStats>>;

export default function EnglishDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getStats().then(setStats);
  }, []);

  const hasSession = !stats?.doneToday && (stats?.due ?? 0) > 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", gap: 28 }}>

      {/* Header */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg, var(--en-accent) 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>
          🇺🇸
        </div>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", margin: 0 }}>English Practice</h1>
          {stats && (
            <p style={{ color: "var(--en-text-2)", fontSize: 13, marginTop: 4 }}>
              {stats.doneToday
                ? "✅ Sesión completada hoy"
                : "Practica todos los días para mantener la racha"}
            </p>
          )}
        </div>
      </div>

      {/* Racha + madurez */}
      {stats && (
        <div style={{
          width: "100%", maxWidth: 380,
          borderRadius: 18, padding: "14px 20px",
          background: stats.doneToday ? "var(--en-gold-dim)" : "var(--en-surface)",
          border: `1px solid ${stats.doneToday ? "var(--en-gold)" : "var(--en-border)"}`,
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "1px" }}>Racha</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: stats.streak > 0 ? "var(--en-gold)" : "var(--en-text-3)", margin: 0 }}>
              🔥 {stats.streak} {stats.streak === 1 ? "día" : "días"}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "1px" }}>Dominadas</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "var(--en-text-2)", margin: 0 }}>
              {stats.mature}/{stats.totalCards * 2}
            </p>
          </div>
        </div>
      )}

      {/* Módulo único */}
      <div style={{ width: "100%", maxWidth: 380, borderRadius: 22, overflow: "hidden", border: "1px solid var(--en-border)", background: "var(--en-surface)" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--en-border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🎯</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--en-text)" }}>Práctica diaria</p>
            <p style={{ fontSize: 12, color: "var(--en-text-3)", margin: 0 }}>Frases completas · EN↔ES · Pronunciación</p>
          </div>
          {stats?.doneToday && <span style={{ fontSize: 18 }}>✅</span>}
        </div>

        <div style={{ display: "flex", padding: "12px 20px", gap: 20 }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Racha</p>
            <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: (stats?.streak ?? 0) > 0 ? "var(--en-gold)" : "var(--en-text-3)" }}>
              🔥 {stats === null ? "–" : stats.streak}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Hoy</p>
            <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: (stats?.due ?? 0) > 0 ? "var(--en-accent)" : "var(--en-text-3)" }}>
              {stats === null ? "–" : stats.doneToday ? "✓" : `${stats.due}`}
            </p>
          </div>
        </div>

        <div style={{ padding: "0 16px 16px" }}>
          {stats?.doneToday ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: "12px", borderRadius: 14, background: "var(--en-surface-2)", textAlign: "center", fontSize: 13, color: "var(--en-text-3)", fontWeight: 600 }}>
                Completado por hoy ✓
              </div>
              <Link href="/ingles/session" style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "10px", borderRadius: 14, fontWeight: 600, fontSize: 13, background: "var(--en-surface-2)", color: "var(--en-text-2)", border: "1px solid var(--en-border)" }}>
                Repasar de nuevo
              </Link>
            </div>
          ) : (
            <Link href="/ingles/session" style={{
              display: "block", textAlign: "center", textDecoration: "none",
              padding: "13px", borderRadius: 14, fontWeight: 700, fontSize: 15,
              background: hasSession
                ? "linear-gradient(135deg, var(--en-accent), #8b5cf6)"
                : "var(--en-surface-2)",
              color: hasSession ? "#fff" : "var(--en-text-3)",
              boxShadow: hasSession ? "0 4px 20px rgba(99,102,241,0.3)" : "none",
            }}>
              {stats === null ? "Cargando..." : hasSession ? `▶ Empezar · ${stats.due} tarjetas` : "Sin pendientes por hoy"}
            </Link>
          )}
        </div>
      </div>

      {/* Tiempos verbales */}
      <Link href="/ingles/tenses" style={{ width: "100%", maxWidth: 380, textDecoration: "none" }}>
        <div style={{
          borderRadius: 22, padding: "16px 20px",
          background: "var(--en-surface)", border: "1px solid var(--en-border)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #0ea5e9, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
            📐
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Tiempos verbales</p>
            <p style={{ fontSize: 12, color: "var(--en-text-3)", margin: 0 }}>Present · Past · Future · Perfect</p>
          </div>
          <span style={{ color: "var(--en-text-3)", fontSize: 18 }}>→</span>
        </div>
      </Link>

      {/* Links secundarios */}
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 380 }}>
        <Link href="/ingles/add" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "var(--en-surface)", color: "var(--en-text)", borderRadius: 12, padding: "11px 16px", fontWeight: 600, fontSize: 13, border: "1px solid var(--en-border)" }}>
          + Agregar
        </Link>
        <Link href="/ingles/cards" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "var(--en-surface)", color: "var(--en-text)", borderRadius: 12, padding: "11px 16px", fontWeight: 600, fontSize: 13, border: "1px solid var(--en-border)" }}>
          📚 Ver todas
        </Link>
        <Link href="/ingles/stats" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "var(--en-surface)", color: "var(--en-text)", borderRadius: 12, padding: "11px 16px", fontWeight: 600, fontSize: 13, border: "1px solid var(--en-border)" }}>
          📊 Progreso
        </Link>
      </div>
    </div>
  );
}
