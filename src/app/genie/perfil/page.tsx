"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

const RESTRICTIONS = [
  { v: "sin gluten", l: "Sin gluten" }, { v: "vegetariano", l: "Vegetariano" },
  { v: "vegano", l: "Vegano" }, { v: "sin mariscos", l: "Sin mariscos" },
  { v: "sin cerdo", l: "Sin cerdo" }, { v: "sin lácteos", l: "Sin lacteos" },
  { v: "sin frutos secos", l: "Sin frutos secos" }, { v: "como de todo", l: "Como de todo" },
];
const FITNESS = [
  { v: "NONE", emoji: "🍔", l: "Modo chancho" }, { v: "GAINING", emoji: "💪", l: "Subiendo masa" },
  { v: "CUTTING", emoji: "🥗", l: "Cuidandome" }, { v: "MAINTAINING", emoji: "😐", l: "Sin preferencia" },
];
const RISK = [
  { v: "SAFE", emoji: "🎯", l: "Lo conocido" }, { v: "BALANCED", emoji: "⚖️", l: "Mezcla" },
  { v: "EXPLORER", emoji: "🧭", l: "Probar nuevo" },
];

export default function GeniePerfil() {
  const { user, isLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    const uid = user?.id;
    if (!uid) {
      // Guest: load from localStorage
      try {
        const raw = localStorage.getItem("genieOnboardingData");
        if (raw) {
          const data = JSON.parse(raw);
          setProfile({
            dietaryRestrictions: data.dietaryRestrictions ?? [],
            fitnessMode: data.fitnessMode ?? null,
            riskProfile: "BALANCED",
            favoriteIngredients: [],
            avoidIngredients: [],
            onboardingDone: true,
          });
        }
      } catch {}
      setLoading(false);
      return;
    }
    fetch(`/api/perfil/preferencias?userId=${uid}`)
      .then(r => r.json())
      .then(prof => {
        setProfile(prof);
        setLoading(false);
        initialized.current = true;
      });
  }, [user, isLoading]);

  const save = (data: Record<string, unknown>) => {
    if (!initialized.current && !profile) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (user) {
        fetch(`/api/perfil/preferencias?userId=${user.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }).then(() => { setToast("Guardado 🧞"); setTimeout(() => setToast(""), 2000); });
      } else {
        // Guest: save to localStorage
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
    let next: string[];
    if (v === "como de todo") next = ["como de todo"];
    else {
      next = current.filter((x: string) => x !== "como de todo");
      next = next.includes(v) ? next.filter((x: string) => x !== v) : [...next, v];
    }
    setProfile((p: any) => ({ ...p, dietaryRestrictions: next }));
    save({ dietaryRestrictions: next.includes("como de todo") ? [] : next });
  };

  const chip = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px", borderRadius: 10, cursor: "pointer",
    background: active ? "rgba(232,168,76,0.12)" : "rgba(255,255,255,0.03)",
    border: active ? "1px solid #e8a84c" : "1px solid rgba(255,255,255,0.06)",
    fontFamily: "var(--font-lato)", fontSize: "0.82rem",
    color: active ? "#e8a84c" : "rgba(240,234,214,0.5)",
  });

  if (loading) return <div style={{ minHeight: "100vh", background: "#0a0812", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ fontFamily: "var(--font-cinzel)", color: "rgba(240,234,214,0.4)" }}>Cargando...</p></div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0812", padding: "clamp(20px,4vw,40px) clamp(16px,3vw,24px) 80px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "#3db89e", color: "#fff", padding: "10px 20px", borderRadius: 10, fontFamily: "var(--font-cinzel)", fontSize: "0.82rem", zIndex: 100 }}>{toast}</div>}

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontSize: 32, marginBottom: 4 }}>👤</p>
          <h1 style={{ fontFamily: "var(--font-cinzel-decorative)", fontSize: "clamp(1.2rem,3.5vw,1.5rem)", color: "#f5d080", marginBottom: 4 }}>
            {user ? user.nombre : "Invitado"}
          </h1>
          {!user && (
            <Link href="/login" style={{ fontFamily: "var(--font-lato)", fontSize: "0.82rem", color: "#e8a84c", textDecoration: "underline" }}>
              Crear cuenta para guardar tus gustos
            </Link>
          )}
        </div>

        {profile && (
          <>
            {/* Restricciones */}
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.75rem", color: "#e8a84c", letterSpacing: "0.1em", marginBottom: 10 }}>QUE NO COMES</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {RESTRICTIONS.map(r => (
                  <button key={r.v} onClick={() => toggleRestriction(r.v)} style={chip((profile.dietaryRestrictions ?? []).includes(r.v))}>
                    {r.l}
                  </button>
                ))}
              </div>
            </section>

            {/* Fitness */}
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.75rem", color: "#e8a84c", letterSpacing: "0.1em", marginBottom: 10 }}>MODO ACTUAL</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {FITNESS.map(f => (
                  <button key={f.v} onClick={() => { setProfile((p: any) => ({ ...p, fitnessMode: f.v })); save({ fitnessMode: f.v === "NONE" ? null : f.v }); }} style={chip(profile.fitnessMode === f.v)}>
                    {f.emoji} {f.l}
                  </button>
                ))}
              </div>
            </section>

            {/* Risk profile */}
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.75rem", color: "#e8a84c", letterSpacing: "0.1em", marginBottom: 10 }}>COMO ERES PARA COMER</h2>
              <div style={{ display: "flex", gap: 6 }}>
                {RISK.map(r => (
                  <button key={r.v} onClick={() => { setProfile((p: any) => ({ ...p, riskProfile: r.v })); save({ riskProfile: r.v }); }} style={{ ...chip(profile.riskProfile === r.v), flex: 1, textAlign: "center" }}>
                    {r.emoji}<br/>{r.l}
                  </button>
                ))}
              </div>
            </section>

            {/* Lo que el genio aprendió */}
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.75rem", color: "#e8a84c", letterSpacing: "0.1em", marginBottom: 10 }}>LO QUE EL GENIO APRENDIO</h2>
              <div style={{ background: "rgba(45,26,8,0.5)", border: "1px solid rgba(232,168,76,0.1)", borderRadius: 14, padding: 14 }}>
                {(profile.favoriteIngredients?.length > 0 || profile.avoidIngredients?.length > 0) ? (
                  <>
                    {profile.favoriteIngredients?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.68rem", color: "#3db89e", marginBottom: 6 }}>Te gusta</p>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {profile.favoriteIngredients.slice(0, 8).map((i: string) => (
                            <span key={i} style={{ padding: "3px 8px", borderRadius: 8, background: "rgba(61,184,158,0.1)", border: "1px solid rgba(61,184,158,0.2)", fontFamily: "var(--font-lato)", fontSize: "0.72rem", color: "#3db89e" }}>{i}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {profile.avoidIngredients?.length > 0 && (
                      <div>
                        <p style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.68rem", color: "#ff6b6b", marginBottom: 6 }}>Evita</p>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {profile.avoidIngredients.slice(0, 8).map((i: string) => (
                            <span key={i} style={{ padding: "3px 8px", borderRadius: 8, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", fontFamily: "var(--font-lato)", fontSize: "0.72rem", color: "#ff6b6b" }}>{i}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.82rem", color: "rgba(240,234,214,0.3)", textAlign: "center", lineHeight: 1.6 }}>Aun no tenemos suficiente info. Sigue usando el Genio 🧞</p>
                )}
              </div>
            </section>
          </>
        )}

        {!user && (
          <div style={{ background: "rgba(45,26,8,0.5)", border: "1px solid rgba(232,168,76,0.1)", borderRadius: 14, padding: 20, textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.88rem", color: "rgba(240,234,214,0.45)", lineHeight: 1.6, marginBottom: 16 }}>Crea una cuenta para que el Genio recuerde tus gustos entre sesiones</p>
            <Link href="/registro" style={{ display: "inline-block", padding: "12px 28px", background: "#e8a84c", color: "#0a0812", borderRadius: 12, fontFamily: "var(--font-cinzel)", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" }}>Crear cuenta gratis</Link>
          </div>
        )}
      </div>
    </div>
  );
}
