"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { Star } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";
const GREEN = "#16a34a";
const RED = "#ef4444";
const BLUE = "#7fbfdc";

type Answer = { id: string; text: string; v: number };
type SurveyRow = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  orderId: string | null;
  orderNumber: number | null;
  customerName: string | null;
  comment: string | null;
  createdAt: string;
  answers: Answer[];
};
type Average = { id: string; text: string; avg: number; count: number };
type RestaurantOption = { id: string; name: string };

function starColor(v: number) {
  if (v >= 4) return GREEN;
  if (v >= 3) return GOLD;
  return RED;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Stars({ v }: { v: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={12} color={i <= v ? GOLD : "var(--adm-card-border)"} fill={i <= v ? GOLD : "transparent"} />
      ))}
      <span style={{ fontFamily: F, fontWeight: 800, fontSize: "0.78rem", color: starColor(v), marginLeft: 4 }}>{v}</span>
    </span>
  );
}

export default function AdminEncuestasPage() {
  useAdminSession();

  const [restaurantList, setRestaurantList] = useState<RestaurantOption[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [averages, setAverages] = useState<Average[]>([]);
  const [responses, setResponses] = useState<SurveyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (restaurantId: string) => {
    setLoading(true);
    try {
      const qs = restaurantId ? `restaurantId=${restaurantId}&` : "";
      const r = await fetch(`/api/admin/ecommerce-surveys?${qs}limit=300`);
      if (!r.ok) return;
      const d = await r.json();
      setAverages(d.averages ?? []);
      setResponses(d.responses ?? []);
      setTotal(d.total ?? 0);
      if (!restaurantId && d.restaurantList) setRestaurantList(d.restaurantList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(""); }, [load]);

  const handleRestaurantChange = (id: string) => {
    setSelectedRestaurant(id);
    load(id);
  };

  const card: React.CSSProperties = {
    background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px",
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 16px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${GOLD}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Star size={20} color={GOLD} />
        </div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.25rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Encuestas de satisfacción</h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Respuestas de todos los locales · últimas 300</p>
        </div>
      </div>

      {/* Selector de local */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text2)" }}>Local:</label>
        <select
          value={selectedRestaurant}
          onChange={(e) => handleRestaurantChange(e.target.value)}
          style={{ fontFamily: FB, fontSize: "0.84rem", padding: "7px 12px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 9, color: "var(--adm-text)", minWidth: 220, cursor: "pointer" }}
        >
          <option value="">Todos los locales</option>
          {restaurantList.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>{total} respuestas</span>
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</p>
      ) : total === 0 ? (
        <div style={card}><p style={{ fontFamily: FB, color: "var(--adm-text3)", margin: 0 }}>Aún no hay respuestas para este filtro.</p></div>
      ) : (
        <>
          {/* Promedios por pregunta */}
          {averages.length > 0 && (
            <div style={card}>
              <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--adm-text3)", margin: "0 0 14px" }}>
                Promedio por pregunta
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {averages.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ flex: 1, minWidth: 160, fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text)" }}>{a.text}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* barra */}
                      <div style={{ width: 100, height: 6, borderRadius: 999, background: "var(--adm-card-border)", overflow: "hidden" }}>
                        <div style={{ width: `${(a.avg / 5) * 100}%`, height: "100%", background: a.avg >= 4 ? GREEN : a.avg >= 3 ? GOLD : RED, borderRadius: 999 }} />
                      </div>
                      <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: a.avg >= 4 ? GREEN : a.avg >= 3 ? GOLD : RED, minWidth: 32 }}>
                        {a.avg.toFixed(1)}
                      </span>
                      <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", minWidth: 50 }}>({a.count} resp.)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de respuestas */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {responses.map((r) => {
              const avgR = r.answers.length > 0 ? r.answers.reduce((s, a) => s + a.v, 0) / r.answers.length : null;
              return (
                <div key={r.id} style={{ ...card, borderLeft: `3px solid ${avgR != null ? (avgR >= 4 ? GREEN : avgR >= 3 ? GOLD : RED) : "var(--adm-card-border)"}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: "var(--adm-text)" }}>
                        {r.customerName || "Cliente"}
                        {r.orderNumber != null && <span style={{ color: "var(--adm-text3)", fontWeight: 600 }}> · #{r.orderNumber}</span>}
                      </span>
                      {!selectedRestaurant && (
                        <span style={{ display: "inline-block", marginLeft: 8, fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", background: "var(--adm-hover)", borderRadius: 6, padding: "1px 7px" }}>
                          {r.restaurantName}
                        </span>
                      )}
                    </div>
                    <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", flexShrink: 0 }}>{fmtDate(r.createdAt)}</span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
                    {r.answers.map((a) => (
                      <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)" }}>{a.text}</span>
                        <Stars v={a.v} />
                      </div>
                    ))}
                  </div>

                  {r.comment && (
                    <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", fontStyle: "italic", margin: "10px 0 0", padding: "8px 12px", background: "var(--adm-hover)", borderRadius: 10 }}>
                      &ldquo;{r.comment}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
