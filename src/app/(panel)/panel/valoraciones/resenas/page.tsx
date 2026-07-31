"use client";
import { useState, useEffect } from "react";
import { Star, CheckCheck, User, MessageSquare, Clock } from "lucide-react";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

const CARD = {
  background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
  borderRadius: 22, padding: "20px", marginBottom: 10,
} as const;

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string | null;
  isRead: boolean;
  createdAt: string;
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

export default function ResenasPage() {
  const [rid, setRid] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetch("/api/panel/me")
      .then(r => r.json())
      .then(d => {
        const r = d.restaurants?.[0];
        if (!r) return;
        setRid(r.id);
        return fetch(`/api/panel/resenas?restaurantId=${r.id}`);
      })
      .then(res => res?.json())
      .then(d => {
        if (!d) return;
        setReviews(d.reviews || []);
        setUnread(d.unread || 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    if (!rid || unread === 0) return;
    setMarkingAll(true);
    await fetch("/api/panel/resenas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  if (loading) return null;

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: FB }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <Star size={20} color="var(--adm-text3)" /> Reseñas recibidas
          </h1>
          {avg && (
            <p style={{ fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0 }}>
              Promedio <strong style={{ color: "var(--adm-text)" }}>{avg}</strong> · {reviews.length} reseña{reviews.length !== 1 ? "s" : ""}
              {unread > 0 && <span style={{ marginLeft: 8, background: GOLD, color: "#0a0a0a", borderRadius: 999, padding: "1px 8px", fontSize: "0.75rem", fontWeight: 700 }}>{unread} nueva{unread !== 1 ? "s" : ""}</span>}
            </p>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} disabled={markingAll} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 999, border: "1px solid var(--adm-card-border)",
            background: "var(--adm-card)", color: "var(--adm-text2)", fontFamily: FB,
            fontSize: "0.82rem", cursor: markingAll ? "default" : "pointer",
          }}>
            <CheckCheck size={14} />
            Marcar todas como leídas
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
          <div
            key={r.id}
            onClick={() => !r.isRead && markRead(r.id)}
            style={{
              ...CARD,
              cursor: r.isRead ? "default" : "pointer",
              borderColor: !r.isRead ? `${GOLD}55` : "var(--adm-card-border)",
              background: !r.isRead ? `${GOLD}08` : "var(--adm-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: r.comment ? 10 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {!r.isRead && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, flexShrink: 0, marginTop: 2 }} />
                )}
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
    </div>
  );
}
