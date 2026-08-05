"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import { Camera, Check, Gift, AlertCircle, X } from "lucide-react";

const GOLD = "#F4A623";
const BG = "#0f0f0f";
const CARD = "#1a1a1a";
const BORDER = "#2a2a2a";

interface ScannerClientProps {
  slug: string;
  token: string;
  restaurant: { name: string; logoUrl: string | null };
  programName: string;
  stampGoal: number;
  rewards: { stamp: number; reward: string }[];
  hasPin: boolean;
}

interface ScanResult {
  ok: boolean;
  name?: string;
  stamps?: number;
  goal?: number;
  earnedTiers?: { stamp: number; reward: string }[];
  message?: string;
  memberId?: string;
  redeemedTiers?: number[];
}

export default function ScannerClient({
  slug,
  token,
  restaurant,
  programName,
  stampGoal,
  rewards,
  hasPin,
}: ScannerClientProps) {
  const storageKey = `qc_scan_verified_${slug}`;
  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScanRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const busyRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [redeemModal, setRedeemModal] = useState<{
    memberId: string;
    name: string;
    stamps: number;
    redeemedTiers: number[];
  } | null>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);

  // Inject manifest and apple meta tags into document head
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = `/escanear/${slug}/manifest.json?t=${token}`;
    document.head.appendChild(link);

    const metaApple = document.createElement("meta");
    metaApple.name = "apple-mobile-web-app-capable";
    metaApple.content = "yes";
    document.head.appendChild(metaApple);

    const metaStatus = document.createElement("meta");
    metaStatus.name = "apple-mobile-web-app-status-bar-style";
    metaStatus.content = "black-translucent";
    document.head.appendChild(metaStatus);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(metaApple);
      document.head.removeChild(metaStatus);
    };
  }, [slug, token]);

  // Check localStorage on mount
  useEffect(() => {
    if (!hasPin) {
      setPinVerified(true);
      return;
    }
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1") setPinVerified(true);
    } catch {}
  }, [hasPin, storageKey]);

  const verifyPin = async () => {
    if (!pinInput.trim()) return;
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch("/api/loyalty/scan-verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, token, pin: pinInput }),
      });
      const d = await res.json();
      if (d.ok) {
        try {
          localStorage.setItem(storageKey, "1");
        } catch {}
        setPinVerified(true);
      } else {
        setPinError(d.error || "PIN incorrecto");
        setPinInput("");
      }
    } catch {
      setPinError("Error de conexión");
    } finally {
      setPinLoading(false);
    }
  };

  const addStamp = useCallback(
    async (memberId: string) => {
      busyRef.current = true;
      try {
        const res = await fetch("/api/loyalty/scan-stamp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId, token, slug }),
        });
        const d = await res.json();
        if (!res.ok) {
          setResult({ ok: false, message: d.error || "No se pudo sumar el sello" });
        } else {
          const pendingRewards = rewards.filter(
            (r) => r.stamp <= d.member.stamps && !d.member.redeemedTiers?.includes(r.stamp),
          );
          setResult({
            ok: true,
            name: d.member.name || "Cliente",
            stamps: d.member.stamps,
            goal: d.goal || stampGoal,
            earnedTiers: d.earnedTiers,
            memberId: d.member.id,
            redeemedTiers: d.member.redeemedTiers,
          });
          if (pendingRewards.length > 0) {
            // keep result visible a bit longer if there are pending rewards to redeem
          }
          if (navigator.vibrate) navigator.vibrate(120);
        }
      } catch {
        setResult({ ok: false, message: "Error de conexión" });
      } finally {
        setTimeout(() => {
          busyRef.current = false;
          setResult(null);
        }, 3000);
      }
    },
    [token, slug, stampGoal, rewards],
  );

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.videoWidth > 0 && !busyRef.current) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          const now = Date.now();
          if (code.data !== lastScanRef.current.id || now - lastScanRef.current.at > 4000) {
            lastScanRef.current = { id: code.data, at: now };
            addStamp(code.data.trim());
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [addStamp]);

  const start = useCallback(async () => {
    setCamError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("Tu navegador no permite la cámara aquí.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (e: any) {
        setCamError(`No se pudo acceder a la cámara (${e?.name || "error"}). Revisa los permisos.`);
        return;
      }
    }
    streamRef.current = stream;
    const v = videoRef.current;
    if (v) {
      v.srcObject = stream;
      v.setAttribute("playsinline", "true");
      await new Promise<void>((res) => {
        if (v.videoWidth > 0) return res();
        v.onloadedmetadata = () => res();
        setTimeout(res, 2000);
      });
      try {
        await v.play();
      } catch {}
    }
    setScanning(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const redeemReward = async (stamp: number) => {
    if (!redeemModal) return;
    setRedeemLoading(true);
    try {
      const res = await fetch("/api/loyalty/scan-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: redeemModal.memberId, stamp, token, slug }),
      });
      const d = await res.json();
      if (res.ok) {
        setRedeemModal(null);
        setResult({ ok: true, name: redeemModal.name, message: `✓ Recompensa canjeada: ${d.reward}` });
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        setTimeout(() => {
          busyRef.current = false;
          setResult(null);
        }, 3000);
      } else {
        alert(d.error || "Error al canjear");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setRedeemLoading(false);
    }
  };

  // ── PIN Screen ──
  if (!pinVerified) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {restaurant.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.logoUrl}
            alt=""
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              objectFit: "cover",
              marginBottom: 16,
              border: `2px solid ${GOLD}`,
            }}
          />
        )}
        <p
          style={{
            fontFamily: "sans-serif",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#fff",
            margin: "0 0 4px",
          }}
        >
          {restaurant.name}
        </p>
        <p
          style={{
            fontFamily: "sans-serif",
            fontSize: "0.8rem",
            color: "rgba(255,255,255,0.45)",
            margin: "0 0 32px",
          }}
        >
          Escáner de sellos
        </p>
        <div style={{ width: "100%", maxWidth: 320 }}>
          <p
            style={{
              fontFamily: "sans-serif",
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.6)",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            Introduce el PIN de acceso
          </p>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value.slice(0, 8));
              setPinError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && verifyPin()}
            placeholder="····"
            autoFocus
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px 16px",
              fontSize: "1.5rem",
              fontFamily: "monospace",
              letterSpacing: "0.3em",
              textAlign: "center",
              background: CARD,
              border: `1px solid ${pinError ? "#ef4444" : BORDER}`,
              borderRadius: 12,
              color: "#fff",
              outline: "none",
              marginBottom: 12,
            }}
          />
          {pinError && (
            <p
              style={{
                fontFamily: "sans-serif",
                fontSize: "0.78rem",
                color: "#ef4444",
                textAlign: "center",
                margin: "0 0 12px",
              }}
            >
              {pinError}
            </p>
          )}
          <button
            type="button"
            onClick={verifyPin}
            disabled={pinLoading || !pinInput}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              border: "none",
              background: GOLD,
              color: "#1a1a1a",
              fontFamily: "sans-serif",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
              opacity: pinLoading || !pinInput ? 0.5 : 1,
            }}
          >
            {pinLoading ? "Verificando…" : "Entrar"}
          </button>
        </div>
      </div>
    );
  }

  // ── Scanner Screen ──
  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
        {restaurant.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.logoUrl}
            alt=""
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              objectFit: "cover",
              border: `1.5px solid ${GOLD}`,
            }}
          />
        )}
        <div>
          <p style={{ fontFamily: "sans-serif", fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", margin: 0 }}>
            {restaurant.name}
          </p>
          <p style={{ fontFamily: "sans-serif", fontSize: "0.85rem", fontWeight: 700, color: "#fff", margin: 0 }}>
            {programName}
          </p>
        </div>
      </div>

      {/* Camera */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#000" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Scanning frame */}
        {scanning && !result && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: "65%",
                maxWidth: 260,
                aspectRatio: "1",
                border: `3px solid ${GOLD}`,
                borderRadius: 20,
                boxShadow: "0 0 0 2000px rgba(0,0,0,0.45)",
              }}
            />
          </div>
        )}

        {/* Camera off state */}
        {!scanning && !result && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <Camera size={52} color="rgba(255,255,255,0.3)" />
            <p
              style={{ fontFamily: "sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.4)", margin: 0 }}
            >
              Toca el botón para escanear
            </p>
          </div>
        )}

        {/* Result overlay */}
        {result && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: 24,
              textAlign: "center",
              background: result.ok ? "rgba(22,163,74,0.94)" : "rgba(220,38,38,0.94)",
              color: "#fff",
            }}
          >
            {result.ok ? <Check size={56} strokeWidth={3} /> : <AlertCircle size={56} />}
            {result.ok && !result.message ? (
              <>
                <p style={{ fontFamily: "sans-serif", fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                  +1 sello · {result.name}
                </p>
                <p style={{ fontFamily: "sans-serif", fontSize: "1.6rem", fontWeight: 800, margin: 0 }}>
                  {result.stamps}/{result.goal}
                </p>
                {result.earnedTiers && result.earnedTiers.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "rgba(255,255,255,0.2)",
                      borderRadius: 10,
                      padding: "8px 14px",
                    }}
                  >
                    <Gift size={18} />
                    <p style={{ fontFamily: "sans-serif", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>
                      ¡Ganó: {result.earnedTiers.map((t) => t.reward).join(", ")}!
                    </p>
                  </div>
                )}
                {/* Button to open redeem modal if there are pending rewards */}
                {result.memberId &&
                  rewards.filter(
                    (r) => r.stamp <= (result.stamps ?? 0) && !result.redeemedTiers?.includes(r.stamp),
                  ).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (result.memberId) {
                          setRedeemModal({
                            memberId: result.memberId,
                            name: result.name || "Cliente",
                            stamps: result.stamps || 0,
                            redeemedTiers: result.redeemedTiers || [],
                          });
                        }
                      }}
                      style={{
                        marginTop: 8,
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "2px solid rgba(255,255,255,0.8)",
                        background: "transparent",
                        color: "#fff",
                        fontFamily: "sans-serif",
                        fontWeight: 700,
                        fontSize: "0.88rem",
                        cursor: "pointer",
                      }}
                    >
                      🎁 Canjear recompensa
                    </button>
                  )}
              </>
            ) : result.message?.startsWith("✓") ? (
              <p style={{ fontFamily: "sans-serif", fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                {result.message}
              </p>
            ) : (
              <p style={{ fontFamily: "sans-serif", fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>
                {result.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Camera error */}
      {camError && (
        <div
          style={{
            margin: "12px 16px 0",
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
        >
          <p style={{ fontFamily: "sans-serif", fontSize: "0.8rem", color: "#ef4444", margin: 0 }}>{camError}</p>
        </div>
      )}

      {/* Bottom controls */}
      <div style={{ padding: "16px", display: "flex", gap: 12, justifyContent: "center" }}>
        {!scanning ? (
          <button
            type="button"
            onClick={start}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              borderRadius: 14,
              border: "none",
              background: GOLD,
              color: "#1a1a1a",
              fontFamily: "sans-serif",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Camera size={20} /> Iniciar escáner
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            style={{
              padding: "14px 28px",
              borderRadius: 14,
              border: `1px solid ${BORDER}`,
              background: CARD,
              color: "rgba(255,255,255,0.6)",
              fontFamily: "sans-serif",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Detener
          </button>
        )}
      </div>

      {/* Redeem modal */}
      {redeemModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              background: CARD,
              borderRadius: 20,
              padding: "20px 16px",
              maxHeight: "70vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <p
                style={{
                  fontFamily: "sans-serif",
                  fontWeight: 700,
                  color: "#fff",
                  fontSize: "1rem",
                  margin: 0,
                }}
              >
                Canjear recompensa · {redeemModal.name}
              </p>
              <button
                type="button"
                onClick={() => setRedeemModal(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>
            <p
              style={{
                fontFamily: "sans-serif",
                fontSize: "0.78rem",
                color: "rgba(255,255,255,0.45)",
                margin: "0 0 14px",
              }}
            >
              {redeemModal.stamps} sello{redeemModal.stamps !== 1 ? "s" : ""} acumulados
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rewards
                .filter((r) => r.stamp <= redeemModal.stamps && !redeemModal.redeemedTiers.includes(r.stamp))
                .map((r) => (
                  <button
                    key={r.stamp}
                    type="button"
                    disabled={redeemLoading}
                    onClick={() => redeemReward(r.stamp)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 14,
                      border: `1px solid ${GOLD}40`,
                      background: `${GOLD}12`,
                      cursor: "pointer",
                      textAlign: "left",
                      opacity: redeemLoading ? 0.5 : 1,
                    }}
                  >
                    <Gift size={20} color={GOLD} style={{ flexShrink: 0 }} />
                    <div>
                      <p
                        style={{
                          fontFamily: "sans-serif",
                          fontWeight: 700,
                          color: "#fff",
                          fontSize: "0.9rem",
                          margin: "0 0 2px",
                        }}
                      >
                        {r.reward}
                      </p>
                      <p
                        style={{
                          fontFamily: "sans-serif",
                          fontSize: "0.72rem",
                          color: "rgba(255,255,255,0.45)",
                          margin: 0,
                        }}
                      >
                        Al sello {r.stamp}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
