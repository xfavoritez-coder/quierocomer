"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTenseLevels, type TenseLevel } from "@/lib/english-tenses";

export default function TensesHub() {
  const [levels, setLevels] = useState<TenseLevel[]>([]);

  useEffect(() => {
    getTenseLevels().then(setLevels);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", gap: 20 }}>

      <div style={{ width: "100%", maxWidth: 400, display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/ingles" style={{ color: "var(--en-text-3)", textDecoration: "none", fontSize: 22, lineHeight: 1 }}>←</Link>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Tiempos verbales</h1>
          <p style={{ fontSize: 13, color: "var(--en-text-3)", margin: 0 }}>Completa 20 correctas para desbloquear el siguiente</p>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 10 }}>
        {levels.map((level, i) => {
          const p = level.progress;
          const unlocked = p?.is_unlocked ?? false;
          const correct = p?.total_correct ?? 0;
          const mastered = !!p?.mastered_at;
          const pct = Math.min(100, Math.round((correct / level.unlock_threshold) * 100));

          return (
            <div key={level.id}>
              {unlocked ? (
                <Link href={`/ingles/tenses/${level.id}`} style={{ textDecoration: "none" }}>
                  <LevelCard level={level} correct={correct} pct={pct} mastered={mastered} unlocked />
                </Link>
              ) : (
                <LevelCard level={level} correct={correct} pct={pct} mastered={mastered} unlocked={false} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LevelCard({ level, correct, pct, mastered, unlocked }: {
  level: TenseLevel; correct: number; pct: number; mastered: boolean; unlocked: boolean;
}) {
  return (
    <div style={{
      borderRadius: 18,
      padding: "16px 18px",
      background: unlocked ? "var(--en-surface)" : "var(--en-surface-2)",
      border: `1px solid ${mastered ? "var(--en-gold)" : unlocked ? "var(--en-border)" : "transparent"}`,
      opacity: unlocked ? 1 : 0.45,
      cursor: unlocked ? "pointer" : "default",
      transition: "transform 0.1s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: mastered ? "var(--en-gold-dim)" : unlocked ? "linear-gradient(135deg, var(--en-accent), #8b5cf6)" : "var(--en-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 800, color: mastered ? "var(--en-gold)" : "#fff",
        }}>
          {mastered ? "★" : unlocked ? level.order_num : "🔒"}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--en-text)" }}>{level.name_es}</p>
          <p style={{ fontSize: 12, color: "var(--en-text-3)", margin: 0 }}>
            {mastered ? "Dominado" : unlocked ? `${correct} / ${level.unlock_threshold} correctas` : "Bloqueado"}
          </p>
        </div>
        {unlocked && !mastered && <span style={{ color: "var(--en-text-3)", fontSize: 18 }}>→</span>}
      </div>

      {unlocked && !mastered && (
        <div style={{ height: 4, borderRadius: 4, background: "var(--en-surface-2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: "linear-gradient(90deg, var(--en-accent), #8b5cf6)", transition: "width 0.4s" }} />
        </div>
      )}
    </div>
  );
}
