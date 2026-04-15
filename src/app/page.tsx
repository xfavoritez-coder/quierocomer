"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import DishPlaceholder from "@/components/DishPlaceholder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dish = any;

const DIET_TYPES = [
  { v: "como de todo", emoji: "🍽️", l: "Como de todo" },
  { v: "vegetariano", emoji: "🌱", l: "Vegetariano" },
  { v: "vegano", emoji: "🌿", l: "Vegano" },
  { v: "pescetariano", emoji: "🐟", l: "Pescetariano" },
];

const ALLERGIES = [
  { v: "sin gluten", l: "Sin gluten" },
  { v: "sin mariscos", l: "Sin mariscos" },
  { v: "sin frutos secos", l: "Sin frutos secos" },
  { v: "sin lácteos", l: "Sin lacteos" },
  { v: "sin cerdo", l: "Sin cerdo" },
  { v: "ninguna", l: "Ninguna" },
];

const FITNESS_OPTIONS = [
  { v: "NONE", emoji: "🍔", l: "En modo chancho", sub: "como lo que sea" },
  { v: "GAINING", emoji: "💪", l: "Subiendo masa", sub: "busco calorias y proteina" },
  { v: "CUTTING", emoji: "🥗", l: "Cuidandome", sub: "proteinas, bajo carbo" },
  { v: "MAINTAINING", emoji: "😐", l: "Sin preferencia", sub: "" },
];

function getWeatherIcon(code: number): string {
  // Rain/snow always win regardless of time
  if ([51,53,55,61,63,65].includes(code)) return "🌧";
  if ([56,57,66,67].includes(code)) return "🌨";
  if ([71,73,75,77].includes(code)) return "❄️";
  // Clear/cloudy depends on time of day
  const h = new Date().getHours();
  const isNight = h >= 20 || h < 6;
  if (code === 0) return isNight ? "🌙" : (h < 12 ? "🌅" : "☀️");
  // Cloudy (1,2,3)
  return isNight ? "☁️" : "⛅";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return "Buenos días";
  if (h >= 12 && h < 20) return "Buena tarde";
  return "Buenas noches";
}

function getSessionId(): string {
  return localStorage.getItem("genie_session_id") ?? "";
}
function getVisitId(): string {
  return sessionStorage.getItem("genieVisitId") ?? "";
}

