"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDueItems, submitReview, StudyItem } from "@/lib/english-srs";

type QueueItem = StudyItem & { requeued?: boolean; uid: string };
type Phase = "loading" | "empty" | "showing" | "revealed" | "done";

function uid() { return Math.random().toString(36).slice(2); }

const GRADE = [
  { q: 0 as const, emoji: "✕", label: "No", color: "var(--en-red)", dim: "var(--en-red-dim)", key: "1" },
  { q: 1 as const, emoji: "~", label: "Más o menos", color: "var(--en-orange)", dim: "var(--en-orange-dim)", key: "2" },
  { q: 2 as const, emoji: "✓", label: "Lo tengo", color: "var(--en-green)", dim: "var(--en-green-dim)", key: "3" },
];

function highlightPhrase(text: string, phrase: string): React.ReactNode {
  if (!phrase || !text || text === phrase) return text;
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(99,102,241,0.28)", borderRadius: 4, padding: "0 3px", color: "inherit" }}>
        {text.slice(idx, idx + phrase.length)}
      </mark>
      {text.slice(idx + phrase.length)}
    </>
  );
}

export default function SessionPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [stats, setStats] = useState({ total: 0, correct: 0, failed: 0, maybe: 0 });
  const [animate, setAnimate] = useState(false);

  useEffect(() => { load(); }, []);

  // Space/Enter to reveal
  useEffect(() => {
    if (phase !== "showing") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); reveal(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // 1/2/3 to grade
  useEffect(() => {
    if (phase !== "revealed") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "1") grade(0);
      else if (e.key === "2") grade(1);
      else if (e.key === "3") grade(2);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, current]);

  async function load() {
    setPhase("loading");
    const items = await getDueItems(20);
    if (!items.length) { setPhase("empty"); return; }
    const q: QueueItem[] = items.map((i) => ({ ...i, uid: uid() }));
    setStats({ total: q.length, correct: 0, failed: 0, maybe: 0 });
    setCurrent(q[0]);
    setQueue(q.slice(1));
    setPhase("showing");
  }

  function speak(text: string) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.85;

    const voices = window.speechSynthesis.getVoices();
    const enVoices = voices.filter(v => v.lang.startsWith("en"));
    // Prefer enhanced/premium voices, then local, then any English
    const best =
      enVoices.find(v => /enhanced|premium/i.test(v.name)) ||
      enVoices.find(v => v.localService) ||
      enVoices[0];
    if (best) u.voice = best;

    window.speechSynthesis.speak(u);
  }

  function reveal() {
    setPhase("revealed");
  }

  function grade(quality: 0 | 1 | 2) {
    if (!current) return;
    submitReview(current.card.id, current.direction, quality, current.progress);

    let newQueue = [...queue];
    if (!current.requeued) {
      if (quality === 2) setStats((s) => ({ ...s, correct: s.correct + 1 }));
      else if (quality === 1) setStats((s) => ({ ...s, maybe: s.maybe + 1 }));
      else setStats((s) => ({ ...s, failed: s.failed + 1 }));
    }

    if (quality === 0) {
      const at = Math.min(5, newQueue.length);
      newQueue.splice(at, 0, { ...current, requeued: true, uid: uid() });
    }

    setAnimate(true);
    setTimeout(() => {
      setAnimate(false);
      if (newQueue.length === 0) {
        setCurrent(null);
        setPhase("done");
      } else {
        setCurrent(newQueue[0]);
        setQueue(newQueue.slice(1));
        setPhase("showing");
      }
    }, 150);
  }

  // ── LOADING ──
  if (phase === "loading") {
    return (
      <CenterScreen>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid var(--en-accent)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "var(--en-text-2)", fontSize: 14 }}>Cargando tarjetas...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </CenterScreen>
    );
  }

  // ── EMPTY ──
  if (phase === "empty") {
    return (
      <CenterScreen>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 64 }}>🎉</div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>¡Todo al día!</h2>
            <p style={{ color: "var(--en-text-2)", marginTop: 8, fontSize: 15 }}>No hay tarjetas para repasar hoy.</p>
          </div>
          <button onClick={() => router.push("/ingles")} className="en-btn-secondary">← Volver al inicio</button>
        </div>
      </CenterScreen>
    );
  }

  // ── DONE ──
  if (phase === "done") {
    const { total, correct, failed } = stats;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const emoji = pct >= 90 ? "🌟" : pct >= 70 ? "💪" : pct >= 50 ? "📖" : "🔁";
    return (
      <CenterScreen>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
          <div style={{ fontSize: 64 }}>{emoji}</div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Sesión completada</h2>
            <p style={{ color: "var(--en-text-2)", marginTop: 4 }}>{pct}% de precisión</p>
          </div>
          <div style={{ width: "100%", height: 8, borderRadius: 99, background: "var(--en-surface-2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--en-accent), var(--en-green))", borderRadius: 99, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "100%" }}>
            <ResultTile value={total} label="Total" />
            <ResultTile value={correct} label="Correctas" color="var(--en-green)" />
            <ResultTile value={failed} label="Falladas" color="var(--en-red)" />
          </div>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button onClick={load} style={{ flex: 1, padding: "14px", borderRadius: 14, fontWeight: 700, fontSize: 15, background: "linear-gradient(135deg, var(--en-accent), #8b5cf6)", color: "#fff", cursor: "pointer", border: "none" }}>
              Otra sesión
            </button>
            <button onClick={() => router.push("/ingles")} className="en-btn-secondary" style={{ flex: 1 }}>
              Inicio
            </button>
          </div>
        </div>
      </CenterScreen>
    );
  }

  if (!current) return null;

  const { card, direction } = current;
  const isEnToEs = direction === "en_to_es";

  // Front: example sentence if available, otherwise the plain phrase
  const frontText = isEnToEs
    ? (card.example_en || card.phrase_en)
    : (card.example_es || card.phrase_es);

  // Back: the translation
  const backText = isEnToEs
    ? (card.example_es || card.phrase_es)
    : (card.example_en || card.phrase_en);

  // Highlight the key expression within the example sentence
  const keyPhrase = isEnToEs
    ? (card.example_en ? card.phrase_en : null)
    : (card.example_es ? card.phrase_es : null);

  // English text for audio (always the English example/phrase)
  const enForAudio = card.example_en || card.phrase_en;

  const done = stats.correct + stats.failed + stats.maybe;
  const pct = stats.total > 0 ? (done / stats.total) * 100 : 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--en-border)" }}>
        <button
          onClick={() => router.push("/ingles")}
          style={{ background: "none", border: "none", color: "var(--en-text-3)", fontSize: 20, padding: "4px 8px", borderRadius: 8, cursor: "pointer", transition: "color 0.15s" }}
          onMouseOver={(e) => (e.currentTarget.style.color = "var(--en-text)")}
          onMouseOut={(e) => (e.currentTarget.style.color = "var(--en-text-3)")}
        >
          ✕
        </button>
        <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--en-surface-2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: "linear-gradient(90deg, var(--en-accent), var(--en-green))", transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {stats.correct > 0 && <span style={{ color: "var(--en-green)", fontSize: 13, fontWeight: 600 }}>✓{stats.correct}</span>}
          {stats.maybe > 0 && <span style={{ color: "var(--en-orange)", fontSize: 13, fontWeight: 600 }}>~{stats.maybe}</span>}
          {stats.failed > 0 && <span style={{ color: "var(--en-red)", fontSize: 13, fontWeight: 600 }}>✕{stats.failed}</span>}
          <span style={{ fontSize: 12, color: "var(--en-text-3)", background: "var(--en-surface-2)", padding: "3px 8px", borderRadius: 8 }}>
            {isEnToEs ? "EN→ES" : "ES→EN"}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "24px 16px", gap: 20,
        maxWidth: 520, margin: "0 auto", width: "100%",
        opacity: animate ? 0 : 1, transition: "opacity 0.15s ease"
      }}>

        {/* Front card */}
        <div style={{
          width: "100%", borderRadius: 24,
          background: "var(--en-surface)", border: "1px solid var(--en-border)",
          padding: "36px 28px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          boxShadow: "0 4px 40px rgba(0,0,0,0.3)"
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", color: "var(--en-text-3)", textTransform: "uppercase" }}>
            {isEnToEs ? "English" : "Español"}
          </span>

          <p style={{
            fontSize: frontText.length > 70 ? 17 : frontText.length > 45 ? 20 : frontText.length > 25 ? 23 : 26,
            fontWeight: 700, textAlign: "center", lineHeight: 1.55,
            color: "var(--en-text)", margin: 0
          }}>
            {keyPhrase ? highlightPhrase(frontText, keyPhrase) : frontText}
          </p>

          <button
            onClick={() => speak(enForAudio)}
            style={{
              background: "var(--en-surface-2)", border: "none",
              borderRadius: 10, padding: "8px 18px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              color: "var(--en-text-2)", fontWeight: 600, fontSize: 13
            }}
          >
            <span style={{ fontSize: 18 }}>🔊</span> Escuchar
          </button>
        </div>

        {/* SHOWING: reveal button */}
        {phase === "showing" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            <button
              onClick={reveal}
              style={{
                width: "100%", background: "linear-gradient(135deg, var(--en-accent), #8b5cf6)",
                color: "#fff", border: "none", borderRadius: 14,
                padding: "16px", fontWeight: 700, fontSize: 16, cursor: "pointer",
                boxShadow: "0 4px 20px rgba(99,102,241,0.3)"
              }}
            >
              Revelar
            </button>
            <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: 0 }}>Espacio o Enter para revelar</p>
          </div>
        )}

        {/* REVEALED: answer + grade buttons */}
        {phase === "revealed" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Answer card */}
            <div style={{
              borderRadius: 18, padding: "20px 24px", textAlign: "center",
              background: "var(--en-surface-2)", border: "1px solid var(--en-border)"
            }}>
              <p style={{ fontSize: 12, color: "var(--en-text-3)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "1px" }}>
                {isEnToEs ? "En español" : "In English"}
              </p>
              <p style={{
                fontSize: backText.length > 70 ? 14 : backText.length > 45 ? 17 : 20,
                fontWeight: 700, color: "var(--en-text)", margin: 0, lineHeight: 1.55
              }}>
                {backText}
              </p>

              {card.pronunciation_hint && (
                <span style={{
                  display: "inline-block", marginTop: 12,
                  fontSize: 13, fontFamily: "monospace",
                  color: "var(--en-text-2)", background: "var(--en-surface)",
                  padding: "5px 12px", borderRadius: 8, letterSpacing: "0.5px"
                }}>
                  {card.pronunciation_hint}
                </span>
              )}

              <button
                onClick={() => speak(enForAudio)}
                style={{
                  display: "block", margin: "14px auto 0",
                  background: "var(--en-surface)", border: "none",
                  borderRadius: 8, padding: "7px 16px", fontSize: 18, cursor: "pointer"
                }}
              >
                🔊
              </button>

              {card.notes && (
                <p style={{ fontSize: 13, color: "var(--en-text-2)", marginTop: 12, lineHeight: 1.6 }}>
                  {card.notes}
                </p>
              )}
            </div>

            {/* Grade buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {GRADE.map((g) => (
                <button
                  key={g.q}
                  onClick={() => grade(g.q)}
                  style={{
                    padding: "14px 10px", borderRadius: 14,
                    background: g.dim, border: `1.5px solid ${g.color}`,
                    color: "var(--en-text)", fontWeight: 700, fontSize: 14,
                    cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 8, transition: "opacity 0.1s"
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <span style={{ fontSize: 18, color: g.color }}>{g.emoji}</span>
                  <span>{g.label}</span>
                  <span style={{ fontSize: 11, color: "var(--en-text-3)", marginLeft: "auto" }}>{g.key}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CenterScreen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {children}
    </div>
  );
}

function ResultTile({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div style={{ background: "var(--en-surface)", border: "1px solid var(--en-border)", borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
      <p style={{ fontSize: 28, fontWeight: 800, color: color ?? "var(--en-text)", margin: 0 }}>{value}</p>
      <p style={{ fontSize: 12, color: "var(--en-text-2)", marginTop: 4 }}>{label}</p>
    </div>
  );
}
