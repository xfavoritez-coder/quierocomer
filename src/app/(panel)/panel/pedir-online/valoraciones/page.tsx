"use client";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";

type Response = {
  id: string;
  orderNumber: number | null;
  customerName: string | null;
  comment: string | null;
  createdAt: string;
  answers: { id: string; text: string; v: number }[];
};

type Data = {
  averages: { id: string; text: string; avg: number; count: number }[];
  responses: Response[];
  total: number;
};

function Stars({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} fill={n <= Math.round(value) ? "#F4A623" : "none"} color={n <= Math.round(value) ? "#F4A623" : "#ccc"} />
      ))}
    </span>
  );
}

export default function ValoracionesPedidosPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/survey/responses?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  if (loading) return (
    <div style={{ padding: 32, color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.85rem" }}>Cargando valoraciones…</div>
  );

  const responses = data?.responses ?? [];
  const averages = (data?.averages ?? []).filter((a) => a.count > 0);

  const globalAvg = averages.length
    ? averages.reduce((s, a) => s + a.avg, 0) / averages.length
    : null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 0 48px" }}>
      <h2 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 20px" }}>
        Valoraciones de clientes
      </h2>

      {/* Resumen global */}
      {globalAvg !== null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
          background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
          borderRadius: 14, marginBottom: 20,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: F, fontSize: "2.2rem", fontWeight: 800, color: "#F4A623", lineHeight: 1 }}>
              {globalAvg.toFixed(1)}
            </div>
            <Stars value={globalAvg} />
          </div>
          <div style={{ flex: 1 }}>
            {averages.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", flex: 1 }}>{a.text}</span>
                <Stars value={a.avg} />
                <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", width: 28, textAlign: "right" }}>
                  {a.avg.toFixed(1)}
                </span>
              </div>
            ))}
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>
              {data?.total ?? 0} valoración{(data?.total ?? 0) !== 1 ? "es" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Sin respuestas */}
      {responses.length === 0 && (
        <div style={{
          padding: "40px 24px", textAlign: "center",
          background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
          borderRadius: 14, color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.85rem",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
          Aún no hay valoraciones. Se envía el correo automáticamente al completar cada pedido.
        </div>
      )}

      {/* Lista de respuestas */}
      {responses.map((r) => (
        <div key={r.id} style={{
          background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
          borderRadius: 12, padding: "14px 16px", marginBottom: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)" }}>
              {r.customerName || "Cliente"}
              {r.orderNumber ? <span style={{ fontWeight: 400, color: "var(--adm-text3)", marginLeft: 6 }}>· #{r.orderNumber}</span> : null}
            </span>
            <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
              {new Date(r.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: r.comment ? 8 : 0 }}>
            {r.answers.filter((a) => a.v >= 1).map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{a.text}</span>
                <Stars value={a.v} />
              </div>
            ))}
          </div>
          {r.comment && (
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, fontStyle: "italic" }}>
              "{r.comment}"
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