export default function GeniePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [phase, setPhase] = useState<"loading" | "onboarding" | "feedback" | "dishes" | "solo_or_group">("loading");
  const [pendingFeedback, setPendingFeedback] = useState<{ interactionId: string; dishName: string; dishImage: string | null } | null>(null);

  // Onboarding state
  const [obStep, setObStep] = useState(0);
  const [dietType, setDietType] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [fitnessMode, setFitnessMode] = useState("NONE");
  const [userName, setUserName] = useState("");
  const [savingOb, setSavingOb] = useState(false);

  // Dishes state
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingDishes, setLoadingDishes] = useState(false);
  const seenIdsRef = useRef<string[]>([]);
  const geoRequested = useRef(false);
  const [previewDish, setPreviewDish] = useState<Dish | null>(null);

  // Weather state
  const [weatherInfo, setWeatherInfo] = useState<{icon: string, temp: number, greeting: string, city: string} | null>(null);

  // Fetch weather
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const raw = sessionStorage.getItem("userCoords");
        const coords = raw ? JSON.parse(raw) : { lat: -33.4569, lng: -70.6483 };
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,weathercode`);
        if (res.ok) {
          const data = await res.json();
          const code = data.current?.weathercode ?? 0;
          const icon = getWeatherIcon(code);
          const temp = data.current?.temperature_2m ?? 0;
          const greeting = getGreeting();
          setWeatherInfo({ icon, temp, greeting, city: "Santiago" });
        }
      } catch {}
    };
    fetchWeather();
  }, []);

  // Check onboarding status
  const { isLoading: authLoading } = useAuth();
  useEffect(() => {
    if (authLoading) return; // Wait for auth to resolve
    if (!user) {
      // Guest: check localStorage for onboarding done (persists across sessions)
      const done = localStorage.getItem("genieOnboardingDone");
      if (done === "true") { checkFeedback(); requestGeo(); }
      else setPhase("onboarding");
      return;
    }
    fetch(`/api/genie/onboarding?userId=${user.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.onboardingDone) { checkFeedback(); requestGeo(); }
        else setPhase("onboarding");
      })
      .catch(() => setPhase("onboarding"));
  }, [user, authLoading]);

  // Check for pending feedback before showing dishes
  const checkFeedback = async () => {
    const sid = getSessionId();
    const params = new URLSearchParams({ sessionId: sid });
    if (user?.id) params.set("userId", user.id);
    try {
      const res = await fetch(`/api/genie/pending-feedback?${params}`);
      const data = await res.json();
      if (data?.interactionId) {
        setPendingFeedback(data);
        setPhase("feedback");
        return;
      }
    } catch {}
    // Check for postres (20-60 min after last session)
    const lastResult = localStorage.getItem("genieLastResultAt");
    if (lastResult) {
      const elapsed = Date.now() - Number(lastResult);
      if (elapsed >= 20 * 60 * 1000 && elapsed <= 60 * 60 * 1000) {
        localStorage.removeItem("genieLastResultAt");
        sessionStorage.setItem("genieShowPostres", "true");
      }
    }
    setPhase("dishes");
  };

  const submitFeedback = async (score: "LOVED" | "MEH" | "DISLIKED") => {
    if (!pendingFeedback) return;
    const sid = getSessionId();
    await fetch("/api/genie/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interactionId: pendingFeedback.interactionId, score, userId: user?.id || null, sessionId: sid }),
    });
    setPendingFeedback(null);
    setPhase("dishes");
  };

  // Geolocation
  const requestGeo = useCallback(() => {
    if (geoRequested.current) return;
    geoRequested.current = true;

    const fallback = { lat: -33.4569, lng: -70.6483 };
    const timeout = setTimeout(() => {
      if (!sessionStorage.getItem("userCoords")) {
        sessionStorage.setItem("userCoords", JSON.stringify(fallback));
      }
    }, 5000);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          clearTimeout(timeout);
          sessionStorage.setItem("userCoords", JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
        },
        () => {
          clearTimeout(timeout);
          sessionStorage.setItem("userCoords", JSON.stringify(fallback));
        },
        { timeout: 5000, maximumAge: 300000 }
      );
    } else {
      clearTimeout(timeout);
      sessionStorage.setItem("userCoords", JSON.stringify(fallback));
    }
  }, []);

  // Load dishes when entering dishes phase
  useEffect(() => {
    if (phase === "dishes") loadDishes();
  }, [phase]);

  const loadDishes = async () => {
    setLoadingDishes(true);
    const sid = getSessionId();
    const exclude = seenIdsRef.current.join(",");
    const params = new URLSearchParams({ sessionId: sid });
    if (user?.id) params.set("userId", user.id);
    if (exclude) params.set("exclude", exclude);

    try {
      const res = await fetch(`/api/genie/dishes?${params}`);
      const data = await res.json();
      if (!res.ok) console.error("Dishes API error:", data);
      if (Array.isArray(data) && data.length > 0) {
        setDishes(data);
        // Don't clear selections — keep previously selected dishes
        // Register VIEWED
        fetch("/api/genie/interaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            menuItemIds: data.map((d: Dish) => d.id),
            action: "VIEWED",
            userId: user?.id || null,
            sessionId: sid,
            visitId: getVisitId(),
          }),
        }).catch(() => {});
      }
    } catch {}
    setLoadingDishes(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleNext = () => {
    // Register IGNORED for non-selected visible dishes
    const sid = getSessionId();
    const ignored = dishes.filter(d => !selected.has(d.id)).map(d => d.id);
    if (ignored.length > 0) {
      fetch("/api/genie/interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemIds: ignored, action: "IGNORED", userId: user?.id || null, sessionId: sid }),
      }).catch(() => {});
    }

    // Save selected to session
    sessionStorage.setItem("genieSelectedDishes", JSON.stringify([...selected]));
    setPhase("solo_or_group");
  };

  const goSolo = () => router.push("/context");
  const goGroup = () => router.push("/grupo");

  const handleOtherDishes = () => {
    // Register IGNORED for non-selected current dishes
    const sid = getSessionId();
    const ignoredIds = dishes.filter(d => !selected.has(d.id)).map(d => d.id);
    if (ignoredIds.length > 0) {
      fetch("/api/genie/interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemIds: ignoredIds, action: "IGNORED", userId: user?.id || null, sessionId: sid }),
      }).catch(() => {});
    }

    // Keep selected dishes, exclude all seen from next load
    seenIdsRef.current.push(...dishes.map(d => d.id));
    loadDishes();
  };

  const saveOnboarding = async () => {
    setSavingOb(true);
    const finalRestrictions = [
      ...(dietType && dietType !== "como de todo" ? [dietType] : []),
      ...allergies.filter(a => a !== "ninguna"),
    ];
    const onboardingData = { dietType, allergies, fitnessMode, dietaryRestrictions: finalRestrictions, userName: userName.trim() };
    // Save to localStorage for guests
    localStorage.setItem("genieOnboardingData", JSON.stringify(onboardingData));
    if (userName.trim()) localStorage.setItem("genieUserName", userName.trim());

    await fetch("/api/genie/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user?.id || null,
        sessionId: getSessionId(),
        dietaryRestrictions: finalRestrictions,
        fitnessMode: fitnessMode === "NONE" ? null : fitnessMode,
      }),
    });
    setSavingOb(false);
    localStorage.setItem("genieOnboardingDone", "true");
    // Check if there's a pending group redirect
    const returnGroup = localStorage.getItem("genieReturnToGroup");
    if (returnGroup) {
      localStorage.removeItem("genieReturnToGroup");
      router.push(`/grupo/${returnGroup}`);
      return;
    }
    setPhase("dishes");
    requestGeo();
  };

  // ── ONBOARDING ──
  if (phase === "onboarding") {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>🧞</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem,4vw,1.8rem)", color: "#0D0D0D", textAlign: "center", marginBottom: 8 }}>El Genio quiere conocerte</h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "#666666", textAlign: "center", marginBottom: 32, maxWidth: 400 }}>3 preguntas rapidas para recomendarte mejor.</p>

        {/* Progress */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, width: "100%", maxWidth: 300 }}>
          {[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= obStep ? "#FFD600" : "#E0E0E0" }} />)}
        </div>

        {/* Step 0: Diet type */}
        {obStep === 0 && (
          <div style={{ width: "100%", maxWidth: 400 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#0D0D0D", textAlign: "center", marginBottom: 16 }}>Que tipo de alimentacion tienes?</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DIET_TYPES.map(d => {
                const active = dietType === d.v;
                return (
                  <button key={d.v} onClick={() => { setDietType(d.v); setTimeout(() => setObStep(d.v === "vegano" ? 2 : 1), 200); }} style={{ padding: "16px 18px", background: active ? "rgba(255,214,0,0.12)" : "#F5F5F5", border: active ? "1px solid #FFD600" : "1px solid #E0E0E0", borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                    <span style={{ fontSize: 22 }}>{d.emoji}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.92rem", color: active ? "#0D0D0D" : "#0D0D0D" }}>{d.l}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: Allergies (filtered by diet) */}
        {obStep === 1 && (
          <div style={{ width: "100%", maxWidth: 400 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#0D0D0D", textAlign: "center", marginBottom: 16 }}>Tienes alguna alergia o restricción?</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ALLERGIES.filter(a => {
                if (dietType === "vegetariano") return a.v !== "sin cerdo"; // ya no come carne
                if (dietType === "pescetariano") return a.v !== "sin cerdo"; // ya no come cerdo
                return true;
              }).map(a => {
                const active = allergies.includes(a.v);
                return (
                  <button key={a.v} onClick={() => {
                    if (a.v === "ninguna") setAllergies(["ninguna"]);
                    else setAllergies(prev => prev.filter(x => x !== "ninguna").includes(a.v) ? prev.filter(x => x !== a.v) : [...prev.filter(x => x !== "ninguna"), a.v]);
                  }} style={{ padding: "14px 18px", background: active ? "rgba(255,214,0,0.12)" : "#F5F5F5", border: active ? "1px solid #FFD600" : "1px solid #E0E0E0", borderRadius: 12, fontFamily: "var(--font-body)", fontSize: "0.92rem", color: active ? "#FFD600" : "#666666", cursor: "pointer", textAlign: "left" }}>
                    {active ? "✓ " : ""}{a.l}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button onClick={() => setObStep(0)} style={{ flex: 1, padding: 14, background: "#0D0D0D", color: "#FFFFFF", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}>Atras</button>
              <button onClick={() => setObStep(2)} style={{ flex: 2, padding: 14, background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer" }}>Siguiente</button>
            </div>
          </div>
        )}

        {/* Step 2: Fitness mode */}
        {obStep === 2 && (
          <div style={{ width: "100%", maxWidth: 400 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#0D0D0D", textAlign: "center", marginBottom: 16 }}>En que modo estas?</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FITNESS_OPTIONS.map(f => {
                const active = fitnessMode === f.v;
                return (
                  <button key={f.v} onClick={() => setFitnessMode(f.v)} style={{ padding: "14px 18px", background: active ? "rgba(255,214,0,0.12)" : "#F5F5F5", border: active ? "1px solid #FFD600" : "1px solid #E0E0E0", borderRadius: 12, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{f.emoji}</span>
                    <div>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: active ? "#0D0D0D" : "#0D0D0D", margin: 0 }}>{f.l}</p>
                      {f.sub && <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "#666666", margin: 0 }}>{f.sub}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button onClick={() => setObStep(dietType === "vegano" ? 0 : 1)} style={{ flex: 1, padding: 14, background: "#0D0D0D", color: "#FFFFFF", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}>Atrás</button>
              <button onClick={() => setObStep(3)} style={{ flex: 2, padding: 14, background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>Siguiente</button>
            </div>
          </div>
        )}

        {/* Step 3: Name */}
        {obStep === 3 && (
          <div style={{ width: "100%", maxWidth: 400 }}>
            <h2 className="font-display" style={{ fontSize: "1rem", color: "#0D0D0D", textAlign: "center", marginBottom: 6 }}>Cómo te llamas?</h2>
            <p className="font-body" style={{ fontSize: "0.8rem", color: "#999", textAlign: "center", marginBottom: 16 }}>Para que el Genio te conozca</p>
            <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="Tu nombre" style={{ width: "100%", padding: "14px 16px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 12, color: "#0D0D0D", fontSize: "1rem", outline: "none", boxSizing: "border-box", textAlign: "center", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setObStep(2)} style={{ flex: 1, padding: 14, background: "#0D0D0D", color: "#FFFFFF", border: "none", borderRadius: 99, fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}>Atrás</button>
              <button onClick={saveOnboarding} disabled={savingOb || !userName.trim()} style={{ flex: 2, padding: 14, background: userName.trim() ? "#FFD600" : "#E0E0E0", color: "#0D0D0D", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.9rem", cursor: userName.trim() ? "pointer" : "default" }}>{savingOb ? "..." : "Listo, recomiéndame 🧞"}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── SOLO OR GROUP ──
  if (phase === "solo_or_group") {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>🧞</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.2rem,3.5vw,1.5rem)", color: "#0D0D0D", textAlign: "center", marginBottom: 24 }}>Estas solo o con alguien?</h2>
        <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={goSolo} style={{ padding: "18px 20px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 24 }}>🧑</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", color: "#0D0D0D" }}>Voy solo</span>
          </button>
          <button onClick={goGroup} style={{ padding: "18px 20px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 24 }}>👥</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", color: "#0D0D0D" }}>Estoy con alguien</span>
          </button>
        </div>
      </div>
    );
  }

  // ── FEEDBACK ──
  if (phase === "feedback" && pendingFeedback) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>🧞</p>
        {pendingFeedback.dishImage && (
          <img src={pendingFeedback.dishImage} alt="" style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 20, marginBottom: 16 }} />
        )}
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.1rem,3vw,1.4rem)", color: "#0D0D0D", textAlign: "center", marginBottom: 6 }}>
          Como estuvo?
        </h2>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "0.92rem", color: "#0D0D0D", textAlign: "center", marginBottom: 20 }}>{pendingFeedback.dishName}</p>

        <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 340 }}>
          {([["LOVED", "😍", "Me encanto"], ["MEH", "😐", "Regular"], ["DISLIKED", "😕", "No era lo mio"]] as const).map(([score, emoji, label]) => (
            <button key={score} onClick={() => submitFeedback(score)} style={{ flex: 1, padding: "18px 8px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 16, cursor: "pointer", textAlign: "center" }}>
              <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>{emoji}</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "#666666" }}>{label}</span>
            </button>
          ))}
        </div>

        <button onClick={() => { setPendingFeedback(null); setPhase("dishes"); }} style={{ marginTop: 16, padding: 10, background: "transparent", border: "none", fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#666666", cursor: "pointer" }}>
          Saltar
        </button>
      </div>
    );
  }

  // ── LOADING ──
  if (phase === "loading" || loadingDishes) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>🧞</p>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", color: "#666666" }}>Buscando platos...</p>
      </div>
    );
  }

  // ── DISHES GRID ──
  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", padding: "clamp(20px,4vw,40px) clamp(16px,3vw,24px)" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontSize: 32, marginBottom: 4 }}>🧞</p>
          {weatherInfo && <p className="font-body" style={{ fontSize: 12, color: "#AAAAAA", marginBottom: 8 }}>{weatherInfo.icon} {Math.round(weatherInfo.temp)}°C · {weatherInfo.greeting}</p>}
          <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "#0D0D0D", marginBottom: 4 }}>{(() => { const n = typeof window !== "undefined" ? (user?.nombre?.split(" ")[0] || localStorage.getItem("genieUserName")) : null; return n ? `${n}, qué te llama la atención?` : "Qué te llama la atención?"; })()}</h1>
          <p className="font-body" style={{ fontSize: 13, color: "#888888" }}>Toca los platos que te llamen</p>
        </div>

        <button onClick={async () => {
          setLoadingDishes(true);
          const sid = getSessionId();
          const params = new URLSearchParams({ sessionId: sid, desserts: "true" });
          if (user?.id) params.set("userId", user.id);
          try {
            const res = await fetch(`/api/genie/dishes?${params}`);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) setDishes(data);
          } catch {}
          setLoadingDishes(false);
        }} style={{ display: "block", margin: "0 auto 16px", padding: "8px 20px", background: "transparent", border: "1px solid #E0E0E0", borderRadius: 99, fontSize: "0.78rem", color: "#999", cursor: "pointer" }}>
          Solo quiero algo dulce 🍰
        </button>

        {dishes.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", color: "#666666", textAlign: "center", padding: 40 }}>No hay platos disponibles aun. Vuelve pronto.</p>
        ) : (
          <>
            {/* Selected count */}
            {selected.size > 0 && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#3db89e", textAlign: "center", marginBottom: 10 }}>
                {selected.size} seleccionado{selected.size > 1 ? "s" : ""}
              </p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
              {dishes.map((d: Dish) => {
                const isSel = selected.has(d.id);
                return (
                  <div key={d.id}
                    className="skeleton"
                    style={{ position: "relative", aspectRatio: "1", borderRadius: 14, overflow: "hidden", border: isSel ? "2px solid #3db89e" : "2px solid transparent", cursor: "pointer" }}
                    onClick={() => setPreviewDish(d)}>
                    {d.imagenUrl ? (
                      <Image src={d.imagenUrl} alt={d.nombre} fill sizes="(max-width: 500px) 33vw, 160px" style={{ objectFit: "cover", opacity: isSel ? 0.7 : 1, transition: "opacity 0.15s" }} loading="lazy" />
                    ) : (
                      <DishPlaceholder categoria={d.categoria} />
                    )}
                    {/* Vegan badge */}
                    {d.dietType === "VEGAN" && (
                      <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.55)", borderRadius: 99, padding: "2px 6px", fontSize: 10, color: "#fff", display: "flex", alignItems: "center", gap: 2 }}>🌿</div>
                    )}
                    {/* Checkbox top-right */}
                    <button onClick={(e) => { e.stopPropagation(); toggleSelect(d.id); }} style={{ position: "absolute", top: 0, right: 0, width: 40, height: 40, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", background: isSel ? "#FFD600" : "rgba(0,0,0,0.3)", border: isSel ? "2px solid #FFD600" : "2px solid rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: isSel ? "#0D0D0D" : "#fff", fontWeight: 800 }}>{isSel ? "✓" : ""}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <button onClick={handleNext} disabled={selected.size === 0} style={{ width: "100%", padding: 16, background: selected.size > 0 ? "#FFD600" : "rgba(255,214,0,0.15)", color: selected.size > 0 ? "#0D0D0D" : "#666666", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.92rem", fontWeight: 700, cursor: selected.size > 0 ? "pointer" : "default", marginBottom: 10 }}>
              {selected.size > 0 ? `Estos me llaman la atención (${selected.size}) →` : "Selecciona al menos 1"}
            </button>

            <button onClick={handleOtherDishes} style={{ width: "100%", padding: 14, background: "#0D0D0D", color: "#FFFFFF", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer" }}>
              {selected.size > 0 ? "Quiero ver mas opciones" : "Ver otros platos"}
            </button>

          </>
        )}

        {/* Preview modal */}
        {previewDish && (
          <>
            <div onClick={() => setPreviewDish(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100 }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(90vw, 400px)", zIndex: 101, borderRadius: 20, overflow: "hidden", background: "#FFF", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
              {/* X close button */}
              <button onClick={() => setPreviewDish(null)} style={{ position: "absolute", top: 12, right: 12, zIndex: 2, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              {previewDish.imagenUrl && (
                <div style={{ position: "relative" }}>
                  <Image src={previewDish.imagenUrl} alt={previewDish.nombre} width={400} height={260} sizes="90vw" style={{ width: "100%", height: 260, objectFit: "cover" }} />
                  {previewDish.dietType === "VEGAN" && (
                    <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(0,0,0,0.6)", borderRadius: 99, padding: "3px 10px", fontSize: 11, color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>🌿 Vegano</div>
                  )}
                </div>
              )}
              <div style={{ padding: "16px 20px" }}>
                <h3 className="font-display" style={{ fontSize: "1.1rem", color: "#0D0D0D", marginBottom: 2 }}>{previewDish.nombre}</h3>
                <p className="font-body" style={{ fontSize: "0.82rem", color: "#999", marginBottom: 6 }}>{previewDish.local?.nombre} · <span style={{ color: "#0D0D0D" }}>${Number(previewDish.precio).toLocaleString("es-CL")}</span></p>
                {previewDish.descripcion && (
                  <p className="font-body" style={{ fontSize: "0.8rem", color: "#666", lineHeight: 1.5, marginBottom: 10 }}>{previewDish.descripcion}</p>
                )}
                {previewDish.ingredients?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                    {previewDish.ingredients.map((ing: string) => (
                      <span key={ing} style={{ padding: "2px 8px", borderRadius: 99, background: "#F5F5F5", fontSize: "0.7rem", color: "#666" }}>{ing}</span>
                    ))}
                  </div>
                )}
                {previewDish.totalLoved > 0 && (
                  <p className="font-body" style={{ fontSize: "0.78rem", color: "#3db89e", marginBottom: 10 }}>{previewDish.totalLoved} personas lo recomiendan</p>
                )}
                <button onClick={() => { toggleSelect(previewDish.id); setPreviewDish(null); }} style={{ width: "100%", padding: 14, background: selected.has(previewDish.id) ? "#F5F5F5" : "#FFD600", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.88rem", color: selected.has(previewDish.id) ? "#ff6b6b" : "#0D0D0D", cursor: "pointer" }}>
                  {selected.has(previewDish.id) ? "Quitar selección" : "Me llama la atención"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
