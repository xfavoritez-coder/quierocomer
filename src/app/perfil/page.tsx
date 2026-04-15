"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

const DIET_TYPES = [
  { v: "como de todo", l: "Como de todo" },
  { v: "vegetariano", l: "Vegetariano" },
  { v: "vegano", l: "Vegano" },
  { v: "pescetariano", l: "Pescetariano" },
];
const RESTRICTIONS = [
  { v: "sin gluten", l: "Sin gluten" },
  { v: "sin mariscos", l: "Sin mariscos" },
  { v: "sin frutos secos", l: "Sin frutos secos" },
  { v: "sin lácteos", l: "Sin lácteos" },
  { v: "sin cerdo", l: "Sin cerdo" },
];
const FITNESS = [
  { v: "NONE", emoji: "🍔", l: "Modo chancho", sub: "Sin restricciones, como lo que sea" },
  { v: "GAINING", emoji: "💪", l: "Subiendo masa", sub: "Prioriza calorías y proteína" },
  { v: "CUTTING", emoji: "🥗", l: "Cuidándome", sub: "Bajo en carbs, alto en proteína" },
  { v: "MAINTAINING", emoji: "😐", l: "Sin preferencia", sub: "No influye en las sugerencias" },
];
const RISK = [
  { v: "SAFE", emoji: "🎯", l: "Lo conocido", sub: "Platos que ya sé que me gustan" },
  { v: "BALANCED", emoji: "⚖️", l: "Mezcla", sub: "Algo conocido y algo nuevo" },
  { v: "EXPLORER", emoji: "🧭", l: "Probar nuevo", sub: "Sorpréndeme con cosas distintas" },
];

