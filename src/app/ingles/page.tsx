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

  const todayBothDone = stats?.doneMeaningToday && stats?.donePronToday;

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
              {todayBothDone
                ? "✅ Sesión completa de hoy"
                : stats.doneMeaningToday
                ? "Falta pronunciación para completar el día"
                : stats.donePronToday
                ? "Falta significado para completar el día"
                : "Completá ambas sesiones para mantener la racha"}
            </p>
          )}
        </div>
      </div>

      {/* Racha combinada */}
      {stats && (
        <div style={{
          width: "100%", maxWidth: 380,
          borderRadius: 18, padding: "14px 20px",
          background: todayBothDone ? "var(--en-gold-dim)" : "var(--en-surface)",
          border: `1px solid ${todayBothDone ? "var(--en-gold)" : "var(--en-border)"}`,
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "1px" }}>Racha combinada</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: stats.streakCombined > 0 ? "var(--en-gold)" : "var(--en-text-3)", margin: 0 }}>
              🔥 {stats.streakCombined} {stats.streakCombined === 1 ? "día" : "días"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 22 }}>
            <span title="Significado">{stats.doneMeaningToday ? "✅" : "⬜"}</span>
            <span title="Pronunciación">{stats.donePronToday ? "✅" : "⬜"}</span>
          </div>
        </div>
      )}

      {/* Módulo Significado */}
      <SessionModule
        icon="🎯"
        title="Significado"
        subtitle="Escribí el significado de cada frase"
        streak={stats?.streak ?? 0}
        due={stats?.due ?? 0}
        doneToday={stats?.doneMeaningToday ?? false}
        href="/ingles/session"
        loading={stats === null}
      />

      {/* Módulo Pronunciación */}
      <SessionModule
        icon="🎙"
        title="Pronunciación"
        subtitle="Escuchá y leé en voz alta"
        streak={stats?.streakPron ?? 0}
        due={stats?.duePron ?? 0}
        doneToday={stats?.donePronToday ?? false}
        href="/ingles/pronunciation"
        loading={stats === null}
        accent="purple"
      />

      {/* Links secundarios */}
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 380 }}>
        <Link href="/ingles/add" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "var(--en-surface)", color: "var(--en-text)", borderRadius: 12, padding: "11px 16px", fontWeight: 600, fontSize: 13, border: "1px solid var(--en-border)" }}>
          + Agregar
        </Link>
        <Link href="/ingles/cards" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "var(--en-surface)", color: "var(--en-text)", borderRadius: 12, padding: "11px 16px", fontWeight: 600, fontSize: 13, border: "1px solid var(--en-border)" }}>
          📚 Ver todas
        </Link>
      </div>
    </div>
  );
}

function SessionModule({
  icon, title, subtitle, streak, due, doneToday, href, loading, accent,
}: {
  icon: string; title: string; subtitle: string;
  streak: number; due: number; doneToday: boolean;
  href: string; loading: boolean; accent?: "purple";
}) {
  const accentColor = accent === "purple" ? "#8b5cf6" : "var(--en-accent)";
  const hasSession = due > 0 && !doneToday;

  return (
    <div style={{ width: "100%", maxWidth: 380, borderRadius: 22, overflow: "hidden", border: "1px solid var(--en-border)", background: "var(--en-surface)" }}>
      {/* Header del módulo */}
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--en-border)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--en-text)" }}>{title}</p>
          <p style={{ fontSize: 12, color: "var(--en-text-3)", margin: 0 }}>{subtitle}</p>
        </div>
        {doneToday && <span style={{ fontSize: 18 }}>✅</span>}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", padding: "12px 20px", gap: 20 }}>
        <div>
          <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Racha</p>
          <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: streak > 0 ? "var(--en-gold)" : "var(--en-text-3)" }}>
            🔥 {loading ? "–" : streak}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Hoy</p>
          <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: due > 0 ? accentColor : "var(--en-text-3)" }}>
            {loading ? "–" : doneToday ? "✓" : `${due}`}
          </p>
        </div>
      </div>

      {/* Button */}
      <div style={{ padding: "0 16px 16px" }}>
        {doneToday ? (
          <div style={{ padding: "12px", borderRadius: 14, background: "var(--en-surface-2)", textAlign: "center", fontSize: 13, color: "var(--en-text-3)", fontWeight: 600 }}>
            Completado por hoy ✓
          </div>
        ) : (
          <Link href={href} style={{
            display: "block", textAlign: "center", textDecoration: "none",
            padding: "13px", borderRadius: 14, fontWeight: 700, fontSize: 15,
            background: hasSession ? `linear-gradient(135deg, ${accentColor}, ${accent === "purple" ? "var(--en-accent)" : "#8b5cf6"})` : "var(--en-surface-2)",
            color: hasSession ? "#fff" : "var(--en-text-3)",
            boxShadow: hasSession ? `0 4px 20px ${accentColor}55` : "none",
          }}>
            {loading ? "Cargando..." : hasSession ? `▶ Empezar · ${due} tarjetas` : "Sin pendientes por hoy"}
          </Link>
        )}
      </div>
    </div>
  );
}
