"use client";

import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { maxVisibleClients, canAccess } from "@/lib/plans";
import PlanGate from "@/components/admin/PlanGate";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { Users, Download, Gift, Mail } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Client {
  id: string;
  name: string | null;
  email: string;
  birthDate: string | null;
  dietType: string | null;
  registeredAt: string;
  source: string;
}

const SOURCE_LABELS: Record<string, string> = {
  birthday_banner: "Cumpleaños",
  post_genio: "Genio",
  cta_post_genio: "CTA Genio",
  cta_repeat_dish: "CTA Plato",
  cta_promo_unlock: "CTA Promo",
  favorites: "Favoritos",
  session: "Sesión",
  unknown: "Directo",
};

const DIET_LABELS: Record<string, string> = {
  omnivore: "Carnívoro", vegetarian: "Vegetariano", vegan: "Vegano",
  OMNIVORE: "Carnívoro", VEGETARIAN: "Vegetariano", VEGAN: "Vegano",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function formatBirthday(d: string) {
  const date = new Date(d);
  return `${date.getDate()} de ${date.toLocaleDateString("es-CL", { month: "long" })}`;
}

export default function ClientesPage() {
  const { selectedRestaurantId } = useAdminSession();
  const { activePlan } = usePanelSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoading(true);
    fetch(`/api/panel/clients?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json())
      .then(d => { setClients(d.clients || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedRestaurantId]);

  const maxVisible = maxVisibleClients(activePlan);
  const canExport = canAccess(activePlan, "clients_export");
  const visibleClients = clients.slice(0, maxVisible);
  const lockedClients = clients.slice(maxVisible);
  const withBirthday = clients.filter(c => c.birthDate);

  const exportCSV = () => {
    if (!canExport) return;
    const rows = [["Nombre", "Email", "Cumpleaños", "Dieta", "Registrado", "Vía"]];
    for (const c of clients) {
      rows.push([
        c.name || "", c.email,
        c.birthDate ? formatBirthday(c.birthDate) : "",
        c.dietType ? DIET_LABELS[c.dietType] || c.dietType : "",
        formatDate(c.registeredAt),
        SOURCE_LABELS[c.source] || c.source,
      ]);
    }
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "clientes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <SkeletonLoading type="cards" />;

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={20} color={GOLD} /> Mis Clientes
          </h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0 }}>
            {total} cliente{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
            {withBirthday.length > 0 && ` · ${withBirthday.length} con cumpleaños`}
          </p>
        </div>
        {canExport && clients.length > 0 && (
          <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 600, color: "var(--adm-text2)", cursor: "pointer" }}>
            <Download size={14} /> Exportar CSV
          </button>
        )}
        {!canExport && clients.length > 0 && (
          <PlanGate plan={activePlan} feature="clients_export" blur={false}>
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 600, color: "var(--adm-text3)", cursor: "not-allowed" }}>
              <Download size={14} /> Exportar CSV
            </button>
          </PlanGate>
        )}
      </div>

      {clients.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Users size={40} color="var(--adm-card-border)" style={{ marginBottom: 12 }} />
          <p style={{ fontFamily: F, fontSize: "0.92rem", color: "var(--adm-text3)", margin: "0 0 4px" }}>Sin clientes registrados</p>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Cuando los clientes se registren en tu carta, aparecerán aquí.</p>
        </div>
      ) : (
        <>
          {/* Visible clients */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleClients.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: c.birthDate ? "rgba(244,166,35,0.1)" : "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {c.birthDate ? <Gift size={18} color={GOLD} /> : <Mail size={18} color="var(--adm-text3)" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name || c.email.split("@")[0]}
                  </p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{c.email}</span>
                    {c.birthDate && (
                      <span style={{ fontFamily: F, fontSize: "0.62rem", padding: "1px 6px", borderRadius: 4, background: "rgba(244,166,35,0.1)", color: GOLD, fontWeight: 600 }}>
                        🎂 {formatBirthday(c.birthDate)}
                      </span>
                    )}
                    {c.dietType && c.dietType !== "omnivore" && c.dietType !== "OMNIVORE" && (
                      <span style={{ fontFamily: F, fontSize: "0.62rem", padding: "1px 6px", borderRadius: 4, background: "rgba(74,222,128,0.1)", color: "#16a34a", fontWeight: 600 }}>
                        {DIET_LABELS[c.dietType] || c.dietType}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)" }}>{formatDate(c.registeredAt)}</span>
                  <p style={{ fontFamily: F, fontSize: "0.58rem", color: "var(--adm-text3)", margin: "2px 0 0", opacity: 0.7 }}>
                    {SOURCE_LABELS[c.source] || c.source}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Locked clients */}
          {lockedClients.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <PlanGate plan={activePlan} feature="clients_full">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {lockedClients.slice(0, 5).map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Mail size={18} color="var(--adm-text3)" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0 }}>{c.name || "Cliente"}</p>
                        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{c.email}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </PlanGate>
            </div>
          )}
        </>
      )}
    </div>
  );
}