export default function GeniePerfil() {
  const { user, isLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const initialized = useRef(false);

  const guestName = typeof window !== "undefined" ? localStorage.getItem("genieUserName") : null;
  const displayName = user?.nombre || guestName || "Invitado";
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  const [learned, setLearned] = useState<{ categories: {name: string, count: number}[]; ingredients: {name: string, count: number}[]; locals: {name: string, count: number}[]; totalSelections: number } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user?.id) {
      try {
        const raw = localStorage.getItem("genieOnboardingData");
        if (raw) {
          const data = JSON.parse(raw);
          setProfile({
            dietType: data.dietType ?? "como de todo",
            dietaryRestrictions: data.dietaryRestrictions ?? [],
            fitnessMode: data.fitnessMode ?? null,
            riskProfile: data.riskProfile ?? "BALANCED",
            favoriteIngredients: [],
            avoidIngredients: [],
          });
        }
      } catch {}
      setLoading(false);
      return;
    }
    fetch(`/api/perfil/preferencias?userId=${user.id}`)
      .then(r => r.json())
      .then(prof => { setProfile(prof); setLoading(false); initialized.current = true; });
  }, [user, isLoading]);

  // Fetch learned data from interactions
  useEffect(() => {
    const sid = typeof window !== "undefined" ? localStorage.getItem("genie_session_id") : null;
    if (!sid && !user?.id) return;
    const params = new URLSearchParams();
    if (user?.id) params.set("userId", user.id);
    if (sid) params.set("sessionId", sid);
    fetch(`/api/genie/learned?${params}`)
      .then(r => r.json())
      .then(d => setLearned(d))
      .catch(() => {});
  }, [user]);

  const save = (data: Record<string, unknown>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (user) {
        fetch(`/api/perfil/preferencias?userId=${user.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }).then(() => { setToast("Guardado 🧞"); setTimeout(() => setToast(""), 2000); });
      } else {
        try {
          const raw = localStorage.getItem("genieOnboardingData");
          const current = raw ? JSON.parse(raw) : {};
          localStorage.setItem("genieOnboardingData", JSON.stringify({ ...current, ...data }));
          setToast("Guardado 🧞"); setTimeout(() => setToast(""), 2000);
        } catch {}
      }
    }, 500);
  };

  const toggleRestriction = (v: string) => {
    const current = profile?.dietaryRestrictions ?? [];
    let next = current.includes(v) ? current.filter((x: string) => x !== v) : [...current, v];
    setProfile((p: any) => ({ ...p, dietaryRestrictions: next }));
    save({ dietaryRestrictions: next });
  };

  const resetAll = () => {
    if (!confirm("¿Seguro? Se borrarán todas tus preferencias y tendrás que empezar de nuevo.")) return;
    localStorage.removeItem("genieOnboardingDone");
    localStorage.removeItem("genieOnboardingData");
    localStorage.removeItem("genieUserName");
    localStorage.removeItem("genie_session_id");
    sessionStorage.clear();
    window.location.href = "/";
  };

  const chip = (active: boolean): React.CSSProperties => ({
    padding: "10px 14px", borderRadius: 99, cursor: "pointer",
    background: active ? "rgba(255,214,0,0.12)" : "#F5F5F5",
    border: active ? "2px solid #FFD600" : "1px solid #E0E0E0",
    fontSize: "0.82rem", color: "#0D0D0D", fontWeight: active ? 600 : 400,
  });

  const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#0D0D0D", letterSpacing: "1px", marginBottom: 10,
  };

  if (loading) return <div style={{ minHeight: "100vh", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#999" }}>Cargando...</p></div>;

  return (
    <div style={{ padding: "clamp(20px,4vw,40px) clamp(16px,3vw,24px) 100px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "#3db89e", color: "#fff", padding: "10px 20px", borderRadius: 99, fontSize: "0.82rem", zIndex: 100 }}>{toast}</div>}

        {/* Avatar + Name */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {user ? (
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FFD600", color: "#0D0D0D", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, margin: "0 auto 8px" }}>{initials}</div>
          ) : (
            <p style={{ fontSize: 40, marginBottom: 4 }}>👤</p>
          )}
          <h1 className="font-display" style={{ fontSize: "1.3rem", color: "#0D0D0D", marginBottom: 2 }}>
            {displayName}
          </h1>
          {!user && guestName && (
            <p className="font-body" style={{ fontSize: "0.75rem", color: "#AAAAAA", marginBottom: 4 }}>Invitado</p>
          )}
        </div>

        {/* Crear cuenta — moved to top for guests */}
        {!user && (
          <div style={{ background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, padding: 20, textAlign: "center", marginBottom: 16 }}>
            <p className="font-body" style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.6, marginBottom: 14 }}>Crea una cuenta para que el Genio recuerde tus gustos</p>
            <Link href="/registro" style={{ display: "inline-block", padding: "14px 28px", background: "#FFD600", color: "#0D0D0D", borderRadius: 99, fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}>Crear cuenta gratis</Link>
          </div>
        )}

        {profile && (
          <>
            {/* Diet type */}
            <section style={{ marginBottom: 24 }}>
              <h2 className="font-display" style={sectionTitle}>TIPO DE ALIMENTACIÓN</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DIET_TYPES.map(d => (
                  <button key={d.v} onClick={() => { setProfile((p: any) => ({ ...p, dietType: d.v })); save({ dietType: d.v }); }} style={chip(profile.dietType === d.v || (profile.dietaryRestrictions ?? []).includes(d.v))}>
                    {d.l}
                  </button>
                ))}
              </div>
            </section>

            {/* Restrictions */}
            <section style={{ marginBottom: 24 }}>
              <h2 className="font-display" style={sectionTitle}>ALERGIAS O RESTRICCIONES</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => { setProfile((p: any) => ({ ...p, dietaryRestrictions: [] })); save({ dietaryRestrictions: [] }); }} style={chip((profile.dietaryRestrictions ?? []).length === 0)}>
                  Ninguna
                </button>
                {RESTRICTIONS.map(r => (
                  <button key={r.v} onClick={() => toggleRestriction(r.v)} style={chip((profile.dietaryRestrictions ?? []).includes(r.v))}>
                    {r.l}
                  </button>
                ))}
              </div>
            </section>

            {/* Fitness */}
            <section style={{ marginBottom: 24 }}>
              <h2 className="font-display" style={sectionTitle}>MODO ACTUAL</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {FITNESS.map(f => {
                  const active = profile.fitnessMode === f.v || (!profile.fitnessMode && f.v === "NONE");
                  return (
                    <button key={f.v} onClick={() => { setProfile((p: any) => ({ ...p, fitnessMode: f.v })); save({ fitnessMode: f.v === "NONE" ? null : f.v }); }} style={{ ...chip(active), display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                      <span style={{ fontSize: 20 }}>{f.emoji}</span>
                      <div>
                        <span style={{ display: "block", fontWeight: active ? 700 : 500 }}>{f.l}</span>
                        <span style={{ fontSize: "0.72rem", color: "#999" }}>{f.sub}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Risk profile */}
            <section style={{ marginBottom: 24 }}>
              <h2 className="font-display" style={sectionTitle}>CÓMO ERES PARA COMER</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {RISK.map(r => {
                  const active = profile.riskProfile === r.v;
                  return (
                    <button key={r.v} onClick={() => { setProfile((p: any) => ({ ...p, riskProfile: r.v })); save({ riskProfile: r.v }); }} style={{ ...chip(active), display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                      <span style={{ fontSize: 20 }}>{r.emoji}</span>
                      <div>
                        <span style={{ display: "block", fontWeight: active ? 700 : 500 }}>{r.l}</span>
                        <span style={{ fontSize: "0.72rem", color: "#999" }}>{r.sub}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Lo que el genio aprendió */}
            <section style={{ marginBottom: 24 }}>
              <h2 className="font-display" style={sectionTitle}>LO QUE EL GENIO APRENDIÓ DE TI</h2>
              {!user ? (
                <div style={{ background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, padding: "24px 16px", position: "relative", overflow: "hidden" }}>
                  {/* Blurred fake data */}
                  <div style={{ filter: "blur(6px)", opacity: 0.3, pointerEvents: "none" }}>
                    <p style={{ fontSize: 11, color: "#666", fontWeight: 700, marginBottom: 6 }}>Te interesa</p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={{ padding: "3px 8px", borderRadius: 99, background: "#E0E0E0", fontSize: "0.72rem", color: "#999" }}>Sushi (5)</span>
                      <span style={{ padding: "3px 8px", borderRadius: 99, background: "#E0E0E0", fontSize: "0.72rem", color: "#999" }}>Pizza (3)</span>
                      <span style={{ padding: "3px 8px", borderRadius: 99, background: "#E0E0E0", fontSize: "0.72rem", color: "#999" }}>Pasta (2)</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#3db89e", fontWeight: 700, marginBottom: 6 }}>Ingredientes que eliges</p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <span style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(61,184,158,0.1)", fontSize: "0.72rem", color: "#3db89e" }}>Palta</span>
                      <span style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(61,184,158,0.1)", fontSize: "0.72rem", color: "#3db89e" }}>Salmón</span>
                      <span style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(61,184,158,0.1)", fontSize: "0.72rem", color: "#3db89e" }}>Queso</span>
                    </div>
                  </div>
                  {/* Overlay with CTA */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(245,245,245,0.6)" }}>
                    <p className="font-body" style={{ fontSize: "0.85rem", color: "#0D0D0D", marginBottom: 12, fontWeight: 500 }}>Regístrate para ver qué aprendió el Genio de ti</p>
                    <Link href="/registro" style={{ display: "inline-block", padding: "12px 28px", background: "#FFD600", color: "#0D0D0D", borderRadius: 99, fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>Crear cuenta gratis</Link>
                  </div>
                </div>
              ) : (
              <div style={{ background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, padding: 14 }}>
                {(() => {
                  const hasProfileData = (profile.favoriteIngredients?.length > 0 || profile.avoidIngredients?.length > 0);
                  const hasLearned = learned && learned.totalSelections > 0;
                  let onboardingDiet: string | null = null;
                  try {
                    const raw = typeof window !== "undefined" ? localStorage.getItem("genieOnboardingData") : null;
                    if (raw) {
                      const data = JSON.parse(raw);
                      if (data.dietType && data.dietType !== "como de todo") onboardingDiet = data.dietType;
                    }
                  } catch {}
                  if (!hasProfileData && !hasLearned && !onboardingDiet) {
                    return <p className="font-body" style={{ fontSize: "0.82rem", color: "#999", textAlign: "center", lineHeight: 1.6 }}>Usa el Genio más veces para que aprenda tus gustos</p>;
                  }

                  const CAT_LABELS: Record<string, string> = { SUSHI: "Sushi", PIZZA: "Pizza", MAIN_COURSE: "Plato de fondo", STARTER: "Entrada", COMBO: "Combo", PASTA: "Pasta", BURGER: "Hamburguesa", SANDWICH: "Sándwich", SALAD: "Ensalada", DESSERT: "Postre", BREAKFAST: "Desayuno", WOK: "Wok", SEAFOOD: "Mariscos", VEGAN: "Vegano", VEGETARIAN: "Vegetariano" };

                  return (
                    <>
                      {onboardingDiet && (
                        <div style={{ marginBottom: 10 }}>
                          <p className="font-display" style={{ fontSize: 11, color: "#666", marginBottom: 6, fontWeight: 700 }}>Tu estilo</p>
                          <span style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(255,214,0,0.12)", border: "1px solid rgba(255,214,0,0.3)", fontSize: "0.72rem", color: "#0D0D0D" }}>{onboardingDiet.charAt(0).toUpperCase() + onboardingDiet.slice(1)}</span>
                        </div>
                      )}
                      {hasLearned && learned!.categories.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <p className="font-display" style={{ fontSize: 11, color: "#0D0D0D", marginBottom: 6, fontWeight: 700 }}>Te interesa</p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {learned!.categories.map(c => (
                              <span key={c.name} style={{ padding: "3px 8px", borderRadius: 99, background: "#F5F5F5", border: "1px solid #E0E0E0", fontSize: "0.72rem", color: "#0D0D0D" }}>{CAT_LABELS[c.name] ?? c.name} ({c.count})</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {hasLearned && learned!.ingredients.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <p className="font-display" style={{ fontSize: 11, color: "#3db89e", marginBottom: 6, fontWeight: 700 }}>Ingredientes que eliges</p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {learned!.ingredients.slice(0, 6).map(i => (
                              <span key={i.name} style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(61,184,158,0.1)", border: "1px solid rgba(61,184,158,0.2)", fontSize: "0.72rem", color: "#3db89e" }}>{i.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {hasLearned && learned!.locals.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <p className="font-display" style={{ fontSize: 11, color: "#666", marginBottom: 6, fontWeight: 700 }}>Locales que te atraen</p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {learned!.locals.map(l => (
                              <span key={l.name} style={{ padding: "3px 8px", borderRadius: 99, background: "#F5F5F5", border: "1px solid #E0E0E0", fontSize: "0.72rem", color: "#666" }}>{l.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {profile.favoriteIngredients?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <p className="font-display" style={{ fontSize: 11, color: "#3db89e", marginBottom: 6, fontWeight: 700 }}>Te gusta</p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {profile.favoriteIngredients.slice(0, 8).map((i: string) => (
                              <span key={i} style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(61,184,158,0.1)", border: "1px solid rgba(61,184,158,0.2)", fontSize: "0.72rem", color: "#3db89e" }}>{i}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {profile.avoidIngredients?.length > 0 && (
                        <div>
                          <p className="font-display" style={{ fontSize: 11, color: "#ff6b6b", marginBottom: 6, fontWeight: 700 }}>Evita</p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {profile.avoidIngredients.slice(0, 8).map((i: string) => (
                              <span key={i} style={{ padding: "3px 8px", borderRadius: 99, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", fontSize: "0.72rem", color: "#ff6b6b" }}>{i}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              )}
            </section>
          </>
        )}

        {/* Reset */}
        <button onClick={resetAll} style={{ width: "100%", padding: 14, background: "transparent", border: "1px solid #E0E0E0", borderRadius: 99, fontSize: "0.78rem", color: "#999", cursor: "pointer" }}>
          Resetear todo y empezar de nuevo
        </button>
      </div>
    </div>
  );
}
