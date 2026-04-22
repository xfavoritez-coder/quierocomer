"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, WifiOff, Wifi } from "lucide-react";

interface WaiterCallData {
  id: string;
  tableId: string;
  tableName: string | null;
  dietType: string | null;
  restrictions: string | null;
  calledAt: string;
  answeredAt: string | null;
  table: { name: string; tableNumber: number } | null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Audio element for iOS compatibility
let audioUnlocked = false;
let beepAudio: HTMLAudioElement | null = null;

function initAudio() {
  if (beepAudio) return;
  // Create a beep using a data URI (works on iOS after user interaction)
  // 880Hz beep, 300ms, generated as WAV
  beepAudio = new Audio("data:audio/wav;base64,UklGRl9vT19teleUZXRhdg==");
  // Fallback: use speech synthesis as alert
  beepAudio.volume = 1;
}

function playBeep() {
  // Try AudioContext first
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.5;
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 300);
  } catch {
    // Fallback: vibrate
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
}

function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    audioUnlocked = true;
  } catch {}
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

export default function GarzonPanel({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const [subscribed, setSubscribed] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [calls, setCalls] = useState<WaiterCallData[]>([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const prevCallIds = useRef<Set<string>>(new Set());

  // Subscribe to push on mount
  const subscribe = useCallback(async () => {
    // Push notifications are optional — panel works with polling regardless
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSubscribed(true); // Still works via polling
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        // Still works via polling, just no background notifications
        setSubscribed(true);
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw-waiter.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      const res = await fetch("/api/qr/waiter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, subscription: sub.toJSON() }),
      });
      if (res.ok) setPushActive(true);
    } catch (e) {
      console.error("Push subscribe error:", e);
    }

    setSubscribed(true);
  }, [restaurantId]);

  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    // Check if we already have permission
    if ("Notification" in window && Notification.permission === "granted") {
      subscribe();
    } else if ("Notification" in window && Notification.permission === "default") {
      setNeedsPermission(true);
      // Still connect via polling
      setSubscribed(true);
    } else {
      setSubscribed(true); // polling only
    }
  }, [subscribe]);

  // Poll active calls
  useEffect(() => {
    const poll = () => {
      fetch(`/api/qr/waiter/active-calls?restaurantId=${restaurantId}`)
        .then((r) => r.json())
        .then((data) => {
          const newCalls: WaiterCallData[] = data.calls || [];
          newCalls.forEach((c) => {
            if (!prevCallIds.current.has(c.id)) playBeep();
          });
          prevCallIds.current = new Set(newCalls.map((c) => c.id));
          setCalls(newCalls);
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [restaurantId]);

  // Update "ago" timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const answerCall = async (callId: string) => {
    unlockAudio();
    await fetch("/api/qr/waiter/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId }),
    });
    setCalls((prev) => prev.filter((c) => c.id !== callId));
  };

  return (
    <div className="min-h-screen font-[family-name:var(--font-dm)]" style={{ background: "#0e0e0e", color: "white" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <Bell size={20} color="#F4A623" />
          <div>
            <span style={{ fontSize: "1rem", fontWeight: 700, display: "block" }}>Panel Garzón</span>
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{restaurantName}</span>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 6 }}>
          {subscribed ? <Wifi size={16} color="#16a34a" /> : <WifiOff size={16} color="#dc2626" />}
          <div>
            <span style={{ fontSize: "0.75rem", color: subscribed ? "#16a34a" : "#dc2626", display: "block" }}>
              {subscribed ? "Conectado" : "Desconectado"}
            </span>
            {subscribed && (
              <span style={{ fontSize: "0.6rem", color: pushActive ? "#16a34a" : "rgba(255,255,255,0.3)", display: "block" }}>
                {pushActive ? "Push activo" : "Solo polling"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Permission banner */}
      {needsPermission && (
        <button
          onClick={async () => {
            unlockAudio();
            playBeep(); // Test beep so user knows it works
            await subscribe();
            setNeedsPermission(false);
          }}
          style={{
            width: "100%",
            padding: "14px 20px",
            background: "#F4A623",
            color: "#0e0e0e",
            fontSize: "0.95rem",
            fontWeight: 700,
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Bell size={18} />
          Activar notificaciones push
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 20px", background: "rgba(220,38,38,0.15)", color: "#dc2626", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      {/* Calls */}
      <div style={{ padding: 20 }}>
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: 80, gap: 16 }}>
            <Bell size={48} color="rgba(255,255,255,0.15)" />
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "1rem" }}>Sin llamadas activas</p>
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.82rem" }}>Las llamadas aparecerán aquí</p>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 12 }}>
            <h2 style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#F4A623", marginBottom: 4 }}>
              Llamadas activas ({calls.length})
            </h2>
            {calls.map((call) => {
              const isExpanded = expandedId === call.id;
              const name = call.table?.name || call.tableName || "Cliente";
              const dl: Record<string, string> = { omnivore: "Carnívoro", vegetarian: "Vegetariano", vegan: "Vegano" };
              const dietText = call.dietType ? dl[call.dietType] || null : null;
              let resList: string[] = [];
              try { resList = call.restrictions ? JSON.parse(call.restrictions).filter((r: string) => r !== "ninguna") : []; } catch {}

              return (
                <div key={call.id} style={{ borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(244,166,35,0.3)", overflow: "hidden", animation: "callPulse 2s ease-in-out infinite" }}>
                  {/* Main row — tap to expand */}
                  <div onClick={() => setExpandedId(isExpanded ? null : call.id)} style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F4A623", animation: "lp 1.5s infinite", flexShrink: 0 }}></div>
                        <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "white" }}>{name}</span>
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", marginLeft: 16 }}>
                        Hace {timeAgo(call.calledAt)}
                      </span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      {/* Diet info */}
                      {(dietText || resList.length > 0) && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, marginBottom: 12 }}>
                          {dietText && (
                            <span style={{ background: "rgba(244,166,35,0.12)", color: "#F4A623", fontSize: "0.78rem", fontWeight: 600, padding: "4px 10px", borderRadius: 50 }}>
                              {dietText}
                            </span>
                          )}
                          {resList.map((r: string) => (
                            <span key={r} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", fontWeight: 500, padding: "4px 10px", borderRadius: 50 }}>
                              Sin {r}
                            </span>
                          ))}
                        </div>
                      )}
                      {!dietText && resList.length === 0 && (
                        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.82rem", marginTop: 12, marginBottom: 12 }}>Sin preferencias registradas</p>
                      )}
                      {/* Atender button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); answerCall(call.id); }}
                        className="active:scale-95 transition-transform"
                        style={{ width: "100%", padding: "12px 0", borderRadius: 10, background: "#16a34a", border: "none", color: "white", fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <Check size={18} /> Atender mesa
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes callPulse {
          0%, 100% { border-color: rgba(244,166,35,0.3); }
          50% { border-color: rgba(244,166,35,0.6); }
        }
      `}</style>
    </div>
  );
}
