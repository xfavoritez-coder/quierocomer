"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import jsQR from "jsqr";
import { CreditCard, Camera, Check, Gift, AlertCircle } from "lucide-react";
import LoyaltyNav from "../LoyaltyNav";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface ScanResult {
  ok: boolean;
  name?: string;
  stamps?: number;
  goal?: number;
  reward?: string;
  message?: string;
}

export default function LoyaltyScanPage() {
  const { selectedRestaurantId, loading } = usePanelSession();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScanRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const busyRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [goalFallback, setGoalFallback] = useState(10);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    fetch(`/api/loyalty/program?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.json())
      .then((d) => d.program && setGoalFallback(d.program.stampGoal))
      .catch(() => {});
  }, [selectedRestaurantId]);

  const addStamp = useCallback(async (memberId: string) => {
    busyRef.current = true;
    try {
      const res = await fetch(`/api/loyalty/members/${memberId}/stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: 1 }),
      });
      const d = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: d.error || "No se pudo sumar el sello" });
      } else {
        setResult({
          ok: true,
          name: d.member.name || "Cliente",
          stamps: d.member.stamps,
          goal: goalFallback,
          reward: d.earnedTiers?.length ? d.earnedTiers.map((t: any) => t.reward).join(", ") : undefined,
        });
        if (navigator.vibrate) navigator.vibrate(120);
      }
    } catch {
      setResult({ ok: false, message: "Error de conexión" });
    } finally {
      // Cooldown antes de permitir el próximo escaneo
      setTimeout(() => {
        busyRef.current = false;
        setResult(null);
      }, 2600);
    }
  }, [goalFallback]);

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
        if (code && code.data) {
          const now = Date.now();
          if (code.data !== lastScanRef.current.id || now - lastScanRef.current.at > 3000) {
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
      setCamError("Tu navegador no permite la cámara aquí. Ábrelo desde https://quierocomer.com (no una IP local).");
      return;
    }
    let stream: MediaStream;
    try {
      // Cámara trasera preferida
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    } catch {
      try {
        // Fallback: cualquier cámara
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (e: any) {
        setCamError(`No se pudo acceder a la cámara (${e?.name || "error"}). Revisa los permisos del sitio.`);
        return;
      }
    }
    streamRef.current = stream;
    const v = videoRef.current;
    if (v) {
      v.srcObject = stream;
      v.setAttribute("playsinline", "true");
      // Esperar a que el video tenga dimensiones antes de escanear (clave en Android)
      await new Promise<void>((res) => {
        if (v.videoWidth > 0) return res();
        v.onloadedmetadata = () => res();
        setTimeout(res, 2000);
      });
      try {
        await v.play();
      } catch {
        /* algunos navegadores reproducen solo, ignoramos */
      }
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

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={20} color="var(--adm-text3)" /> Fidelidad
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Escanea el código QR de la tarjeta del cliente para sumarle un sello al instante.
        </p>
      </div>

      <LoyaltyNav />

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando…</p>
      ) : (
        <div>
          {/* Visor de cámara */}
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1",
              maxWidth: 380,
              margin: "0 auto",
              borderRadius: 18,
              overflow: "hidden",
              background: "#000",
              border: "1px solid var(--adm-card-border)",
            }}
          >
            <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Marco de escaneo */}
            {scanning && !result && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ width: "62%", aspectRatio: "1", border: `3px solid ${GOLD}`, borderRadius: 16, boxShadow: "0 0 0 2000px rgba(0,0,0,0.35)" }} />
              </div>
            )}

            {/* Estado inicial */}
            {!scanning && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#fff" }}>
                <Camera size={44} color="rgba(255,255,255,0.7)" />
                <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>Cámara apagada</p>
              </div>
            )}

            {/* Resultado del escaneo (overlay) */}
            {result && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: 20,
                  textAlign: "center",
                  background: result.ok ? "rgba(22,163,74,0.94)" : "rgba(220,38,38,0.94)",
                  color: "#fff",
                }}
              >
                {result.ok ? <Check size={52} /> : <AlertCircle size={52} />}
                {result.ok ? (
                  <>
                    <p style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                      +1 sello · {result.name}
                    </p>
                    <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>
                      {result.stamps}/{result.goal}
                    </p>
                    {result.reward && (
                      <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, margin: "4px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                        <Gift size={18} /> ¡Ganó {result.reward}!
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>{result.message}</p>
                )}
              </div>
            )}
          </div>

          {camError && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#ef4444", margin: 0, lineHeight: 1.4 }}>{camError}</p>
            </div>
          )}

          {/* Botón */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            {!scanning ? (
              <button
                type="button"
                onClick={start}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 10, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.9rem", fontWeight: 700, cursor: "pointer" }}
              >
                <Camera size={18} /> Iniciar escáner
              </button>
            ) : (
              <button
                type="button"
                onClick={stop}
                style={{ padding: "12px 24px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.9rem", fontWeight: 700, cursor: "pointer" }}
              >
                Detener
              </button>
            )}
          </div>

          {scanning && !result && (
            <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)", textAlign: "center", marginTop: 12 }}>
              Apunta la cámara al código QR de la tarjeta del cliente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
