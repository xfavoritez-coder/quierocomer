"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getDueContextItems, submitContextReview, ContextItem } from "@/lib/english-srs";

type QueueItem = ContextItem & { uid: string; requeued?: boolean };
type Phase = "loading" | "empty" | "showing" | "revealed" | "done";
type InputMode = "write" | "speak";
type RecordState = "idle" | "recording" | "done";

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
  const [inputMode, setInputMode] = useState<InputMode>("write");
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [stats, setStats] = useState({ total: 0, correct: 0, failed: 0, maybe: 0 });
  const [animate, setAnimate] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (phase === "showing" && inputMode === "write") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [phase, current?.uid, inputMode]);

  // Reset answer & recording when card changes
  useEffect(() => {
    setAnswer("");
    setRecordState("idle");
    stopRecording();
  }, [current?.uid]);

  useEffect(() => {
    if (phase === "showing") {
      function onKey(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey && inputMode === "write") { e.preventDefault(); reveal(); }
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
  }, [phase, current, inputMode]);

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

  function startRecording() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome."); return; }

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setAnswer(transcript);
      setRecordState("done");
    };
    rec.onerror = () => setRecordState("idle");
    rec.onend = () => {
      setRecordState((prev) => prev === "recording" ? "idle" : prev);
    };

    recognitionRef.current = rec;
    rec.start();
    setRecordState("recording");
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }

  function reveal() {
    stopRecording();
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
      newQueue.splice(Math.min(5, newQueue.length), 0, { ...current, requeued: true, uid: uid() });
    }

    setAnimate(true);
    setTimeout(() => {
      setAnimate(false);
      if (newQueue.length === 0) { setCurrent(null); setPhase("done"); }
      else { setCurrent(newQueue[0]); setQueue(newQueue.slice(1)); setAnswer(""); setPhase("showing"); }
    }, 150);
  }

  if (phase === "loading") return <Center><Spinner /></Center>;

  if (phase === "empty") {
    return (
      <Center>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 60 }}>🎉</span>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>¡Todo al día!</h2>
          <p style={{ color: "var(--en-text-2)", margin: 0 }}>No hay situaciones pendientes.</p>
          <button onClick={() => router.push("/ingles")} className="en-btn-secondary">← Volver</button>
        </div>
      </Center>
    );
  }

  if (phase === "done") {
    const { total, correct, failed } = stats;
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
            <button onClick={() => router.push("/ingles")} className="en-btn-secondary" style={{ flex: 1 }}>Inicio</button>
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
          <span style={{ fontSize: 11, background: "var(--en-surface-2)", color: "var(--en-text-3)", padding: "3px 8px", borderRadius: 8 }}>💬 Contexto</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", gap: 16, maxWidth: 520, margin: "0 auto", width: "100%", opacity: animate ? 0 : 1, transition: "opacity 0.15s" }}>

        {/* Input mode toggle */}
        {phase === "showing" && (
          <div style={{ display: "flex", gap: 0, background: "var(--en-surface-2)", borderRadius: 12, padding: 3, width: "100%", maxWidth: 260 }}>
            {(["write", "speak"] as InputMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setInputMode(m); setAnswer(""); setRecordState("idle"); stopRecording(); }}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
                  background: inputMode === m ? "var(--en-surface)" : "transparent",
                  color: inputMode === m ? "var(--en-text)" : "var(--en-text-3)",
                  boxShadow: inputMode === m ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {m === "write" ? "✍️ Escribir" : "🎙 Hablar"}
              </button>
            ))}
          </div>
        )}

        {/* Card */}
        <div style={{ width: "100%", borderRadius: 24, background: "var(--en-surface)", border: "1px solid var(--en-border)", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 4px 40px rgba(0,0,0,0.3)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", color: "var(--en-text-3)", textTransform: "uppercase" }}>💬 ¿Cómo lo dirías en inglés?</span>

          <p style={{ fontSize: card.example_es && card.example_es.length > 80 ? 15 : 17, color: "var(--en-text)", margin: 0, lineHeight: 1.6 }}>
            {card.example_es}
          </p>

          {phase === "revealed" && (
            <>
              <div style={{ width: "100%", height: 1, background: "var(--en-border)" }} />

              {answer.trim() && (
                <p style={{ fontSize: 13, color: "var(--en-text-3)", margin: 0 }}>
                  {inputMode === "speak" ? "Dijiste:" : "Escribiste:"} <em style={{ color: "var(--en-text-2)" }}>"{answer}"</em>
                </p>
              )}

              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 16, padding: "16px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#10b981", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Una forma de decirlo
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--en-text)", margin: "0 0 8px", lineHeight: 1.5 }}>
                  {card.example_en || card.phrase_en}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--en-text-3)" }}>Expresión:</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--en-accent)", background: "rgba(99,102,241,0.12)", padding: "2px 10px", borderRadius: 8 }}>
                    {card.phrase_en}
                  </span>
                </div>
                {card.pronunciation_hint && (
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: "#8b5cf6", display: "block", marginTop: 6 }}>
                    {card.pronunciation_hint}
                  </span>
                )}
                <p style={{ fontSize: 13, color: "var(--en-text-2)", margin: "8px 0 0" }}>{card.phrase_es}</p>
                <button onClick={() => speak(card.example_en || card.phrase_en)} style={{ marginTop: 10, background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: 0 }}>
                  🔊
                </button>
              </div>

              <p style={{ fontSize: 12, color: "var(--en-text-3)", margin: 0, textAlign: "center" }}>
                ¿Transmitiste la misma idea, aunque con otras palabras?
              </p>
            </>
          )}
        </div>

        {/* Input area */}
        {phase === "showing" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            {inputMode === "write" ? (
              <>
                <textarea
                  ref={inputRef}
                  className="en-input"
                  rows={3}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Escribe lo que dirías en inglés..."
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reveal(); } }}
                />
                <button onClick={reveal} style={{ background: "linear-gradient(135deg, #10b981, #6366f1)", color: "#fff", border: "none", borderRadius: 14, padding: 15, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                  Revelar
                </button>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                {/* Mic button */}
                <button
                  onClick={recordState === "recording" ? stopRecording : startRecording}
                  style={{
                    width: 80, height: 80, borderRadius: "50%", border: "none", cursor: "pointer", fontSize: 32,
                    background: recordState === "recording"
                      ? "linear-gradient(135deg, #ef4444, #dc2626)"
                      : "linear-gradient(135deg, #10b981, #6366f1)",
                    boxShadow: recordState === "recording" ? "0 0 0 8px rgba(239,68,68,0.2)" : "0 4px 20px rgba(16,185,129,0.4)",
                    transition: "all 0.2s",
                    animation: recordState === "recording" ? "pulse 1s ease-in-out infinite" : "none",
                  }}
                >
                  {recordState === "recording" ? "⏹" : "🎙"}
                </button>
                <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 0 8px rgba(239,68,68,0.2)} 50%{box-shadow:0 0 0 16px rgba(239,68,68,0.1)} }`}</style>

                <p style={{ fontSize: 13, color: "var(--en-text-3)", margin: 0, textAlign: "center" }}>
                  {recordState === "idle" && "Presiona el micrófono y habla en inglés"}
                  {recordState === "recording" && "Escuchando... presiona para detener"}
                  {recordState === "done" && `"${answer}"`}
                </p>

                {/* Reveal button — always visible in speak mode */}
                <button
                  onClick={reveal}
                  style={{
                    width: "100%", background: recordState === "done"
                      ? "linear-gradient(135deg, #10b981, #6366f1)"
                      : "var(--en-surface-2)",
                    color: recordState === "done" ? "#fff" : "var(--en-text-3)",
                    border: "none", borderRadius: 14, padding: 15, fontWeight: 700, fontSize: 15, cursor: "pointer"
                  }}
                >
                  {recordState === "done" ? "Revelar" : "Saltar y revelar"}
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "revealed" && (
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
        <button key={g.q} onClick={() => onGrade(g.q)}
          style={{ padding: "14px 8px", borderRadius: 14, background: g.dim, border: `1.5px solid ${g.color}`, color: "var(--en-text)", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
