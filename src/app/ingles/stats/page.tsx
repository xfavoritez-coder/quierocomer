"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type CardStat = {
  id: string;
  phrase_en: string;
  phrase_es: string;
  interval_en: number;
  interval_es: number;
  interval_pron: number;
  interval_ctx: number;
};

type Overview = {
  total: number;
  mastered: number;   // all 4 tracks >= 21 days
  learning: number;   // at least 1 track started, not mastered
  newCards: number;   // no progress at all
  streakCombined: number;
};

export default function StatsPage() {
  const [cards, setCards] = useState<CardStat[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mastered" | "learning" | "new">("all");

  useEffect(() => { load(); }, []);

  async function load() {
    const [
      { data: allCards },
      { data: progress },
      { data: pronProgress },
      { data: ctxProgress },
      { data: reviews },
      { data: pronReviews },
      { data: ctxReviews },
    ] = await Promise.all([
      supabase.from("english_cards").select("id, phrase_en, phrase_es").order("created_at"),
      supabase.from("english_progress").select("card_id, direction, interval_days"),
      supabase.from("english_pronunciation_progress").select("card_id, type, interval_days"),
      supabase.from("english_context_progress").select("card_id, interval_days"),
      supabase.from("english_reviews").select("reviewed_at").order("reviewed_at", { ascending: false }).limit(365),
      supabase.from("english_pronunciation_reviews").select("reviewed_at").order("reviewed_at", { ascending: false }).limit(365),
      supabase.from("english_context_reviews").select("reviewed_at").order("reviewed_at", { ascending: false }).limit(365),
    ]);

    if (!allCards) return;

    // Build progress maps
    const progMap = new Map<string, number>(); // key: cardId__dir → interval
    for (const p of progress || []) progMap.set(`${p.card_id}__${p.direction}`, p.interval_days);
    const pronMap = new Map<string, number>();
    for (const p of pronProgress || []) pronMap.set(`${p.card_id}__${p.type}`, p.interval_days);
    const ctxMap = new Map<string, number>();
    for (const p of ctxProgress || []) ctxMap.set(p.card_id, p.interval_days);

    const stats: CardStat[] = allCards.map((c) => ({
      id: c.id,
      phrase_en: c.phrase_en,
      phrase_es: c.phrase_es,
      interval_en: progMap.get(`${c.id}__en_to_es`) ?? 0,
      interval_es: progMap.get(`${c.id}__es_to_en`) ?? 0,
      interval_pron: Math.min(
        pronMap.get(`${c.id}__listen`) ?? 0,
        pronMap.get(`${c.id}__speak`) ?? 0
      ),
      interval_ctx: ctxMap.get(c.id) ?? 0,
    }));

    setCards(stats);

    // Overview
    const MATURE = 21;
    const mastered = stats.filter(c =>
      c.interval_en >= MATURE && c.interval_es >= MATURE &&
      c.interval_pron >= MATURE && c.interval_ctx >= MATURE
    ).length;
    const learning = stats.filter(c =>
      (c.interval_en > 0 || c.interval_es > 0 || c.interval_pron > 0 || c.interval_ctx > 0) &&
      !(c.interval_en >= MATURE && c.interval_es >= MATURE && c.interval_pron >= MATURE && c.interval_ctx >= MATURE)
    ).length;
    const newCards = stats.filter(c =>
      c.interval_en === 0 && c.interval_es === 0 && c.interval_pron === 0 && c.interval_ctx === 0
    ).length;

    // Combined streak
    const mDays = new Set((reviews || []).map((r) => r.reviewed_at.slice(0, 10)));
    const pDays = new Set((pronReviews || []).map((r) => r.reviewed_at.slice(0, 10)));
    const cDays = new Set((ctxReviews || []).map((r) => r.reviewed_at.slice(0, 10)));
    let streakCombined = 0;
    if (mDays.size && pDays.size && cDays.size) {
      const today = new Date().toISOString().slice(0, 10);
      let d = new Date();
      if (!mDays.has(today) || !pDays.has(today) || !cDays.has(today)) d.setDate(d.getDate() - 1);
      while (mDays.has(d.toISOString().slice(0, 10)) && pDays.has(d.toISOString().slice(0, 10)) && cDays.has(d.toISOString().slice(0, 10))) {
        streakCombined++;
        d.setDate(d.getDate() - 1);
      }
    }

    setOverview({ total: allCards.length, mastered, learning, newCards, streakCombined });
    setLoading(false);
  }

  function masteryLevel(card: CardStat): "mastered" | "learning" | "new" {
    const MATURE = 21;
    if (card.interval_en >= MATURE && card.interval_es >= MATURE && card.interval_pron >= MATURE && card.interval_ctx >= MATURE)
      return "mastered";
    if (card.interval_en > 0 || card.interval_es > 0 || card.interval_pron > 0 || card.interval_ctx > 0)
      return "learning";
    return "new";
  }

  function trackBar(interval: number) {
    const MATURE = 21;
    const pct = Math.min(100, (interval / MATURE) * 100);
    const color = interval >= MATURE ? "var(--en-green)" : interval > 0 ? "var(--en-accent)" : "var(--en-surface-2)";
    return (
      <div style={{ height: 4, borderRadius: 99, background: "var(--en-surface-2)", overflow: "hidden", flex: 1 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
    );
  }

  const filtered = cards.filter(c => filter === "all" ? true : masteryLevel(c) === filter);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid var(--en-accent)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "24px 16px", maxWidth: 520, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/ingles" style={{ color: "var(--en-text-3)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Progreso</h1>
      </div>

      {/* Overview tiles */}
      {overview && (
        <>
          {/* Streak */}
          <div style={{ borderRadius: 18, background: "var(--en-gold-dim)", border: "1px solid var(--en-gold)", padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "1px" }}>Racha combinada</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--en-gold)", margin: 0 }}>🔥 {overview.streakCombined} {overview.streakCombined === 1 ? "día" : "días"}</p>
            </div>
            <p style={{ fontSize: 13, color: "var(--en-text-3)", margin: 0, textAlign: "right" }}>
              {overview.total} frases<br />en total
            </p>
          </div>

          {/* Mastery breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
            <OverviewTile value={overview.mastered} label="Dominadas" color="var(--en-green)" emoji="⭐" onClick={() => setFilter(filter === "mastered" ? "all" : "mastered")} active={filter === "mastered"} />
            <OverviewTile value={overview.learning} label="Aprendiendo" color="var(--en-accent)" emoji="📈" onClick={() => setFilter(filter === "learning" ? "all" : "learning")} active={filter === "learning"} />
            <OverviewTile value={overview.newCards} label="Nuevas" color="var(--en-text-3)" emoji="🆕" onClick={() => setFilter(filter === "new" ? "all" : "new")} active={filter === "new"} />
          </div>
        </>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 11, color: "var(--en-text-3)" }}>
        <span>Barras: <span style={{ color: "var(--en-accent)" }}>EN→ES</span> · <span style={{ color: "#8b5cf6" }}>ES→EN</span> · <span style={{ color: "#10b981" }}>Pron</span> · <span style={{ color: "var(--en-gold)" }}>Ctx</span></span>
      </div>

      {/* Card list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((card) => {
          const level = masteryLevel(card);
          return (
            <div key={card.id} style={{ borderRadius: 16, background: "var(--en-surface)", border: "1px solid var(--en-border)", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 2px", color: "var(--en-text)" }}>{card.phrase_en}</p>
                  <p style={{ fontSize: 12, color: "var(--en-text-3)", margin: 0 }}>{card.phrase_es}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", padding: "3px 8px", borderRadius: 6,
                  background: level === "mastered" ? "rgba(16,185,129,0.15)" : level === "learning" ? "rgba(99,102,241,0.15)" : "var(--en-surface-2)",
                  color: level === "mastered" ? "var(--en-green)" : level === "learning" ? "var(--en-accent)" : "var(--en-text-3)",
                  flexShrink: 0,
                }}>
                  {level === "mastered" ? "⭐ dominada" : level === "learning" ? "aprendiendo" : "nueva"}
                </span>
              </div>
              {/* 4 track bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "var(--en-accent)", width: 50, flexShrink: 0 }}>EN→ES</span>
                  {trackBar(card.interval_en)}
                  <span style={{ fontSize: 10, color: "var(--en-text-3)", width: 28, textAlign: "right" }}>{card.interval_en}d</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#8b5cf6", width: 50, flexShrink: 0 }}>ES→EN</span>
                  {trackBar(card.interval_es)}
                  <span style={{ fontSize: 10, color: "var(--en-text-3)", width: 28, textAlign: "right" }}>{card.interval_es}d</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#10b981", width: 50, flexShrink: 0 }}>Pron</span>
                  {trackBar(card.interval_pron)}
                  <span style={{ fontSize: 10, color: "var(--en-text-3)", width: 28, textAlign: "right" }}>{card.interval_pron}d</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "var(--en-gold)", width: 50, flexShrink: 0 }}>Ctx</span>
                  {trackBar(card.interval_ctx)}
                  <span style={{ fontSize: 10, color: "var(--en-text-3)", width: 28, textAlign: "right" }}>{card.interval_ctx}d</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--en-text-3)", marginTop: 40 }}>No hay tarjetas en esta categoría aún.</p>
      )}
    </div>
  );
}

function OverviewTile({ value, label, color, emoji, onClick, active }: {
  value: number; label: string; color: string; emoji: string; onClick: () => void; active: boolean;
}) {
  return (
    <button onClick={onClick} style={{ background: active ? `${color}22` : "var(--en-surface)", border: `1.5px solid ${active ? color : "var(--en-border)"}`, borderRadius: 14, padding: "14px 10px", textAlign: "center", cursor: "pointer", transition: "all 0.15s" }}>
      <p style={{ fontSize: 22, margin: "0 0 4px" }}>{emoji}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: "0 0 2px" }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: 0 }}>{label}</p>
    </button>
  );
}
