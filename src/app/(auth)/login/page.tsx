"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";

function OjoIcon({ visible }: { visible: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(245,208,128,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {visible ? (<><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>) : (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>)}
    </svg>
  );
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}

function LoginContent() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailNoVerificado, setEmailNoVerificado] = useState(false);
  const [reenvioSent, setReenvioSent] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [recEmail, setRecEmail] = useState("");
  const [recCode, setRecCode] = useState("");
  const [recPass, setRecPass] = useState("");
  const [recConfirm, setRecConfirm] = useState("");
  const [recStep, setRecStep] = useState<"email" | "code">("email");
  const [recMsg, setRecMsg] = useState("");
  const [recError, setRecError] = useState("");
  const [recLoading, setRecLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Ingresa tu email.");
    if (!password) return setError("Ingresa tu contraseña.");
    setLoading(true);
    const res = await login(email.trim(), password, remember);
    setLoading(false);
    if (res.success) router.push(nextUrl);
    else {
      setError(res.error ?? "Error al iniciar sesión.");
      if (res.codigo === "EMAIL_NO_VERIFICADO") setEmailNoVerificado(true);
    }
  };

  return (
    <main style={{ background: "var(--bg-primary)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "20px 24px" }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-display)", fontSize: "0.72rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(240,234,214,0.3)", textDecoration: "none", marginBottom: "24px", alignSelf: "center", maxWidth: "400px", width: "100%" }}>← Volver al inicio</Link>

      <div style={cardS}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <Link href="/" style={{ fontSize: "2rem", marginBottom: "8px", display: "block", textDecoration: "none" }}>🧞</Link>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", color: "var(--accent)", letterSpacing: "0.2em" }}>QuieroComer</p>
        </div>

        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem, 5vw, 1.8rem)", color: "var(--accent)", marginBottom: "8px" }}>Bienvenido</h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "28px" }}>¿No tienes cuenta? <Link href="/registro" style={{ color: "var(--oasis-bright)", fontWeight: 700, textDecoration: "none" }}>Regístrate gratis →</Link></p>

        {error && (
          <div style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#ff6b6b", marginBottom: emailNoVerificado ? "10px" : 0 }}>⚠️ {error}</p>
            {emailNoVerificado && !reenvioSent && (
              <button onClick={async () => { await fetch("/api/emails/verificacion-reenvio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase() }) }).catch(() => {}); setReenvioSent(true); }} style={{ background: "none", border: "1px solid rgba(61,184,158,0.4)", borderRadius: "8px", padding: "8px 14px", color: "#3db89e", fontFamily: "var(--font-display)", fontSize: "0.78rem", cursor: "pointer", width: "100%" }}>Reenviar email de verificación</button>
            )}
            {reenvioSent && <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "#3db89e", marginTop: "6px" }}>✓ Email reenviado. Revisa tu bandeja.</p>}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div><label style={labelS}>Email</label><input style={inputS} type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} onFocus={focusIn} onBlur={focusOut} /></div>
          <div><label style={labelS}>Contraseña</label><div style={{ position: "relative" }}><input style={{ ...inputS, paddingRight: "48px" }} type={showPw ? "text" : "password"} placeholder="Tu contraseña" value={password} onChange={e => setPassword(e.target.value)} onFocus={focusIn} onBlur={focusOut} /><button type="button" onClick={() => setShowPw(s => !s)} style={eyeS}><OjoIcon visible={showPw} /></button></div></div>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ accentColor: "var(--accent)", width: "18px", height: "18px" }} /><span style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--text-muted)" }}>Recordarme</span></label>
          <button type="submit" disabled={loading} style={btnS}>{loading ? "Entrando..." : "Entrar →"}</button>
        </form>

        <button onClick={() => { setRecovery(true); setRecStep("email"); setRecEmail(""); setRecCode(""); setRecPass(""); setRecConfirm(""); setRecMsg(""); setRecError(""); }} style={{ display: "block", width: "100%", textAlign: "center", marginTop: "14px", fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>¿Olvidaste tu contraseña?</button>

        {recovery && (<>
          <div onClick={() => setRecovery(false)} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "90%", maxWidth: "400px", zIndex: 1000, background: "rgba(13,7,3,0.98)", border: "1px solid rgba(232,168,76,0.4)", borderRadius: "20px", padding: "32px 24px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "var(--accent)", marginBottom: "16px", textAlign: "center" }}>Recuperar contraseña</h3>
            {recMsg && <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "#3db89e", marginBottom: "12px", textAlign: "center" }}>{recMsg}</p>}
            {recError && <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "#ff6b6b", marginBottom: "12px", textAlign: "center" }}>{recError}</p>}

            {recStep === "email" && (<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>Ingresa el email con el que te registraste. Te enviaremos un código de verificación.</p>
              <input style={inputS} type="email" placeholder="tu@email.com" value={recEmail} onChange={e => setRecEmail(e.target.value)} />
              <button disabled={recLoading || !recEmail.trim()} onClick={async () => {
                setRecLoading(true); setRecError(""); setRecMsg("");
                try {
                  const res = await fetch("/api/auth/recuperar-password-usuario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: recEmail.trim().toLowerCase(), action: "enviar" }) });
                  if (res.ok) { setRecStep("code"); setRecMsg("Código enviado a tu email"); }
                  else { const d = await res.json(); setRecError(d.error === "No encontramos una cuenta con ese email" ? d.error : d.error ?? "Error al enviar"); }
                } catch { setRecError("Error de conexión"); }
                setRecLoading(false);
              }} style={btnS}>{recLoading ? "Enviando..." : "Enviar código"}</button>
            </div>)}

            {recStep === "code" && (<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <input style={inputS} placeholder="Código de 6 dígitos" value={recCode} onChange={e => setRecCode(e.target.value)} maxLength={6} />
              <input style={inputS} type="password" placeholder="Nueva contraseña (mín. 8 caracteres)" value={recPass} onChange={e => setRecPass(e.target.value)} />
              <input style={inputS} type="password" placeholder="Confirmar contraseña" value={recConfirm} onChange={e => setRecConfirm(e.target.value)} />
              {recPass && recConfirm && recPass !== recConfirm && <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#ff6b6b" }}>Las contraseñas no coinciden</p>}
              <button disabled={recLoading || recCode.length !== 6 || recPass.length < 8 || recPass !== recConfirm} onClick={async () => {
                setRecLoading(true); setRecError(""); setRecMsg("");
                try {
                  const res = await fetch("/api/auth/recuperar-password-usuario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: recEmail.trim().toLowerCase(), action: "verificar", codigo: recCode, passNueva: recPass }) });
                  if (res.ok) { setRecMsg("Contraseña actualizada. Ya puedes iniciar sesión."); setTimeout(() => setRecovery(false), 2000); }
                  else { const d = await res.json(); setRecError(d.error ?? "Error"); }
                } catch { setRecError("Error de conexión"); }
                setRecLoading(false);
              }} style={btnS}>{recLoading ? "Verificando..." : "Cambiar contraseña"}</button>
            </div>)}

            <button onClick={() => setRecovery(false)} style={{ display: "block", width: "100%", textAlign: "center", marginTop: "14px", fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Cancelar</button>
          </div>
        </>)}

        {/* Separator */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}><div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} /><span style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "rgba(240,234,214,0.2)" }}>¿Eres un local?</span><div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} /></div>

        <Link href="/login-local" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "11px", background: "transparent", border: "1px solid rgba(232,168,76,0.12)", borderRadius: "10px", fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "rgba(240,234,214,0.4)", textDecoration: "none" }}>🏪 Acceso para locales asociados →</Link>
      </div>
    </main>
  );
}

const cardS: React.CSSProperties = { width: "100%", maxWidth: "400px", background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(232,168,76,0.15)", borderRadius: "20px", padding: "clamp(28px, 5vw, 40px) clamp(20px, 5vw, 32px)" };
const labelS: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(240,234,214,0.35)", marginBottom: "6px", display: "block" };
const inputS: React.CSSProperties = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(232,168,76,0.15)", borderRadius: "10px", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: "1rem", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" };
const btnS: React.CSSProperties = { width: "100%", padding: "14px", background: "var(--accent)", border: "none", borderRadius: "12px", fontFamily: "var(--font-display)", fontSize: "0.85rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--bg-primary)", fontWeight: 700, cursor: "pointer", marginTop: "8px", transition: "opacity 0.2s" };
const eyeS: React.CSSProperties = { position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1rem" };
const focusIn = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = "var(--accent)"; };
const focusOut = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = "rgba(232,168,76,0.15)"; };
