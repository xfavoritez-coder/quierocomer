"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Group = any;
type Dish = any;

const STATUS_EMOJI: Record<string, string> = { WAITING: "🟢", SELECTING: "🔍", READY: "✅", RECALCULATING: "🔄" };
const STATUS_TEXT: Record<string, string> = { WAITING: "En la sala", SELECTING: "Escogiendo platos...", READY: "Listo", RECALCULATING: "Cambiando..." };

function getSessionId(): string { return localStorage.getItem("genie_session_id") ?? ""; }

export default function GroupRoom() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group>(null);
  const [phase, setPhase] = useState<"joining" | "lobby" | "selecting" | "hunger" | "waiting" | "result">("joining");
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [nombre, setNombre] = useState(user?.nombre?.split(" ")[0] ?? "");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dishes state (reuse from main genie)
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [previewDish, setPreviewDish] = useState<Dish | null>(null);
  const [result, setResult] = useState<any>(null);
  const [myHunger, setMyHunger] = useState("");

  const sid = getSessionId();

  // Join group on load
  useEffect(() => {
    // Check if onboarding is done — if not, redirect to home with return URL
    const onboardingDone = localStorage.getItem("genieOnboardingDone");
    if (onboardingDone !== "true") {
      localStorage.setItem("genieReturnToGroup", code);
      router.push("/");
      return;
    }
    joinGroup();
  }, [code]);

  const joinGroup = async () => {
    try {
      // First check if group exists
      const gRes = await fetch(`/api/genie/group/${code}`);
      if (!gRes.ok) { setError("Sala no encontrada o expirada"); return; }
      const groupData = await gRes.json();
      setGroup(groupData);

      // Check if already a member
      const existing = groupData.members?.find((m: any) => m.sessionId === sid);
      if (existing) {
        setMyMemberId(existing.id);
        if (existing.estado === "READY" && groupData.estado === "READY") setPhase("result");
        else if (existing.estado === "READY") setPhase("waiting");
        else if (groupData.estado === "SELECTING" || groupData.members.length >= groupData.totalMembers) setPhase("selecting");
        else setPhase("lobby");
        startPolling();
        return;
      }

      // Need to join — show name input if lobby
      if (groupData.members.length < groupData.totalMembers) {
        setPhase("joining");
      } else {
        setError("Sala llena");
      }
    } catch { setError("Error al conectar"); }
  };

  const doJoin = async () => {
    const res = await fetch(`/api/genie/group/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, userId: user?.id || null, nombre: nombre || "Invitado" }),
    });
    if (res.ok) {
      const member = await res.json();
      setMyMemberId(member.id);
      setPhase("lobby");
      startPolling();
    } else {
      const err = await res.json();
      setError(err.error ?? "Error");
    }
  };

  // Poll for updates every 3 seconds
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/genie/group/${code}`);
        if (!res.ok) return;
        const data = await res.json();
        setGroup(data);

        // Auto-transition based on group state
        if (data.estado === "READY") {
          setPhase("result");
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        } else if (data.estado === "SELECTING" || data.members?.length >= data.totalMembers) {
          const me = data.members?.find((m: any) => m.sessionId === sid);
          if (me?.estado === "READY") setPhase("waiting");
          else if (phase === "lobby") setPhase("selecting");
        }
      } catch {}
    }, 3000);
  }, [code, sid, phase]);

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  // Load dishes for selection
  useEffect(() => {
    if (phase === "selecting" && dishes.length === 0) loadDishes();
  }, [phase]);

  const loadDishes = async () => {
    setLoadingDishes(true);
    const params = new URLSearchParams({ sessionId: sid });
    if (user?.id) params.set("userId", user.id);
    try {
      const res = await fetch(`/api/genie/dishes?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) setDishes(data);
    } catch {}
    setLoadingDishes(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const markReady = async (hunger: string) => {
    if (selected.size === 0) return;
    const coords = JSON.parse(sessionStorage.getItem("userCoords") ?? "{}");
    await fetch(`/api/genie/group/${code}/ready`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, selectedDishes: [...selected], ctxHunger: hunger, userLat: coords.lat, userLng: coords.lng }),
    });
    setPhase("waiting");
  };

  // Load result
  useEffect(() => {
    if (phase === "result" && !result) {
      const coords = JSON.parse(sessionStorage.getItem("userCoords") ?? "{}");
      fetch(`/api/genie/group/${code}/result?lat=${coords.lat ?? ""}&lng=${coords.lng ?? ""}`)
        .then(r => r.json())
        .then(d => setResult(d))
        .catch(() => {});
    }
  }, [phase, result, code]);

  const startSelecting = async () => {
    setPhase("selecting");
    // Update member status in DB so others see it
    fetch(`/api/genie/group/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, userId: user?.id || null, nombre: localStorage.getItem("genieUserName") || "Invitado", estado: "SELECTING" }),
    }).catch(() => {});
  };

  const recalculate = async () => {
    setPhase("selecting");
    setSelected(new Set());
    setResult(null);
    loadDishes();
  };

  // ── JOINING ──
  if (phase === "joining" && !error) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>🧞</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: "#0D0D0D", marginBottom: 4 }}>Unirse a la sala</h2>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "#FFD600", letterSpacing: "0.2em", marginBottom: 20 }}>{code}</p>
        <div style={{ width: "100%", maxWidth: 300 }}>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" style={{ width: "100%", padding: "12px 16px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 12, color: "#0D0D0D", fontFamily: "var(--font-body)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          <button onClick={doJoin} style={{ width: "100%", padding: 14, background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>Entrar</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>🧞</p>
        <p style={{ fontFamily: "var(--font-display)", color: "#ff6b6b", textAlign: "center" }}>{error}</p>
        <button onClick={() => router.push("/")} style={{ marginTop: 16, padding: "10px 24px", background: "#0D0D0D", color: "#FFFFFF", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer" }}>Ir al Genio solo</button>
      </div>
    );
  }

  // ── LOBBY ──
  if (phase === "lobby") {
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/grupo/${code}` : "";
    const allHere = (group?.members?.length ?? 0) >= (group?.totalMembers ?? 99);
    const enoughToStart = (group?.members?.length ?? 0) >= 2;

    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {/* Header with icon */}
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#FFD600", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 8 }}>
          {group?.groupType === "PAREJA" ? "💛" : group?.groupType === "FAMILIA" ? "🏠" : "⭐"}
        </div>
        <h2 className="font-display" style={{ fontSize: "1.2rem", color: "#0D0D0D", marginBottom: 4 }}>{group?.groupType === "PAREJA" ? "Sala en pareja" : group?.groupType === "FAMILIA" ? "Sala familiar" : "Sala con amigos"}</h2>
        <p className="font-display" style={{ fontSize: "2.2rem", color: "#0D0D0D", letterSpacing: "0.3em", marginBottom: 8, fontWeight: 700 }}>{code}</p>

        {/* Sharing instructions — personalized */}
        <div style={{ background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, padding: "14px 18px", marginBottom: 20, maxWidth: 340, width: "100%" }}>
          <p className="font-body" style={{ fontSize: "0.82rem", color: "#666", textAlign: "center", lineHeight: 1.6, margin: 0 }}>
            Dile a {group?.groupType === "PAREJA" ? "tu pareja" : group?.groupType === "FAMILIA" ? "tu familia" : "tus amigos"} que entre{group?.groupType === "PAREJA" ? "" : "n"} a <strong style={{ color: "#0D0D0D" }}>quierocomer.cl/grupo</strong> e ingrese{group?.groupType === "PAREJA" ? "" : "n"} el código <strong style={{ color: "#0D0D0D" }}>{code}</strong>
          </p>
        </div>

        {/* Share button */}
        <button onClick={() => { if (navigator.share) navigator.share({ title: "QuieroComer", text: `Entra a la sala ${code} en quierocomer.cl/grupo/${code}`, url: shareUrl }); else { navigator.clipboard.writeText(shareUrl); } }} style={{ padding: "8px 20px", background: "#0D0D0D", color: "#FFFFFF", border: "none", borderRadius: 99, fontSize: "0.78rem", fontWeight: 500, cursor: "pointer", marginBottom: 24 }}>
          📋 Copiar link
        </button>

        {/* Members */}
        <div style={{ width: "100%", maxWidth: 320 }}>
          <p className="font-display" style={{ fontSize: "0.72rem", color: "#999", letterSpacing: "0.1em", marginBottom: 10 }}>MIEMBROS ({group?.members?.length ?? 0}/{group?.totalMembers ?? "?"})</p>
          {(group?.members ?? []).map((m: any) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F0F0F0" }}>
              <span style={{ fontSize: 16 }}>{STATUS_EMOJI[m.estado]}</span>
              <span className="font-display" style={{ fontSize: "0.88rem", color: "#0D0D0D", flex: 1 }}>{m.nombre}{m.sessionId === sid ? " (tú)" : ""}</span>
              <span className="font-body" style={{ fontSize: "0.72rem", color: "#999" }}>{STATUS_TEXT[m.estado]}</span>
            </div>
          ))}
          {!allHere && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", opacity: 0.4 }}>
              <span style={{ fontSize: 16 }}>⏳</span>
              <span className="font-body" style={{ fontSize: "0.82rem", color: "#999" }}>Esperando...</span>
            </div>
          )}
        </div>

        {/* CTA */}
        {allHere ? (
          <button onClick={startSelecting} style={{ marginTop: 20, width: "100%", maxWidth: 320, padding: 16, background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.92rem", cursor: "pointer" }}>
            Comenzar
          </button>
        ) : enoughToStart ? (
          <button onClick={() => { if (confirm("¿Quieres comenzar sin esperar a los demás?")) startSelecting(); }} style={{ marginTop: 20, padding: "12px 24px", background: "#0D0D0D", color: "#FFFFFF", border: "none", borderRadius: 99, fontSize: "0.78rem", fontWeight: 500, cursor: "pointer" }}>
            Comenzar sin esperar
          </button>
        ) : null}
      </div>
    );
  }

  // ── SELECTING ──
  if (phase === "selecting") {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", padding: "clamp(20px,4vw,40px) clamp(16px,3vw,24px)" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <p style={{ fontSize: 28, marginBottom: 4 }}>🧞</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.1rem,3vw,1.4rem)", color: "#0D0D0D", marginBottom: 4 }}>Qué te llama la atención?</h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#666666" }}>Sala {code} · Elige tus platos</p>
          </div>

          {selected.size > 0 && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#3db89e", textAlign: "center", marginBottom: 10 }}>
              {selected.size} seleccionado{selected.size > 1 ? "s" : ""}
            </p>
          )}

          {loadingDishes ? (
            <p style={{ fontFamily: "var(--font-body)", color: "#666666", textAlign: "center", padding: 40 }}>Cargando platos...</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
                {dishes.map((d: Dish) => {
                  const isSel = selected.has(d.id);
                  return (
                    <div key={d.id} onClick={() => setPreviewDish(d)} style={{ position: "relative", aspectRatio: "1", borderRadius: 14, overflow: "hidden", border: isSel ? "2px solid #3db89e" : "2px solid transparent", cursor: "pointer", background: "#F5F5F5" }}>
                      {d.imagenUrl ? <img src={d.imagenUrl} alt={d.nombre} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: isSel ? 0.7 : 1 }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🍽️</div>}
                      <button onClick={(e) => { e.stopPropagation(); toggleSelect(d.id); }} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: isSel ? "#FFD600" : "transparent", border: isSel ? "2px solid #FFD600" : "2px solid rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: isSel ? "#0D0D0D" : "#fff", fontWeight: isSel ? 800 : 400, cursor: "pointer", padding: 0 }}>{isSel ? "✓" : ""}</button>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => selected.size > 0 && setPhase("hunger")} disabled={selected.size === 0} style={{ width: "100%", padding: 16, background: selected.size > 0 ? "#FFD600" : "#E0E0E0", color: selected.size > 0 ? "#0D0D0D" : "#999", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.92rem", cursor: selected.size > 0 ? "pointer" : "default", marginBottom: 8 }}>
                {selected.size > 0 ? `Siguiente (${selected.size}) →` : "Selecciona al menos 1"}
              </button>
              <button onClick={loadDishes} style={{ width: "100%", padding: 14, background: "#0D0D0D", color: "#FFF", border: "none", borderRadius: 99, fontWeight: 500, fontSize: "0.82rem", cursor: "pointer" }}>
                Ver otros platos
              </button>
            </>
          )}
          {/* Preview modal */}
          {previewDish && (
            <>
              <div onClick={() => setPreviewDish(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(90vw, 400px)", zIndex: 101, borderRadius: 16, overflow: "hidden", background: "#FFF", border: "1px solid #E0E0E0" }}>
                {previewDish.imagenUrl && <img src={previewDish.imagenUrl} alt={previewDish.nombre} style={{ width: "100%", height: 240, objectFit: "cover" }} />}
                <div style={{ padding: "14px 18px" }}>
                  <h3 className="font-display" style={{ fontSize: "1rem", color: "#0D0D0D", marginBottom: 4 }}>{previewDish.nombre}</h3>
                  <p className="font-body" style={{ fontSize: "0.82rem", color: "#999", marginBottom: 12 }}>{previewDish.local?.nombre}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { toggleSelect(previewDish.id); setPreviewDish(null); }} style={{ flex: 1, padding: 12, background: selected.has(previewDish.id) ? "#F5F5F5" : "#FFD600", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.82rem", color: selected.has(previewDish.id) ? "#ff6b6b" : "#0D0D0D", cursor: "pointer" }}>
                      {selected.has(previewDish.id) ? "Quitar" : "Me llama la atención"}
                    </button>
                    <button onClick={() => setPreviewDish(null)} style={{ padding: "12px 18px", background: "transparent", border: "1px solid #E0E0E0", borderRadius: 99, fontSize: "0.82rem", color: "#999", cursor: "pointer" }}>Cerrar</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── HUNGER ──
  if (phase === "hunger") {
    return (
      <div style={{ padding: "clamp(20px,4vw,40px) clamp(16px,3vw,24px)" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", paddingTop: 40, textAlign: "center" }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🧞</p>
          <h2 className="font-display" style={{ fontSize: "1.2rem", color: "#0D0D0D", marginBottom: 20 }}>Cuánta hambre tienes?</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { v: "LIGHT", emoji: "🥗", l: "Poca", sub: "Algo liviano" },
              { v: "MEDIUM", emoji: "🍽️", l: "Normal", sub: "Un plato está bien" },
              { v: "HEAVY", emoji: "🍔", l: "Mucha", sub: "Entrada + plato" },
            ].map(h => (
              <button key={h.v} onClick={() => { setMyHunger(h.v); markReady(h.v); }} style={{ padding: "16px 18px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                <span style={{ fontSize: 24 }}>{h.emoji}</span>
                <div>
                  <span className="font-display" style={{ fontSize: "0.92rem", color: "#0D0D0D", display: "block" }}>{h.l}</span>
                  <span className="font-body" style={{ fontSize: "0.72rem", color: "#999" }}>{h.sub}</span>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setPhase("selecting")} style={{ marginTop: 12, padding: 12, background: "transparent", border: "none", fontSize: "0.82rem", color: "#999", cursor: "pointer" }}>← Volver a seleccionar</button>
        </div>
      </div>
    );
  }

  // ── WAITING ──
  if (phase === "waiting") {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>🧞</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "#0D0D0D", marginBottom: 16 }}>Esperando al grupo...</h2>

        <div style={{ width: "100%", maxWidth: 320 }}>
          {(group?.members ?? []).map((m: any) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #E0E0E0" }}>
              <span style={{ fontSize: 18 }}>{STATUS_EMOJI[m.estado]}</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: m.estado === "READY" ? "#3db89e" : "#FFFFFF", flex: 1 }}>{m.nombre}{m.sessionId === sid ? " (tu)" : ""}</span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: m.estado === "READY" ? "#3db89e" : "#666666" }}>{STATUS_TEXT[m.estado]}</span>
            </div>
          ))}
        </div>

        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#666666", marginTop: 20 }}>El resultado aparece cuando todos esten listos</p>
      </div>
    );
  }

  // ── RESULT ──
  if (phase === "result") {
    if (!result?.result) {
      return (
        <div style={{ minHeight: "100vh", background: "#FFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🧞</p>
          <p className="font-display" style={{ color: "#999" }}>Armando el pedido...</p>
        </div>
      );
    }

    const best = result.result.bestLocal;
    const members = result.group?.members ?? [];
    const hungryMembers = members.filter((m: any) => m.ctxHunger === "HEAVY");
    const totalPrecio = members.reduce((sum: number, m: any) => sum + (best.dishesPerMember[m.id]?.precio ?? 0), 0);

    return (
      <div style={{ padding: "clamp(20px,4vw,40px) clamp(16px,3vw,24px)" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 28, marginBottom: 4 }}>🧞</p>
            <h1 className="font-display" style={{ fontSize: "1.2rem", color: "#0D0D0D", marginBottom: 2 }}>El Genio recomienda</h1>
          </div>

          {/* Local */}
          <div style={{ background: "#F5F5F5", borderRadius: 16, padding: "16px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            {best.local.logoUrl && <img src={best.local.logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <p className="font-display" style={{ fontSize: "0.95rem", color: "#0D0D0D", margin: 0 }}>{best.local.nombre}</p>
              <p className="font-body" style={{ fontSize: "0.75rem", color: "#999", margin: 0 }}>{best.local.comuna}{best.local.distanceLabel ? ` · ${best.local.distanceLabel}` : ""}</p>
            </div>
          </div>

          {/* Shared starter — if anyone has HEAVY hunger */}
          {hungryMembers.length > 0 && best.sharedStarter && (
            <>
              <p className="font-display" style={{ fontSize: 11, fontWeight: 700, color: "#0D0D0D", letterSpacing: "1px", marginBottom: 8 }}>🥢 PARA COMPARTIR</p>
              <div style={{ background: "#FFF", border: "1px solid #E0E0E0", borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                {best.sharedStarter.imagenUrl && <img src={best.sharedStarter.imagenUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <p className="font-display" style={{ fontSize: "0.88rem", color: "#0D0D0D", margin: 0 }}>{best.sharedStarter.nombre}</p>
                  <p className="font-body" style={{ fontSize: "0.72rem", color: "#AAAAAA", margin: 0 }}>${Number(best.sharedStarter.precio).toLocaleString("es-CL")}</p>
                </div>
              </div>
            </>
          )}

          {/* Individual plates */}
          <p className="font-display" style={{ fontSize: 11, fontWeight: 700, color: "#0D0D0D", letterSpacing: "1px", marginBottom: 8 }}>🍽️ PLATOS</p>
          {members.map((m: any) => {
            const dish = best.dishesPerMember[m.id];
            if (!dish) return null;
            const isMe = m.sessionId === sid;
            return (
              <div key={m.id} style={{ background: "#FFF", border: "1px solid #E0E0E0", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                {dish.imagenUrl && <img src={dish.imagenUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <p className="font-body" style={{ fontSize: "0.68rem", color: isMe ? "#3db89e" : "#AAAAAA", margin: "0 0 1px" }}>{m.nombre}{isMe ? " (tú)" : ""}</p>
                  <p className="font-display" style={{ fontSize: "0.88rem", color: "#0D0D0D", margin: 0 }}>{dish.nombre}</p>
                  <p className="font-body" style={{ fontSize: "0.72rem", color: "#AAAAAA", margin: 0 }}>${Number(dish.precio).toLocaleString("es-CL")}</p>
                </div>
              </div>
            );
          })}

          {/* Total */}
          {totalPrecio > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px", marginTop: 4, marginBottom: 16 }}>
              <span className="font-body" style={{ fontSize: "0.78rem", color: "#999" }}>Total estimado</span>
              <span className="font-display" style={{ fontSize: "0.88rem", color: "#0D0D0D" }}>${totalPrecio.toLocaleString("es-CL")}</span>
            </div>
          )}

          {/* CTA */}
          <button onClick={() => {
            if (best.local.lat && best.local.lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${best.local.lat},${best.local.lng}`, "_blank");
          }} style={{ width: "100%", padding: 16, background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.92rem", cursor: "pointer", marginBottom: 8 }}>
            Esto pedimos →
          </button>
          <button onClick={recalculate} style={{ width: "100%", padding: 14, background: "#0D0D0D", color: "#FFF", border: "none", borderRadius: 99, fontWeight: 500, fontSize: "0.82rem", cursor: "pointer" }}>
            Ver otra opción
          </button>
        </div>
      </div>
    );
  }

  return null;
}
