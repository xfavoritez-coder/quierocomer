"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTenseSentences, getTenseLevels, markCorrect, markWrong, unlockNextLevel, setMastered, type TenseSentence, type TenseLevel } from "@/lib/english-tenses";

type Phase = "loading" | "front" | "revealed" | "mastered";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TenseSession() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [level, setLevel] = useState<TenseLevel | null>(null);
  const [nextLevel, setNextLevel] = useState<TenseLevel | null>(null);
  const [queue, setQueue] = useState<TenseSentence[]>([]);
  const [idx, setIdx] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);

  const audioCache = useRef<Map<string, string>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const threshold = level?.unlock_threshold ?? 20;
  const alreadyCorrect = level?.progress?.total_correct ?? 0;
  const totalCorrect = alreadyCorrect + sessionCorrect;
  const isAlreadyMastered = !!(level?.progress?.mastered_at);

  // Load level + sentences
  useEffect(() => {
    async function load() {
      const [levels, sentences] = await Promise.all([
        getTenseLevels(),
        getTenseSentences(slug),
      ]);

      const current = levels.find(l => l.id === slug) ?? null;
      const next = levels.find(l => l.order_num === (current?.order_num ?? 0) + 1) ?? null;
      setLevel(current);
      setNextLevel(next);

      const shuffled = shuffle(sentences);
      setQueue(shuffled);
      setPhase("front");
    }
    load();
  }, [slug]);

  const current = queue[idx];

  // Pre-fetch audio for current sentence
  const prefetchAudio = useCallback(async (text: string) => {
    if (audioCache.current.has(text)) return;
    try {
      const res = await fetch("/api/ingles/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      audioCache.current.set(text, URL.createObjectURL(blob));
    } catch {}
  }, []);

  useEffect(() => {
    if (current?.sentence_en) prefetchAudio(current.sentence_en);
  }, [current, prefetchAudio]);

  async function playAudio(text: string) {
    setAudioLoading(true);
    if (!audioCache.current.has(text)) await prefetchAudio(text);
    const url = audioCache.current.get(text);
    if (url) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } else {
      // fallback
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "en-US";
      utt.rate = 0.9;
      speechSynthesis.speak(utt);
    }
    setAudioLoading(false);
  }

  function reveal() {
    setPhase("revealed");
    // Auto-play audio on reveal
    if (current?.sentence_en) playAudio(current.sentence_en);
  }

  async function grade(correct: boolean) {
    if (!current || !level) return;

    const newSessionCorrect = sessionCorrect + (correct ? 1 : 0);
    const newSessionTotal = sessionTotal + 1;
    setSessionCorrect(newSessionCorrect);
    setSessionTotal(newSessionTotal);

    // Save to DB
    if (correct) {
      await markCorrect(level.id, nextLevel?.id ?? null);
    } else {
      await markWrong(level.id);
    }

    const newTotal = alreadyCorrect + newSessionCorrect;

    // Check if just reached threshold for the first time
    if (correct && newTotal >= threshold && alreadyCorrect < threshold) {
      // Unlock next level
      if (nextLevel) await unlockNextLevel(nextLevel.id);
      await setMastered(level.id);
      setPhase("mastered");
      return;
    }

    // Next sentence (loop queue if needed)
    const nextIdx = idx + 1;
    if (nextIdx >= queue.length) {
      setQueue(shuffle(queue));
      setIdx(0);
    } else {
      setIdx(nextIdx);
    }
    setPhase("front");
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase === "front" && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      }
      if (phase === "revealed") {
        if (e.key === "1") grade(false);
        if (e.key === "2") grade(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, current, sessionCorrect]);

  if (phase === "loading" || !current) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--en-text-3)" }}>Cargando...</p>
      </div>
    );
  }

  if (phase === "mastered") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", gap: 24, textAlign: "center" }}>
        <div style={{ fontSize: 64 }}>🎉</div>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px" }}>¡Nivel completado!</h1>
          <p style={{ color: "var(--en-text-2)", fontSize: 15, margin: 0 }}>
            Terminaste <strong>{level?.name_es}</strong> con {sessionCorrect} correctas hoy.
          </p>
          {nextLevel && (
            <p style={{ color: "var(--en-accent)", fontSize: 14, marginTop: 8, fontWeight: 600 }}>
              🔓 Desbloqueaste: {nextLevel.name_es}
            </p>
          )}
          {!nextLevel && (
            <p style={{ color: "var(--en-gold)", fontSize: 14, marginTop: 8, fontWeight: 600 }}>
              ⭐ ¡Completaste todos los niveles!
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 340 }}>
          {nextLevel && !(nextLevel.progress?.is_unlocked === false) && (
            <button
              onClick={() => router.push(`/ingles/tenses/${nextLevel.id}`)}
              style={{ padding: "14px", borderRadius: 14, fontWeight: 700, fontSize: 15, background: "linear-gradient(135deg, var(--en-accent), #8b5cf6)", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Ir al siguiente →
            </button>
          )}
          <button
            onClick={() => router.push("/ingles/tenses")}
            style={{ padding: "13px", borderRadius: 14, fontWeight: 600, fontSize: 14, background: "var(--en-surface)", color: "var(--en-text)", border: "1px solid var(--en-border)", cursor: "pointer" }}
          >
            Ver todos los niveles
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((totalCorrect / threshold) * 100));
  const needMore = Math.max(0, threshold - totalCorrect);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "0 0 40px" }}>

      {/* Top bar */}
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/ingles/tenses")} style={{ background: "none", border: "none", color: "var(--en-text-3)", fontSize: 22, cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--en-text-2)" }}>{level?.name_es}</p>
          <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: 0 }}>
            {isAlreadyMastered ? `Practicando · ${sessionCorrect} hoy` : needMore === 0 ? "¡Casi listo!" : `${needMore} más para desbloquear siguiente`}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--en-accent)" }}>{sessionCorrect}</p>
          <p style={{ fontSize: 10, color: "var(--en-text-3)", margin: 0 }}>correctas</p>
        </div>
      </div>

      {/* Progress bar */}
      {!isAlreadyMastered && (
        <div style={{ padding: "10px 20px 0" }}>
          <div style={{ height: 5, borderRadius: 5, background: "var(--en-surface-2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 5, background: "linear-gradient(90deg, var(--en-accent), #8b5cf6)", transition: "width 0.4s" }} />
          </div>
        </div>
      )}

      {/* Card */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", gap: 28 }}>

        {/* Spanish sentence */}
        <div style={{
          width: "100%", maxWidth: 400,
          background: "var(--en-surface)",
          border: "1px solid var(--en-border)",
          borderRadius: 24,
          padding: "32px 24px",
          textAlign: "center",
        }}>
          <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "1px" }}>Traduce al inglés</p>
          <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--en-text)", lineHeight: 1.4 }}>
            {current.sentence_es}
          </p>
        </div>

        {/* Answer or reveal */}
        {phase === "front" ? (
          <button
            onClick={reveal}
            style={{
              width: "100%", maxWidth: 400,
              padding: "16px", borderRadius: 16, fontWeight: 700, fontSize: 16,
              background: "linear-gradient(135deg, var(--en-accent), #8b5cf6)",
              color: "#fff", border: "none", cursor: "pointer",
              boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
            }}
          >
            Revelar →
          </button>
        ) : (
          <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* English answer */}
            <div style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 20,
              padding: "20px 24px",
              textAlign: "center",
            }}>
              <p style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px", color: "var(--en-text)", lineHeight: 1.4 }}>
                {current.sentence_en}
              </p>
              <button
                onClick={() => playAudio(current.sentence_en)}
                disabled={audioLoading}
                style={{ background: "none", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: "6px 16px", color: "var(--en-accent)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                {audioLoading ? "..." : "🔊 Escuchar"}
              </button>
            </div>

            {/* Grade buttons */}
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--en-text-3)", margin: 0 }}>¿Lo dijiste bien?</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => grade(false)}
                style={{ flex: 1, padding: "14px", borderRadius: 14, fontWeight: 700, fontSize: 15, background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}
              >
                ✗ No
              </button>
              <button
                onClick={() => grade(true)}
                style={{ flex: 1, padding: "14px", borderRadius: 14, fontWeight: 700, fontSize: 15, background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)", cursor: "pointer" }}
              >
                ✓ Sí
              </button>
            </div>
            <p style={{ textAlign: "center", fontSize: 11, color: "var(--en-text-3)", margin: 0 }}>Teclas: 1 = No · 2 = Sí</p>
          </div>
        )}
      </div>
    </div>
  );
}
