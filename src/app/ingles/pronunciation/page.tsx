"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getDuePronunciationItems, submitPronunciationReview, PronunciationItem } from "@/lib/english-srs";

type QueueItem = PronunciationItem & { uid: string; requeued?: boolean };
type Phase = "loading" | "empty" | "showing" | "revealed" | "done";

const GRADE = [
  { q: 0 as const, emoji: "✕", label: "No", color: "var(--en-red)", dim: "var(--en-red-dim)" },
  { q: 1 as const, emoji: "~", label: "Más o menos", color: "var(--en-orange)", dim: "var(--en-orange-dim)" },
  { q: 2 as const, emoji: "✓", label: "Lo tengo", color: "var(--en-green)", dim: "var(--en-green-dim)" },
];

function uid() { return Math.random().toString(36).slice(2); }

export default function PronunciationPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [answer, setAnswer] = useState("");
  const [stats, setStats] = useState({ total: 0, correct: 0, failed: 0, maybe: 0 });
  const [animate, setAnimate] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { load(); }, []);

  // Auto-play audio when showing a "listen" card
  useEffect(() => {
    if (phase === "showing" && current?.type === "listen") {
      setTimeout(() => speak(current.card.phrase_en), 400);
    }
    if (phase === "showing" && current?.type === "speak") {
      // For speak: auto-play so they know what to say
      setTimeout(() => speak(current.card.phrase_en), 300);
    }
  }, [phase, current?.uid]);

  // Focus input on listen cards
  useEffect(() => {
    if (phase === "showing" && current?.type === "listen") {
      setTimeout(() => inputRef.current?.focus(), 600);
    }
  }, [phase, current?.uid]);

  // Keyboard shortcuts
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

  // Enter to reveal (listen mode)
  useEffect(() => {
    if (phase !== "showing" || current?.type !== "listen") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reveal(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, current]);

  async function load() {
    setPhase("loading");
    const items = await getDuePronunciationItems(20);
    if (!items.length) { setPhase("empty"); return; }
    const q: QueueItem[] = items.map((i) => ({ ...i, uid: uid() }));
    setStats({ total: q.length, correct: 0, failed: 0, maybe: 0 });
    setCurrent(q[0]);
    setQueue(q.slice(1));
    setAnswer("");
    setPhase("showing");
  }

  function speak(text: string) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }

  function reveal() {
    setPhase("revealed");
    // On listen reveal: play the correct answer
    if (current?.type === "listen") {
      setTimeout(() => speak(current.card.phrase_en), 200);
    }
  }

  function grade(quality: 0 | 1 | 2) {
    if (!current) return;
    submitPronunciationReview(current.card.id, current.type, quality, current.progress);

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
        setAnswer("");
        setPhase("showing");
      }
    }, 150);
  }

  // ── LOADING ──
  if (phase === "loading") {
    return <Center><Spinner /></Center>;
  }

  // ── EMPTY ──
  if (phase === "empty") {
    return (
      <Center>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 60 }}>🎉</span>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>¡Todo al día!</h2>
            <p style={{ color: "var(--en-text-2)", marginTop: 8 }}>No hay pronunciación pendiente.</p>
          </div>
          <button onClick={() => router.push("/ingles")} className="en-btn-secondary">← Volver</button>
        </div>
      </Center>
    );
  }

  // ── DONE ──
  if (phase === "done") {
    const { total, correct, failed, maybe } = stats;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <Center>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
          <span style={{ fontSize: 60 }}>{pct >= 80 ? "🌟" : pct >= 50 ? "💪" : "🔁"}</span>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Pronunciación completada</h2>
            <p style={{ color: "var(--en-text-2)", marginTop: 4 }}>{pct}% de precisión</p>
          </div>
          <div style={{ width: "100%", height: 8, borderRadius: 99, background: "var(--en-surface-2)" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #8b5cf6, var(--en-green))", borderRadius: 99 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "100%" }}>
            <ResultTile value={total} label="Total" />
            <ResultTile value={correct} label="Correctas" color="var(--en-green)" />
            <ResultTile value={failed} label="Falladas" color="var(--en-red)" />
          </div>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button onClick={load} style={{ flex: 1, padding: 14, borderRadius: 14, fontWeight: 700, fontSize: 15, background: "linear-gradient(135deg, #8b5cf6, var(--en-accent))", color: "#fff", border: "none", cursor: "pointer" }}>
              Otra sesión
            </button>
            <button onClick={() => router.push("/ingles")} className="en-btn-secondary" style={{ flex: 1 }}>
              Inicio
            </button>
          </div>
        </div>
      </Center>
    );
  }

  if (!current) return null;

  const { card } = current;
  const isListen = current.type === "listen";
  const done = stats.correct + stats.failed + stats.maybe;
  const pct = stats.total > 0 ? (done / stats.total) * 100 : 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--en-border)" }}>
        <button onClick={() => router.push("/ingles")} style={{ background: "none", border: "none", color: "var(--en-text-3)", fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>✕</button>
        <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--en-surface-2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #8b5cf6, var(--en-green))", borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {stats.correct > 0 && <span style={{ color: "var(--en-green)", fontSize: 13, fontWeight: 600 }}>✓{stats.correct}</span>}
          {stats.maybe > 0 && <span style={{ color: "var(--en-orange)", fontSize: 13, fontWeight: 600 }}>~{stats.maybe}</span>}
          {stats.failed > 0 && <span style={{ color: "var(--en-red)", fontSize: 13, fontWeight: 600 }}>✕{stats.failed}</span>}
          {/* Type badge */}
          <span style={{ fontSize: 11, background: "var(--en-surface-2)", color: "var(--en-text-3)", padding: "3px 8px", borderRadius: 8 }}>
            {isListen ? "👂 Escuchá" : "🎙 Pronunciá"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", gap: 20, maxWidth: 520, margin: "0 auto", width: "100%", opacity: animate ? 0 : 1, transition: "opacity 0.15s" }}>

        {/* ── LISTEN MODE ── */}
        {isListen && (
          <>
            {/* Card — only shows phrase AFTER reveal */}
            <div style={{ width: "100%", borderRadius: 24, background: "var(--en-surface)", border: "1px solid var(--en-border)", padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, boxShadow: "0 4px 40px rgba(0,0,0,0.3)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", color: "var(--en-text-3)", textTransform: "uppercase" }}>👂 Escucha y escribí</span>

              {phase === "showing" ? (
                <>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🔊</div>
                  <button onClick={() => speak(card.phrase_en)} style={{ background: "var(--en-surface-2)", border: "none", borderRadius: 10, padding: "8px 16px", color: "var(--en-text-2)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Repetir audio
                  </button>
                  <p style={{ fontSize: 12, color: "var(--en-text-3)", margin: 0 }}>Escribí lo que escuchaste en inglés</p>
                </>
              ) : (
                <>
                  {/* Revealed: show the phrase */}
                  <p style={{ fontSize: card.phrase_en.length > 50 ? 18 : 22, fontWeight: 700, textAlign: "center", color: "var(--en-text)", margin: 0 }}>
                    {card.phrase_en}
                  </p>
                  {card.pronunciation_hint && (
                    <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--en-text-2)", background: "var(--en-surface-2)", padding: "4px 10px", borderRadius: 8 }}>
                      {card.pronunciation_hint}
                    </span>
                  )}
                  <p style={{ fontSize: 14, color: "var(--en-text-2)", margin: 0, textAlign: "center" }}>{card.phrase_es}</p>
                  <button onClick={() => speak(card.phrase_en)} style={{ background: "var(--en-surface-2)", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 18, cursor: "pointer" }}>🔊</button>
                </>
              )}
            </div>

            {phase === "showing" ? (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
                <textarea
                  ref={inputRef}
                  className="en-input"
                  rows={2}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Escribí lo que escuchaste..."
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reveal(); } }}
                />
                <button onClick={reveal} style={{ background: "linear-gradient(135deg, #8b5cf6, var(--en-accent))", color: "#fff", border: "none", borderRadius: 14, padding: 15, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                  Revelar
                </button>
              </div>
            ) : (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
                {answer.trim() && (
                  <p style={{ textAlign: "center", fontSize: 13, color: "var(--en-text-3)", margin: 0 }}>
                    Escribiste: <em style={{ color: "var(--en-text-2)" }}>"{answer}"</em>
                  </p>
                )}
                <GradeButtons onGrade={grade} />
              </div>
            )}
          </>
        )}

        {/* ── SPEAK MODE ── */}
        {!isListen && (
          <>
            <div style={{ width: "100%", borderRadius: 24, background: "var(--en-surface)", border: "1px solid var(--en-border)", padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, boxShadow: "0 4px 40px rgba(0,0,0,0.3)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", color: "var(--en-text-3)", textTransform: "uppercase" }}>🎙 Pronunciá en voz alta</span>
              <p style={{ fontSize: card.phrase_en.length > 50 ? 18 : 24, fontWeight: 700, textAlign: "center", color: "var(--en-text)", margin: 0, lineHeight: 1.4 }}>
                {card.phrase_en}
              </p>
              {card.pronunciation_hint && (
                <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--en-text-2)", background: "var(--en-surface-2)", padding: "4px 10px", borderRadius: 8 }}>
                  {card.pronunciation_hint}
                </span>
              )}
              <p style={{ fontSize: 14, color: "var(--en-text-2)", margin: 0, textAlign: "center" }}>{card.phrase_es}</p>
              <button
                onClick={() => speak(card.phrase_en)}
                style={{ background: "var(--en-surface-2)", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 20, cursor: "pointer" }}
              >
                🔊 Escuchar modelo
              </button>
            </div>

            <div style={{ width: "100%" }}>
              <p style={{ textAlign: "center", fontSize: 13, color: "var(--en-text-3)", margin: "0 0 12px" }}>
                ¿Cómo te salió?
              </p>
              <GradeButtons onGrade={grade} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GradeButtons({ onGrade }: { onGrade: (q: 0 | 1 | 2) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
      {GRADE.map((g) => (
        <button
          key={g.q}
          onClick={() => onGrade(g.q)}
          style={{ padding: "14px 8px", borderRadius: 14, background: g.dim, border: `1.5px solid ${g.color}`, color: "var(--en-text)", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "opacity 0.1s" }}
        >
          <span style={{ color: g.color, fontSize: 18 }}>{g.emoji}</span>
          <span>{g.label}</span>
        </button>
      ))}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>{children}</div>;
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid #8b5cf6", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
    </>
  );
}

function ResultTile({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div style={{ background: "var(--en-surface)", border: "1px solid var(--en-border)", borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
      <p style={{ fontSize: 26, fontWeight: 800, color: color ?? "var(--en-text)", margin: 0 }}>{value}</p>
      <p style={{ fontSize: 12, color: "var(--en-text-2)", marginTop: 4 }}>{label}</p>
    </div>
  );
}
