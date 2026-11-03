"use client";
import { useState, useEffect } from "react";
import { Star, ExternalLink, Gift, Eye, Lock, CheckCheck, User, MessageSquare, Clock, Settings } from "lucide-react";
import { toast } from "sonner";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

const CARD = {
  background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
  borderRadius: 22, padding: "22px 20px", marginBottom: 12,
} as const;

const LABEL = {
  fontFamily: F, fontSize: "0.82rem", fontWeight: 800,
  color: "var(--adm-text3)", margin: "0 0 10px",
  textTransform: "uppercase" as const, letterSpacing: ".6px",
  display: "flex", alignItems: "center", gap: 6,
} as const;

const INPUT = {
  width: "100%", padding: "12px 14px", boxSizing: "border-box" as const,
  background: "rgba(255,255,255,.04)", border: "1px solid var(--adm-card-border)",
  borderRadius: 12, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.85rem",
  outline: "none",
} as const;

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 44, height: 24, borderRadius: 999, flexShrink: 0,
      background: on ? GOLD : "var(--adm-card-border)",
      border: "none", cursor: "pointer", position: "relative", transition: "background .2s",
    }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s",
      }} />
    </button>
  );
}

// ─── Tab: Configuración ───────────────────────────────────────────────────────

function TabConfiguracion({ rid, slug }: { rid: string; slug: string }) {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"google" | "private">("google");
  const [googleUrl, setGoogleUrl] = useState("");
  const [hasReward, setHasReward] = useState(false);
  const [reward, setReward] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/panel/me")
      .then(r => r.json())
      .then(d => {
        const r = d.restaurants?.[0];
        if (!r) return;
        const rm = r.reviewMode || "off";
        if (rm !== "off") { setEnabled(true); setMode(rm as "google" | "private"); }
        setGoogleUrl(r.googleReviewUrl || "");
        setReward(r.reviewReward || "");
        setHasReward(!!r.reviewReward);
      });
  }, [rid]);

  const effectiveMode = enabled ? mode : "off";
  const previewLabel = hasReward && reward.trim() ? "Comenta y gana" : mode === "private" ? "Déjanos tu opinión" : "Déjanos una reseña";
  const previewSub = hasReward && reward.trim() ? reward.trim()
    : mode === "google" ? "Nos ayuda mucho en Google" : "Tu opinión es privada y va directo al local";

  const handleSave = async () => {
    if (enabled && mode === "google" && !googleUrl.trim()) {
      toast.error("Agrega el link de Google antes de guardar");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/panel/valoraciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: rid,
          reviewMode: effectiveMode,
          googleReviewUrl: enabled && mode === "google" ? googleUrl.trim() || null : null,
          reviewReward: hasReward && reward.trim() ? reward.trim() : null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Guardado");
    } catch {
      toast.error("Error al guardar");
    }
    setSaving(false);
  };

  return (
    <>
      {/* Toggle maestro */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ ...LABEL, margin: "0 0 3px" }}><Star size={13} /> Mostrar botón de reseña</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0 }}>
              {enabled ? "Activo · El botón aparecerá en tu página" : "Desactivado · No se muestra ningún botón de reseña"}
            </p>
          </div>
          <Toggle on={enabled} onToggle={() => setEnabled(v => !v)} />
        </div>
      </div>

      {enabled && (
        <>
          <div style={CARD}>
            <h2 style={LABEL}>Tipo de reseña</h2>
            <div style={{ display: "flex", gap: 10 }}>
              {([["google", "🌐", "Google Reviews", "Públicas en Google Maps"], ["private", "🔒", "Reseña privada", "Solo tú las ves en el panel"]] as const).map(([val, icon, title, desc]) => (
                <button key={val} onClick={() => setMode(val)} style={{
                  flex: 1, padding: "14px 12px", borderRadius: 16, cursor: "pointer", textAlign: "left",
                  border: `2px solid ${mode === val ? GOLD : "var(--adm-card-border)"}`,
                  background: mode === val ? `${GOLD}10` : "rgba(255,255,255,.02)",
                }}>
                  <span style={{ fontSize: 20, display: "block", marginBottom: 6 }}>{icon}</span>
                  <span style={{ display: "block", fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 2 }}>{title}</span>
                  <span style={{ display: "block", fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)" }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {mode === "google" && (
            <div style={CARD}>
              <h2 style={LABEL}><ExternalLink size={13} /> Link de Google Reviews</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px" }}>
                Abre Google Maps, busca tu local, ve a <strong>Reseñas</strong> → <strong>Escribir una reseña</strong> y copia el link del navegador.
              </p>
              <input value={googleUrl} onChange={e => setGoogleUrl(e.target.value)}
                placeholder="https://maps.google.com/..." style={INPUT} />
            </div>
          )}

          {mode === "google" && (
            <div style={CARD}>
              <h2 style={LABEL}><ExternalLink size={13} /> ¿Cómo funciona?</h2>
              <p style={{ fontSize: "0.83rem", color: "var(--adm-text2)", margin: 0 }}>
                Al hacer clic, el cliente es llevado directamente a Google Maps donde puede dejar su reseña pública.
                Estas reseñas aparecen en tu ficha de Google y ayudan a tu posicionamiento.
              </p>
            </div>
          )}

          {mode === "private" && (
            <div style={CARD}>
              <h2 style={LABEL}><Lock size={13} /> Reseñas privadas</h2>
              <p style={{ fontSize: "0.83rem", color: "var(--adm-text2)", margin: "0 0 10px" }}>
                Los clientes van a tu página <strong>quierocomer.com/{slug || "tu-local"}</strong> y dejan su rating y comentario.
                Solo tú los ves en la pestaña <strong>Reseñas recibidas</strong>.
              </p>
              {slug && (
                <a href={`/${slug}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: "0.8rem", color: GOLD, textDecoration: "none" }}>
                  Ver tu página →
                </a>
              )}
            </div>
          )}

          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasReward ? 14 : 0 }}>
              <div>
                <h2 style={{ ...LABEL, margin: "0 0 3px" }}><Gift size={13} /> Ofrecer un premio</h2>
              </div>
              <Toggle on={hasReward} onToggle={() => setHasReward(v => !v)} />
            </div>
            {hasReward && (
              <input value={reward} onChange={e => setReward(e.target.value)}
                placeholder="Ej: Un café gratis en tu próxima visita" style={INPUT} />
            )}
          </div>

          <div style={CARD}>
            <h2 style={LABEL}><Eye size={13} /> Vista previa en tu página</h2>
            <div style={{ background: "#111", borderRadius: 14, padding: "14px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 14, padding: "14px 18px", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>⭐</span>
                <span>
                  <span style={{ display: "block", fontSize: "0.92rem", fontWeight: 700, lineHeight: 1.2 }}>{previewLabel}</span>
                  <span style={{ display: "block", fontSize: "0.72rem", color: "rgba(255,255,255,0.42)", marginTop: 2 }}>{previewSub}</span>
                </span>
              </div>
            </div>
            {slug && (
              <p style={{ fontSize: "0.78rem", color: "var(--adm-text3)", margin: "10px 0 0" }}>
                Aparecerá en{" "}
                <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: "none" }}>
                  quierocomer.com/{slug}
                </a>
              </p>
            )}
          </div>
        </>
      )}

      <button onClick={handleSave} disabled={saving} style={{
        padding: "12px 28px",
        background: `linear-gradient(135deg, #ffc44f, ${GOLD})`,
        color: "#100b03", border: "none", borderRadius: 999,
        fontFamily: F, fontSize: "0.88rem", fontWeight: 700,
        cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
      }}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </>
  );
}

// ─── Tab: Reseñas recibidas ───────────────────────────────────────────────────

interface Review {
  id: string; rating: number; comment: string | null;
  authorName: string | null; isRead: boolean; createdAt: string;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: 14, opacity: i <= rating ? 1 : 0.2 }}>⭐</span>
      ))}
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

function TabResenas({ rid }: { rid: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetch(`/api/panel/resenas?restaurantId=${rid}`)
      .then(r => r.json())
      .then(d => { setReviews(d.reviews || []); setUnread(d.unread || 0); })
      .finally(() => setLoading(false));
  }, [rid]);

  const markAllRead = async () => {
    if (unread === 0) return;
    setMarkingAll(true);
    await fetch("/api/panel/resenas", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: rid, markAllRead: true }),
    });
    setReviews(prev => prev.map(r => ({ ...r, isRead: true })));
    setUnread(0);
    setMarkingAll(false);
  };

  const markRead = async (id: string) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, isRead: true } : r));
    setUnread(prev => Math.max(0, prev - 1));
    await fetch("/api/panel/resenas", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  if (loading) return null;

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          {avg ? (
            <p style={{ fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0 }}>
              Promedio <strong style={{ color: "var(--adm-text)" }}>{avg}</strong> · {reviews.length} reseña{reviews.length !== 1 ? "s" : ""}
              {unread > 0 && <span style={{ marginLeft: 8, background: GOLD, color: "#0a0a0a", borderRadius: 999, padding: "1px 8px", fontSize: "0.75rem", fontWeight: 700 }}>{unread} nueva{unread !== 1 ? "s" : ""}</span>}
            </p>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--adm-text3)", margin: 0 }}>Todavía no tienes reseñas privadas.</p>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} disabled={markingAll} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 999, border: "1px solid var(--adm-card-border)",
            background: "var(--adm-card)", color: "var(--adm-text2)", fontFamily: FB,
            fontSize: "0.82rem", cursor: markingAll ? "default" : "pointer",
          }}>
            <CheckCheck size={14} /> Marcar todas como leídas
          </button>
        )}
      </div>

      {reviews.length === 0 ? (
        <div style={{ ...CARD, textAlign: "center", padding: "40px 20px" }}>
          <Star size={32} color="var(--adm-text3)" style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ color: "var(--adm-text2)", margin: 0 }}>Todavía no tienes reseñas privadas.</p>
          <p style={{ color: "var(--adm-text3)", fontSize: "0.82rem", margin: "6px 0 0" }}>
            Activa las reseñas privadas en <strong>Configuración</strong> para empezar a recibirlas.
          </p>
        </div>
      ) : (
        reviews.map(r => (
          <div key={r.id} onClick={() => !r.isRead && markRead(r.id)} style={{
            ...CARD, cursor: r.isRead ? "default" : "pointer",
            borderColor: !r.isRead ? `${GOLD}55` : "var(--adm-card-border)",
            background: !r.isRead ? `${GOLD}08` : "var(--adm-card)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: r.comment ? 10 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {!r.isRead && <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, flexShrink: 0, marginTop: 2 }} />}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <StarRow rating={r.rating} />
                    {r.authorName && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "var(--adm-text3)" }}>
                        <User size={11} /> {r.authorName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "var(--adm-text3)", whiteSpace: "nowrap", flexShrink: 0 }}>
                <Clock size={11} /> {timeAgo(r.createdAt)}
              </span>
            </div>
            {r.comment && (
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--adm-text)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <MessageSquare size={14} color="var(--adm-text3)" style={{ flexShrink: 0, marginTop: 2 }} />
                {r.comment}
              </p>
            )}
          </div>
        ))
      )}
    </>
  );
}

// ─── Página principal con tabs ────────────────────────────────────────────────

export default function ValoracionesPage() {
  const [rid, setRid] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [tab, setTab] = useState<"config" | "resenas">("config");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/panel/me")
      .then(r => r.json())
      .then(d => {
        const r = d.restaurants?.[0];
        if (!r) return;
        setRid(r.id);
        setSlug(r.slug || "");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const tabs: { key: "config" | "resenas"; label: string; icon: React.ReactNode }[] = [
    { key: "config", label: "Configuración", icon: <Settings size={14} /> },
    { key: "resenas", label: "Reseñas recibidas", icon: <MessageSquare size={14} /> },
  ];

  return (
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: FB }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
        <Star size={20} color="var(--adm-text3)" /> Valoraciones
      </h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 4 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px 12px", borderRadius: 11, border: "none", cursor: "pointer",
            fontFamily: F, fontSize: "0.84rem", fontWeight: 700,
            background: tab === t.key ? GOLD : "transparent",
            color: tab === t.key ? "#100b03" : "var(--adm-text2)",
            transition: "background .15s, color .15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {rid && tab === "config" && <TabConfiguracion rid={rid} slug={slug} />}
      {rid && tab === "resenas" && <TabResenas rid={rid} />}
    </div>
  );
}
