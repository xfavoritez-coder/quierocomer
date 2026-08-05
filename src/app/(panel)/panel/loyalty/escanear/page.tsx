"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import jsQR from "jsqr";
import { CreditCard, Camera, Check, Gift, AlertCircle, Smartphone, Link2, RefreshCw, Eye, EyeOff, Copy, CheckCheck } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

// ─── Types ────────────────────────────────────────────────
interface ScanResult {
  ok: boolean;
  name?: string;
  stamps?: number;
  goal?: number;
  reward?: string;
  message?: string;
}

interface ScanAccessState {
  scanToken: string | null;
  scanEnabled: boolean;
  hasPin: boolean;
}

// ─── Tab: Escanear ahora ──────────────────────────────────
function ScannerTab({ restaurantId }: { restaurantId: string }) {
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
    if (!restaurantId) return;
    fetch(`/api/loyalty/program?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then((d) => d.program && setGoalFallback(d.program.stampGoal))
      .catch(() => {});
  }, [restaurantId]);

  const addStamp = useCallback(
    async (memberId: string) => {
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
        setTimeout(() => {
          busyRef.current = false;
          setResult(null);
        }, 2600);
      }
    },
    [goalFallback],
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
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    } catch {
      try {
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

  return (
    <div>
      <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Escanea el código QR de la tarjeta del cliente para sumarle un sello al instante.
      </p>

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

        {scanning && !result && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: "62%", aspectRatio: "1", border: `3px solid ${GOLD}`, borderRadius: 16, boxShadow: "0 0 0 2000px rgba(0,0,0,0.35)" }} />
          </div>
        )}

        {!scanning && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#fff" }}>
            <Camera size={44} color="rgba(255,255,255,0.7)" />
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>Cámara apagada</p>
          </div>
        )}

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
                <p style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>+1 sello · {result.name}</p>
                <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>{result.stamps}/{result.goal}</p>
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
  );
}

// ─── Tab: App para empleados ──────────────────────────────
function EmployeeAppTab({ restaurantId, slug }: { restaurantId: string; slug: string }) {
  const [state, setState] = useState<ScanAccessState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinMode, setPinMode] = useState<"idle" | "setting">("idle");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const base = typeof window !== "undefined" ? window.location.origin : "https://quierocomer.com";

  const scanUrl = state?.scanToken ? `${base}/escanear/${slug}?t=${state.scanToken}` : null;

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/loyalty/scan-access?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then((d) => setState(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => {
    if (!scanUrl) { setQrDataUrl(null); return; }
    import("qrcode")
      .then((mod) =>
        mod.default.toDataURL(scanUrl, {
          width: 260,
          margin: 2,
          errorCorrectionLevel: "H",
          color: { dark: "#1a1a1a", light: "#ffffff" },
        }),
      )
      .then(setQrDataUrl)
      .catch(() => {});
  }, [scanUrl]);

  const doAction = async (action: string, extra?: object) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/loyalty/scan-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, action, ...extra }),
      });
      const d = await res.json();
      if (res.ok) setState(d);
      else alert(d.error || "Error");
    } catch {
      alert("Error de conexión");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetPin = async () => {
    if (!pinInput || pinInput.length < 4) { setPinError("El PIN debe tener al menos 4 dígitos"); return; }
    if (!/^\d+$/.test(pinInput)) { setPinError("Solo se permiten números"); return; }
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch("/api/loyalty/scan-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, action: "setPin", pin: pinInput }),
      });
      const d = await res.json();
      if (res.ok) {
        setState(d);
        setPinInput("");
        setPinMode("idle");
      } else {
        setPinError(d.error || "Error al guardar el PIN");
      }
    } catch {
      setPinError("Error de conexión");
    } finally {
      setPinLoading(false);
    }
  };

  const copyLink = async () => {
    if (!scanUrl) return;
    try {
      await navigator.clipboard.writeText(scanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading) {
    return <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando…</p>;
  }

  const isReady = state?.scanToken && state?.hasPin;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
        Genera un link especial que tus empleados pueden instalar en su celular como app (sin necesitar acceso al panel).
      </p>

      {/* Status card */}
      <div style={{ padding: "16px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
            Estado del escáner
          </p>
          {state?.scanToken && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => doAction("toggleEnabled")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: state.scanEnabled ? "rgba(22,163,74,0.15)" : "rgba(239,68,68,0.12)",
                color: state.scanEnabled ? "#16a34a" : "#ef4444",
                fontFamily: FB,
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: actionLoading ? "not-allowed" : "pointer",
                opacity: actionLoading ? 0.5 : 1,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: state.scanEnabled ? "#16a34a" : "#ef4444", display: "inline-block" }} />
              {state.scanEnabled ? "Activo" : "Desactivado"}
            </button>
          )}
        </div>

        {/* Token section */}
        {!state?.scanToken ? (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => doAction("generate")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "none", background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", opacity: actionLoading ? 0.5 : 1 }}
          >
            <Link2 size={16} /> Generar acceso
          </button>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <p style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {state.scanToken}
              </p>
              {!confirmRegen ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setConfirmRegen(true)}
                  title="Regenerar token (invalida el link actual)"
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <RefreshCw size={13} /> Regenerar
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => { doAction("regenerate"); setConfirmRegen(false); }}
                    style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: "#ef4444", color: "#fff", fontFamily: FB, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    Sí, regenerar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRegen(false)}
                    style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.75rem", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            {confirmRegen && (
              <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "#ef4444", margin: "0 0 8px", lineHeight: 1.4 }}>
                ⚠️ Al regenerar el token, el link anterior dejará de funcionar y los empleados deberán reinstalar la app.
              </p>
            )}
          </div>
        )}
      </div>

      {/* PIN section */}
      {state?.scanToken && (
        <div style={{ padding: "16px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
              PIN de acceso
            </p>
            {state.hasPin && pinMode === "idle" && (
              <button
                type="button"
                onClick={() => { setPinMode("setting"); setPinInput(""); setPinError(""); }}
                style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.75rem", cursor: "pointer" }}
              >
                Cambiar PIN
              </button>
            )}
          </div>

          {!state.hasPin && pinMode === "idle" ? (
            <div>
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px", lineHeight: 1.4 }}>
                El PIN protege la app: al abrirla por primera vez, el empleado debe introducirlo. Se guarda en su dispositivo y no se vuelve a pedir.
              </p>
              <button
                type="button"
                onClick={() => setPinMode("setting")}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
              >
                Configurar PIN
              </button>
            </div>
          ) : state.hasPin && pinMode === "idle" ? (
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>
              ✓ PIN configurado. Solo tú lo conoces.
            </p>
          ) : null}

          {pinMode === "setting" && (
            <div>
              <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "0 0 10px" }}>
                Elige un PIN de 4 a 8 dígitos numéricos:
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pinInput}
                    onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8)); setPinError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
                    placeholder="4 a 8 dígitos"
                    autoFocus
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 40px 10px 12px",
                      borderRadius: 9,
                      border: `1px solid ${pinError ? "#ef4444" : "var(--adm-card-border)"}`,
                      background: "var(--adm-bg)",
                      color: "var(--adm-text)",
                      fontFamily: "monospace",
                      fontSize: "1.1rem",
                      letterSpacing: "0.2em",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "var(--adm-text3)", padding: 0, display: "flex" }}
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={pinLoading || !pinInput}
                  onClick={handleSetPin}
                  style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: pinLoading || !pinInput ? 0.5 : 1, whiteSpace: "nowrap" }}
                >
                  {pinLoading ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => { setPinMode("idle"); setPinInput(""); setPinError(""); }}
                  style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.85rem", cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
              {pinError && <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "#ef4444", margin: 0 }}>{pinError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Link + QR section */}
      {isReady && scanUrl && (
        <div style={{ padding: "16px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14 }}>
          <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 12px" }}>
            Link para empleados
          </p>

          {/* URL copy row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 9,
              background: "var(--adm-bg)",
              border: "1px solid var(--adm-card-border)",
              marginBottom: 16,
            }}
          >
            <p style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--adm-text2)", margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {scanUrl}
            </p>
            <button
              type="button"
              onClick={copyLink}
              title="Copiar link"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "none", background: copied ? "rgba(22,163,74,0.15)" : GOLD, color: copied ? "#16a34a" : "#1a1a1a", fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }}
            >
              {copied ? <><CheckCheck size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
            </button>
          </div>

          {/* QR code */}
          {qrDataUrl && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR del escáner" style={{ width: 180, height: 180, borderRadius: 12, border: "1px solid var(--adm-card-border)" }} />
            </div>
          )}

          {/* Install instructions */}
          <div style={{ padding: "14px", borderRadius: 10, background: "var(--adm-bg)", border: "1px solid var(--adm-card-border)" }}>
            <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 10px" }}>
              <Smartphone size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Cómo instalar en el celular del empleado
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)" }}>
                <p style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>
                  iPhone (iOS)
                </p>
                <ol style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)", margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  <li>Abre el link en <strong>Safari</strong></li>
                  <li>Toca el botón <strong>Compartir</strong> (cuadrado con flecha ↑)</li>
                  <li>Selecciona <strong>"Agregar a pantalla de inicio"</strong></li>
                  <li>Confirma tocando <strong>"Agregar"</strong></li>
                </ol>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)" }}>
                <p style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>
                  Android
                </p>
                <ol style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)", margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  <li>Abre el link en <strong>Chrome</strong></li>
                  <li>Toca el menú <strong>⋮</strong> (tres puntos)</li>
                  <li>Selecciona <strong>"Agregar a pantalla de inicio"</strong> o <strong>"Instalar app"</strong></li>
                  <li>Confirma tocando <strong>"Instalar"</strong></li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hint when not ready */}
      {state?.scanToken && !state?.hasPin && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.25)" }}>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: GOLD, margin: 0 }}>
            Configura el PIN para generar el link de acceso para tus empleados.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────
export default function LoyaltyScanPage() {
  const { selectedRestaurantId, restaurants, loading } = usePanelSession();
  const [tab, setTab] = useState<"scanner" | "app">("scanner");

  const slug = restaurants.find((r) => r.id === selectedRestaurantId)?.slug ?? "";

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: F,
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "var(--adm-text)",
            margin: "0 0 4px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CreditCard size={20} color="var(--adm-text3)" /> Fidelidad — Escáner
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Suma sellos a la tarjeta de tus clientes.
        </p>
      </div>

      {/* Tab switcher */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 20,
          padding: 4,
          background: "var(--adm-card)",
          border: "1px solid var(--adm-card-border)",
          borderRadius: 12,
          width: "fit-content",
        }}
      >
        {(
          [
            { id: "scanner", label: "Escanear ahora", icon: <Camera size={15} /> },
            { id: "app", label: "App empleados", icon: <Smartphone size={15} /> },
          ] as const
        ).map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 9,
              border: "none",
              background: tab === id ? GOLD : "transparent",
              color: tab === id ? "#1a1a1a" : "var(--adm-text2)",
              fontFamily: F,
              fontSize: "0.82rem",
              fontWeight: tab === id ? 700 : 500,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando…</p>
      ) : tab === "scanner" ? (
        <ScannerTab restaurantId={selectedRestaurantId ?? ""} />
      ) : (
        <EmployeeAppTab restaurantId={selectedRestaurantId ?? ""} slug={slug} />
      )}
    </div>
  );
}
