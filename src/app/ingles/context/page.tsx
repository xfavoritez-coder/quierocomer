"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getDueContextItems, submitContextReview, ContextItem } from "@/lib/english-srs";

type QueueItem = ContextItem & { uid: string; requeued?: boolean };
type Phase = "loading" | "empty" | "showing" | "revealed" | "done";

const GRADE = [
  { q: 0 as const, emoji: "✕", label: "No", color: "var(--en-red)", dim: "var(--en-red-dim)" },
  { q: 1 as const, emoji: "~", label: "Más o menos", color: "var(--en-orange)", dim: "var(--en-orange-dim)" },
  { q: 2 as const, emoji: "✓", label: "Lo tengo", color: "var(--en-green)", dim: "var(--en-green-dim)" },
];

function uid() { return Math.random().toString(36).slice(2); }

export default function ContextPage() {
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
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [phase, current?.uid]);

  // Keyboard: Enter to reveal, 1/2/3 to grade
  useEffect(() => {
    if (phase === "showing") {
      function onKey(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reveal(); }
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    if (phase === "revealed") {
      function onKey(e: KeyboardEvent) {
        if (e.key === "1") grade(0);
        else if (e.key === "2") grade(1);
        else if (e.key === "3") grade(2);
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [phase, current]);

  async function load() {
    setPhase("loading");
    const items = await getDueContextItems(20);
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
  }

  function grade(quality: 0 | 1 | 2) {
    if (!current) return;
    submitContextReview(current.card.id, quality, current.progress);

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

  if (phase === "loading") return <Center><Spinner /></Center>;

  if (phase === "empty") {
    return (
      <Center>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 60 }}>🎉</span>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>¡Todo al día!</h2>
            <p style={{ color: "var(--en-text-2)", marginTop: 8 }}>No hay frases de contexto pendientes.</p>
          </div>
          <button onClick={() => router.push("/ingles")} className="en-btn-secondary">← Volver</button>
        </div>
      </Center>
    );
  }

  if (phase === "done") {
    const { total, correct, failed, maybe } = stats;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <Center>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
          <span style={{ fontSize: 60 }}>{pct >= 80 ? "🌟" : pct >= 50 ? "💪" : "🔁"}</span>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Contexto completado</h2>
            <p style={{ color: "var(--en-text-2)", marginTop: 4 }}>{pct}% de precisión</p>
          </div>
          <div style={{ width: "100%", height: 8, borderRadius: 99, background: "var(--en-surface-2)" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #10b981, #6366f1)", borderRadius: 99 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "100%" }}>
            <ResultTile value={total} label="Total" />
            <ResultTile value={correct} label="Correctas" color="var(--en-green)" />
            <ResultTile value={failed} label="Falladas" color="var(--en-red)" />
          </div>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button onClick={load} style={{ flex: 1, padding: 14, borderRadius: 14, fontWeight: 700, fontSize: 15, background: "linear-gradient(135deg, #10b981, #6366f1)", color: "#fff", border: "none", cursor: "pointer" }}>
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
  const done = stats.correct + stats.failed + stats.maybe;
  const pct = stats.total > 0 ? (done / stats.total) * 100 : 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--en-border)" }}>
        <button onClick={() => router.push("/ingles")} style={{ background: "none", border: "none", color: "var(--en-text-3)", fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>✕</button>
        <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--en-surface-2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #10b981, #6366f1)", borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {stats.correct > 0 && <span style={{ color: "var(--en-green)", fontSize: 13, fontWeight: 600 }}>✓{stats.correct}</span>}
          {stats.maybe > 0 && <span style={{ color: "var(--en-orange)", fontSize: 13, fontWeight: 600 }}>~{stats.maybe}</span>}
          {stats.failed > 0 && <span style={{ color: "var(--en-red)", fontSize: 13, fontWeight: 600 }}>✕{stats.failed}</span>}
          <span style={{ fontSize: 11, background: "var(--en-surface-2)", color: "var(--en-text-3)", padding: "3px 8px", borderRadius: 8 }}>
            💬 Contexto
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", gap: 20, maxWidth: 520, margin: "0 auto", width: "100%", opacity: animate ? 0 : 1, transition: "opacity 0.15s" }}>

        {/* Card */}
        <div style={{ width: "100%", borderRadius: 24, background: "var(--en-surface)", border: "1px solid var(--en-border)", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, boxShadow: "0 4px 40px rgba(0,0,0,0.3)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", color: "var(--en-text-3)", textTransform: "uppercase" }}>💬 Traduce al inglés</span>

          {/* Spanish sentence to translate */}
          <p style={{ fontSize: card.example_es && card.example_es.length > 60 ? 17 : 20, fontWeight: 700, textAlign: "center", color: "var(--en-text)", margin: 0, lineHeight: 1.5 }}>
            {card.example_es}
          </p>

          {/* Hint: what phrase they should use */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.1)", padding: "6px 14px", borderRadius: 10 }}>
            <span style={{ fontSize: 11, color: "var(--en-text-3)" }}>Usa:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--en-accent)" }}>{card.phrase_en}</span>
          </div>

          {phase === "revealed" && (
            <>
              <div style={{ width: "100%", height: 1, background: "var(--en-border)" }} />
              {/* Show what they wrote */}
              {answer.trim() && (
                <p style={{ fontSize: 13, color: "var(--en-text-3)", margin: 0, textAlign: "center" }}>
                  Escribiste: <em style={{ color: "var(--en-text-2)" }}>"{answer}"</em>
                </p>
              )}
              {/* Correct answer */}
              <div style={{ width: "100%", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#10b981", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>Respuesta de referencia</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--en-text)", margin: 0, lineHeight: 1.5 }}>{card.phrase_en}</p>
                {card.pronunciation_hint && (
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: "#8b5cf6" }}>{card.pronunciation_hint}</span>
                )}
                <p style={{ fontSize: 13, color: "var(--en-text-2)", margin: 0 }}>{card.phrase_es}</p>
                <button onClick={() => speak(card.phrase_en)} style={{ alignSelf: "flex-start", background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: "2px 0" }}>🔊</button>
              </div>
              <p style={{ fontSize: 12, color: "var(--en-text-3)", margin: 0, textAlign: "center" }}>
                Evalúate tú mismo — ¿tu frase tenía el mismo sentido?
              </p>
            </>
          )}
        </div>

        {/* Input or grade buttons */}
        {phase === "showing" ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            <textarea
              ref={inputRef}
              className="en-input"
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Escribe la frase en inglés..."
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reveal(); } }}
            />
            <button onClick={reveal} style={{ background: "linear-gradient(135deg, #10b981, #6366f1)", color: "#fff", border: "none", borderRadius: 14, padding: 15, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Revelar
            </button>
          </div>
        ) : (
          <div style={{ width: "100%" }}>
            <GradeButtons onGrade={grade} />
          </div>
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
          style={{ padding: "14px 8px", borderRadius: 14, background: g.dim, border: `1.5px solid ${g.color}`, color: "var(--en-text)", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
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
      <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid #10b981", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
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
