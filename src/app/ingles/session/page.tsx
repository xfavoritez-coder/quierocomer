"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getDueItems, submitReview, StudyItem } from "@/lib/english-srs";

type QueueItem = StudyItem & { requeued?: boolean; uid: string };
type Phase = "loading" | "empty" | "showing" | "revealed" | "done";

function uid() {
  return Math.random().toString(36).slice(2);
}

const GRADE = [
  { q: 0 as const, emoji: "✕", label: "No", color: "var(--en-red)", dim: "var(--en-red-dim)", key: "1" },
  { q: 1 as const, emoji: "~", label: "Más o menos", color: "var(--en-orange)", dim: "var(--en-orange-dim)", key: "2" },
  { q: 2 as const, emoji: "✓", label: "Lo tengo", color: "var(--en-green)", dim: "var(--en-green-dim)", key: "3" },
];

export default function SessionPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [answer, setAnswer] = useState("");
  const [stats, setStats] = useState({ total: 0, correct: 0, failed: 0, maybe: 0 });
  const [animate, setAnimate] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (phase === "showing") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase, current?.uid]);

  // Keyboard shortcuts for grading (1=No, 2=Más o menos, 3=Lo tengo)
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

  // Enter to reveal
  useEffect(() => {
    if (phase !== "showing") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reveal(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  async function load() {
    setPhase("loading");
    const items = await getDueItems(20);
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
    if (current?.direction === "es_to_en") {
      setTimeout(() => speak(current.card.phrase_en), 300);
    }
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

    // Solo re-queue si no lo sabía (0). "Más o menos" (1) vuelve mañana pero no hoy.
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
            <p style={{ color: "var(--en-text-2)", marginTop: 8, fontSize: 15 }}>
              No hay tarjetas para repasar hoy.
            </p>
          </div>
          <button
            onClick={() => router.push("/ingles")}
            className="en-btn-secondary"
            style={{ marginTop: 8 }}
          >
            ← Volver al inicio
          </button>
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

          {/* Progress bar */}
          <div style={{ width: "100%", height: 8, borderRadius: 99, background: "var(--en-surface-2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--en-accent), var(--en-green))", borderRadius: 99, transition: "width 0.5s ease" }} />
          </div>

          {/* Result grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "100%" }}>
            <ResultTile value={total} label="Total" />
            <ResultTile value={correct} label="Correctas" color="var(--en-green)" />
            <ResultTile value={failed} label="Falladas" color="var(--en-red)" />
          </div>

          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              onClick={load}
              style={{
                flex: 1, padding: "14px", borderRadius: 14, fontWeight: 700, fontSize: 15,
                background: "linear-gradient(135deg, var(--en-accent), #8b5cf6)",
                color: "#fff", cursor: "pointer", border: "none"
              }}
            >
              Otra sesión
            </button>
            <button
              onClick={() => router.push("/ingles")}
              className="en-btn-secondary"
              style={{ flex: 1 }}
            >
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
  const front = isEnToEs ? card.phrase_en : card.phrase_es;
  const back = isEnToEs ? card.phrase_es : card.phrase_en;
  const done = stats.correct + stats.failed;
  const pct = stats.total > 0 ? (done / stats.total) * 100 : 0;

  // ── SESSION ──
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", borderBottom: "1px solid var(--en-border)"
      }}>
        <button
          onClick={() => router.push("/ingles")}
          style={{ background: "none", color: "var(--en-text-3)", fontSize: 20, padding: "4px 8px", borderRadius: 8, transition: "color 0.15s" }}
          onMouseOver={(e) => (e.currentTarget.style.color = "var(--en-text)")}
          onMouseOut={(e) => (e.currentTarget.style.color = "var(--en-text-3)")}
        >
          ✕
        </button>

        {/* Progress bar */}
        <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--en-surface-2)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 99,
            background: "linear-gradient(90deg, var(--en-accent), var(--en-green))",
            transition: "width 0.4s ease"
          }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {stats.correct > 0 && (
            <span style={{ color: "var(--en-green)", fontSize: 13, fontWeight: 600 }}>✓{stats.correct}</span>
          )}
          {stats.maybe > 0 && (
            <span style={{ color: "var(--en-orange)", fontSize: 13, fontWeight: 600 }}>~{stats.maybe}</span>
          )}
          {stats.failed > 0 && (
            <span style={{ color: "var(--en-red)", fontSize: 13, fontWeight: 600 }}>✕{stats.failed}</span>
          )}
          <span style={{
            fontSize: 12, color: "var(--en-text-3)",
            background: "var(--en-surface-2)", padding: "3px 8px", borderRadius: 8
          }}>
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
          background: "var(--en-surface)",
          border: "1px solid var(--en-border)",
          padding: "32px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          boxShadow: "0 4px 40px rgba(0,0,0,0.3)"
        }}>
          {/* Direction label */}
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "1.5px",
            color: "var(--en-text-3)", textTransform: "uppercase"
          }}>
            {isEnToEs ? "English" : "Español"}
          </span>

          {/* Phrase */}
          <p style={{
            fontSize: front.length > 60 ? 18 : front.length > 30 ? 22 : 26,
            fontWeight: 700, textAlign: "center", lineHeight: 1.4,
            color: "var(--en-text)", margin: 0
          }}>
            {front}
          </p>

          {/* Pronunciation hint + TTS */}
          {(isEnToEs) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {card.pronunciation_hint && (
                <span style={{
                  fontSize: 13, fontFamily: "monospace",
                  color: "var(--en-text-2)",
                  background: "var(--en-surface-2)",
                  padding: "4px 10px", borderRadius: 8
                }}>
                  {card.pronunciation_hint}
                </span>
              )}
              <button
                onClick={() => speak(card.phrase_en)}
                style={{
                  background: "var(--en-surface-2)", border: "none",
                  borderRadius: 8, padding: "6px 10px", fontSize: 18,
                  cursor: "pointer", transition: "background 0.15s"
                }}
                title="Escuchar pronunciación"
              >
                🔊
              </button>
            </div>
          )}
        </div>

        {/* ── SHOWING: input ── */}
        {phase === "showing" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--en-text-3)", margin: 0 }}>
              {isEnToEs ? "¿Qué significa en español?" : "¿Cómo se dice en inglés?"}
            </p>
            <textarea
              ref={inputRef}
              className="en-input"
              rows={2}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Escribe tu respuesta..."
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reveal(); } }}
            />
            <button
              onClick={reveal}
              style={{
                background: "linear-gradient(135deg, var(--en-accent), #8b5cf6)",
                color: "#fff", border: "none", borderRadius: 14,
                padding: "15px", fontWeight: 700, fontSize: 15, cursor: "pointer",
                boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
                transition: "opacity 0.15s"
              }}
            >
              Revelar respuesta
            </button>
            <p style={{ textAlign: "center", fontSize: 11, color: "var(--en-text-3)", margin: 0 }}>
              Enter para revelar
            </p>
          </div>
        )}

        {/* ── REVEALED: answer + grades ── */}
        {phase === "revealed" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Answer card */}
            <div style={{
              borderRadius: 18, padding: "20px 24px", textAlign: "center",
              background: "var(--en-surface-2)", border: "1px solid var(--en-border)"
            }}>
              <p style={{ fontSize: 12, color: "var(--en-text-3)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "1px" }}>
                Respuesta
              </p>
              <p style={{ fontSize: back.length > 60 ? 16 : 20, fontWeight: 700, color: "var(--en-text)", margin: 0 }}>
                {back}
              </p>
              {/* TTS for es→en after reveal */}
              {!isEnToEs && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {card.pronunciation_hint && (
                    <span style={{
                      fontSize: 13, fontFamily: "monospace",
                      color: "var(--en-text-2)",
                      background: "var(--en-surface-3)",
                      padding: "4px 10px", borderRadius: 8
                    }}>
                      {card.pronunciation_hint}
                    </span>
                  )}
                  <button
                    onClick={() => speak(card.phrase_en)}
                    style={{ background: "var(--en-surface-3)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 18, cursor: "pointer" }}
                  >
                    🔊
                  </button>
                </div>
              )}
              {card.notes && (
                <p style={{ fontSize: 13, color: "var(--en-text-2)", marginTop: 10, lineHeight: 1.5 }}>
                  {card.notes}
                </p>
              )}
            </div>

            {/* User's answer */}
            {answer.trim() && (
              <p style={{ textAlign: "center", fontSize: 13, color: "var(--en-text-3)", margin: 0 }}>
                Tu respuesta: <em style={{ color: "var(--en-text-2)" }}>"{answer}"</em>
              </p>
            )}

            {/* Grade buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {GRADE.map((g) => (
                <button
                  key={g.q}
                  onClick={() => grade(g.q)}
                  style={{
                    padding: "14px 10px",
                    borderRadius: 14,
                    background: g.dim,
                    border: `1.5px solid ${g.color}`,
                    color: "var(--en-text)",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "opacity 0.1s, transform 0.1s"
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
    <div style={{
      background: "var(--en-surface)", border: "1px solid var(--en-border)",
      borderRadius: 14, padding: "14px 10px", textAlign: "center"
    }}>
      <p style={{ fontSize: 28, fontWeight: 800, color: color ?? "var(--en-text)", margin: 0 }}>{value}</p>
      <p style={{ fontSize: 12, color: "var(--en-text-2)", marginTop: 4 }}>{label}</p>
    </div>
  );
}
