"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = any;

const TAG_COLORS: Record<string, string> = {
  "Mas pedido": "#ec4899",
  "Coincide con tus gustos": "#FFD600",
  "Liviano": "#3db89e",
  "Abundante": "#a78bfa",
  "Cerca tuyo": "#3db89e",
};

export default function GenieResult() {
  const router = useRouter();
  const { user } = useAuth();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [postres, setPostres] = useState<Rec[]>([]);
  const [bebidas, setBebidas] = useState<Rec[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const run = async () => {
      // Get data from sessionStorage
      const selectedRaw = sessionStorage.getItem("genieSelectedDishes");
      const ctxRaw = sessionStorage.getItem("genieContext");
      const coordsRaw = sessionStorage.getItem("userCoords");

      if (!selectedRaw) { router.push("/"); return; }

      const selectedDishIds = JSON.parse(selectedRaw);
      const ctx = ctxRaw ? JSON.parse(ctxRaw) : {};
      const coords = coordsRaw ? JSON.parse(coordsRaw) : { lat: -33.4569, lng: -70.6483 };

      // Fetch weather silently
      let weather: { weatherTemp: number | null; weatherCondition: string | null; weatherHumidity: number | null } = { weatherTemp: null, weatherCondition: null, weatherHumidity: null };
      try {
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,weathercode,relativehumidity_2m`);
        if (wRes.ok) {
          const wData = await wRes.json();
          const c = wData.current;
          const codeMap: Record<number, string> = { 0: "clear", 1: "cloudy", 2: "cloudy", 3: "cloudy", 51: "rain", 53: "rain", 55: "rain", 61: "rain", 63: "rain", 65: "rain", 56: "drizzle", 57: "drizzle", 66: "drizzle", 67: "drizzle" };
          weather = {
            weatherTemp: c.temperature_2m,
            weatherCondition: codeMap[c.weathercode] ?? "cloudy",
            weatherHumidity: c.relativehumidity_2m,
          };
          sessionStorage.setItem("weatherData", JSON.stringify(weather));
        }
      } catch {}

      // Register SELECTED interactions with full context
      const sid = localStorage.getItem("genie_session_id") ?? "";
      fetch("/api/genie/interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuItemIds: selectedDishIds,
          action: "SELECTED",
          userId: user?.id || null,
          sessionId: sid,
          visitId: sessionStorage.getItem("genieVisitId") ?? "",
          ctxCompany: ctx.ctxCompany || null,
          ctxHunger: ctx.ctxHunger || null,
          ctxBudget: ctx.ctxBudget ? Number(ctx.ctxBudget) : null,
          ctxOccasion: ctx.ctxOccasion || null,
          ...weather,
          userLat: coords.lat,
          userLng: coords.lng,
        }),
      }).catch(() => {});

      // Get recommendations
      try {
        const res = await fetch("/api/genie/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedDishIds,
            ...ctx,
            userLat: coords.lat,
            userLng: coords.lng,
            userId: user?.id || null,
            sessionId: sid,
          visitId: sessionStorage.getItem("genieVisitId") ?? "",
            weatherTemp: weather.weatherTemp,
            weatherCondition: weather.weatherCondition,
          }),
        });
        const data = await res.json();
        const recsArr = Array.isArray(data) ? data : [];
        setRecs(recsArr);

        // Save timestamp for postre timing
        localStorage.setItem("genieLastResultAt", String(Date.now()));

        // Fetch extras from recommended local(s)
        if (recsArr.length > 0) {
          const localId = recsArr[0].local?.id;
          if (localId) {
            Promise.all([
              fetch(`/api/genie/extras?localId=${localId}&type=postres`).then(r => r.json()).catch(() => []),
              fetch(`/api/genie/extras?localId=${localId}&type=bebidas`).then(r => r.json()).catch(() => []),
            ]).then(([p, b]) => {
              setPostres(Array.isArray(p) ? p : []);
              setBebidas(Array.isArray(b) ? b : []);
            });
          }
        }
      } catch {}
      setLoading(false);
    };
    run();
  }, [router, user, refreshKey]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>🧞</p>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", color: "#666666" }}>El Genio esta pensando...</p>
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>🧞</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: "#0D0D0D", textAlign: "center", marginBottom: 12 }}>No encontre platos para ti</h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "#666666", textAlign: "center", marginBottom: 24 }}>Intenta con otras preferencias o vuelve cuando haya mas opciones.</p>
        <button onClick={() => router.push("/")} style={{ padding: "14px 28px", background: "#0D0D0D", color: "#FFD600", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer" }}>Intentar de nuevo</button>
      </div>
    );
  }

  const main = recs[0];
  const secondary = recs.slice(1);

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", padding: "clamp(20px,4vw,40px) clamp(16px,3vw,24px)" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        {/* Header with logo link */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <a href="/" style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 700, color: "#0D0D0D", textDecoration: "none" }}>🧞 QuieroComer</a>
          <a href="/" style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "#999", textDecoration: "none" }}>← Empezar de nuevo</a>
        </div>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.2rem,3.5vw,1.5rem)", color: "#0D0D0D", marginBottom: 4 }}>El Genio recomienda</h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "#666666" }}>Basado en tus gustos y el momento</p>
        </div>

        {/* Main recommendation */}
        <div style={{ background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 20, overflow: "hidden", marginBottom: 14 }}>
          {main.imagenUrl && (
            <img src={main.imagenUrl} alt={main.nombre} style={{ width: "100%", height: 220, objectFit: "cover" }} />
          )}
          <div style={{ padding: "16px 18px" }}>
            {/* Role label */}
            {main.role && (
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#666666", marginBottom: 6 }}>{main.role}</p>
            )}
            {/* Tags */}
            {main.tags?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {main.tags.map((t: string) => (
                  <span key={t} style={{ padding: "3px 10px", borderRadius: 99, background: "#EEEEEE", border: `1px solid ${TAG_COLORS[t] ?? "#FFD600"}33`, fontFamily: "var(--font-display)", fontSize: "0.65rem", color: TAG_COLORS[t] ?? "#FFD600", letterSpacing: "0.04em" }}>{t}</span>
                ))}
              </div>
            )}
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", color: "#0D0D0D", marginBottom: 4 }}>{main.nombre}</h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#666666", marginBottom: 8 }}>
              {main.local.nombre} · {main.distanceLabel ?? main.local.comuna}
              {main.avgRating != null && ` · ⭐ ${main.avgRating.toFixed(1)} (${main.totalRatings})`}
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#0D0D0D", marginBottom: 14 }}>${Number(main.precio).toLocaleString("es-CL")}</p>

            <button onClick={() => {
              localStorage.setItem("genieLastResultAt", String(Date.now()));
              if (main.local.lat && main.local.lng) {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${main.local.lat},${main.local.lng}`, "_blank");
              }
            }} style={{ width: "100%", padding: 14, background: "#0D0D0D", color: "#FFD600", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer" }}>
              Esto quiero →
            </button>
          </div>
        </div>

        {/* Secondary recommendations */}
        {secondary.map((rec: Rec) => (
          <div key={rec.id} style={{ background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, overflow: "hidden", marginBottom: 10, display: "flex" }}>
            {rec.imagenUrl && (
              <img src={rec.imagenUrl} alt={rec.nombre} style={{ width: 100, height: 100, objectFit: "cover", flexShrink: 0 }} />
            )}
            <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
              {rec.role && (
                <p style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666666", margin: "0 0 3px" }}>{rec.role}</p>
              )}
              {rec.tags?.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                  {rec.tags.slice(0, 2).map((t: string) => (
                    <span key={t} style={{ padding: "1px 6px", borderRadius: 99, background: "#EEEEEE", fontFamily: "var(--font-display)", fontSize: "0.55rem", color: TAG_COLORS[t] ?? "#FFD600" }}>{t}</span>
                  ))}
                </div>
              )}
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: "#0D0D0D", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.nombre}</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "#666666", margin: "0 0 4px" }}>{rec.local.nombre} · {rec.distanceLabel ?? rec.local.comuna}</p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#0D0D0D", margin: 0 }}>${Number(rec.precio).toLocaleString("es-CL")}</p>
            </div>
          </div>
        ))}

        {/* Bebidas */}
        {bebidas.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", letterSpacing: "0.12em", color: "#666666", marginBottom: 8 }}>PARA ACOMPAÑAR</p>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {bebidas.map((b: Rec) => (
                <div key={b.id} style={{ minWidth: 120, background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 12, padding: 10, textAlign: "center", flexShrink: 0 }}>
                  {b.imagenUrl && <img src={b.imagenUrl} alt="" style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 8, marginBottom: 6 }} />}
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "#0D0D0D", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.nombre}</p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", color: "#666666", margin: 0 }}>${Number(b.precio).toLocaleString("es-CL")}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Postres */}
        {postres.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", letterSpacing: "0.12em", color: "#666666", marginBottom: 8 }}>DESPUES DE COMER, VUELVE POR EL POSTRE 🍰</p>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {postres.map((p: Rec) => (
                <div key={p.id} style={{ minWidth: 120, background: "#F5F5F5", border: "1px solid rgba(236,72,153,0.1)", borderRadius: 12, padding: 10, textAlign: "center", flexShrink: 0 }}>
                  {p.imagenUrl && <img src={p.imagenUrl} alt="" style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 8, marginBottom: 6 }} />}
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "#0D0D0D", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", color: "#666666", margin: 0 }}>${Number(p.precio).toLocaleString("es-CL")}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <button onClick={() => { setRecs([]); setLoading(true); setPostres([]); setBebidas([]); setRefreshKey(k => k + 1); }} style={{ width: "100%", marginTop: 16, padding: 14, background: "transparent", border: "1px solid #E0E0E0", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#0D0D0D", cursor: "pointer" }}>
          Mostrar otras sugerencias
        </button>
      </div>
    </div>
  );
}
