"use client";

import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { maxVisibleClients, canAccess } from "@/lib/plans";
import PlanGate from "@/components/admin/PlanGate";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { Users, Download, Gift, Mail, Pencil, Trash2, X } from "lucide-react";

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

const DEMO_CLIENTS: Client[] = [
  { id: "c1", name: "María González", email: "maria@email.com", birthDate: "1994-03-15", dietType: "vegetarian", registeredAt: new Date(Date.now() - 2 * 86400000).toISOString(), source: "birthday_banner" },
  { id: "c2", name: "Carlos Ruiz", email: "carlos@email.com", birthDate: "1988-07-22", dietType: "omnivore", registeredAt: new Date(Date.now() - 5 * 86400000).toISOString(), source: "birthday_banner" },
  { id: "c3", name: "Ana López", email: "ana@email.com", birthDate: "1996-11-08", dietType: "omnivore", registeredAt: new Date(Date.now() - 3 * 86400000).toISOString(), source: "post_genio" },
  { id: "c4", name: "Pedro Morales", email: "pedro@email.com", birthDate: "1991-01-30", dietType: "omnivore", registeredAt: new Date(Date.now() - 7 * 86400000).toISOString(), source: "birthday_banner" },
  { id: "c5", name: "Laura Silva", email: "laura@email.com", birthDate: "1999-09-12", dietType: "vegetarian", registeredAt: new Date(Date.now() - 1 * 86400000).toISOString(), source: "birthday_banner" },
  { id: "c6", name: "Tomás Vargas", email: "tomas@email.com", birthDate: "1990-06-10", dietType: "vegan", registeredAt: new Date(Date.now() - 4 * 86400000).toISOString(), source: "birthday_banner" },
  { id: "c7", name: "Camila Herrera", email: "camila@email.com", birthDate: "1993-05-20", dietType: null, registeredAt: new Date(Date.now() - 6 * 86400000).toISOString(), source: "birthday_banner" },
  { id: "c8", name: "Rodrigo Soto", email: "rodrigo@email.com", birthDate: "2000-12-01", dietType: "omnivore", registeredAt: new Date(Date.now() - 8 * 86400000).toISOString(), source: "birthday_banner" },
  { id: "c9", name: "Sebastián Muñoz", email: "seba@email.com", birthDate: "1995-04-18", dietType: "omnivore", registeredAt: new Date(Date.now() - 9 * 86400000).toISOString(), source: "birthday_banner" },
  { id: "c10", name: "Valentina Rojas", email: "vale@email.com", birthDate: "1997-08-25", dietType: null, registeredAt: new Date(Date.now() - 10 * 86400000).toISOString(), source: "post_genio" },
  { id: "c11", name: "Diego Fernández", email: "diego@email.com", birthDate: "1992-02-14", dietType: "omnivore", registeredAt: new Date(Date.now() - 11 * 86400000).toISOString(), source: "birthday_banner" },
];

export default function ClientesPage() {
  const { selectedRestaurantId, restaurants } = useAdminSession();
  const { activePlan } = usePanelSession();
  const isDemo = !!(restaurants?.find((r: any) => r.id === selectedRestaurantId) as any)?.isDemo;
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const reload = () => {
    if (isDemo) {
      setClients(DEMO_CLIENTS);
      setTotal(DEMO_CLIENTS.length);
      setLoading(false);
      return;
    }
    if (!selectedRestaurantId) return;
    setLoading(true);
    fetch(`/api/panel/clients?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json())
      .then(d => { setClients(d.clients || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRestaurantId]);

  const handleSaveEdit = async (form: { name: string; email: string; birthDate: string; dietType: string }) => {
    if (!editing || !selectedRestaurantId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/panel/clients/${editing.id}?restaurantId=${selectedRestaurantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          birthDate: form.birthDate || null,
          dietType: form.dietType || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo guardar");
        return;
      }
      setEditing(null);
      reload();
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting || !selectedRestaurantId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/panel/clients/${deleting.id}?restaurantId=${selectedRestaurantId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo borrar");
        return;
      }
      setDeleting(null);
      reload();
    } finally {
      setActionLoading(false);
    }
  };

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
            <Users size={20} color="var(--adm-text3)" /> Mis Clientes
          </h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0 }}>
            {total} cliente{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
          </p>
        </div>
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
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => setEditing(c)}
                    title="Editar"
                    style={{ width: 28, height: 28, padding: 0, borderRadius: 7, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--adm-text3)" }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleting(c)}
                    title="Borrar"
                    style={{ width: 28, height: 28, padding: 0, borderRadius: 7, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ef4444" }}
                  >
                    <Trash2 size={13} />
                  </button>
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

      {/* Modal editar */}
      {editing && (
        <EditClientModal
          client={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
          loading={actionLoading}
        />
      )}

      {/* Modal borrar */}
      {deleting && (
        <DeleteClientModal
          client={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={handleConfirmDelete}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

/* ═══════════ Modales ═══════════ */
function EditClientModal({ client, onClose, onSave, loading }: { client: Client; onClose: () => void; onSave: (form: { name: string; email: string; birthDate: string; dietType: string }) => void; loading: boolean }) {
  const [name, setName] = useState(client.name || "");
  const [email, setEmail] = useState(client.email);
  const [birthDate, setBirthDate] = useState(client.birthDate ? client.birthDate.split("T")[0] : "");
  const [dietType, setDietType] = useState(client.dietType || "");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--adm-card)", borderRadius: 16, padding: "24px", maxWidth: 420, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.25)", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)", padding: 4 }}>
          <X size={18} />
        </button>
        <h2 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 18px" }}>Editar cliente</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", marginBottom: 5, fontWeight: 600 }}>Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" style={{ width: "100%", padding: "10px 12px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", marginBottom: 5, fontWeight: 600 }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ width: "100%", padding: "10px 12px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", marginBottom: 5, fontWeight: 600 }}>Fecha de cumpleaños</label>
            <input value={birthDate} onChange={e => setBirthDate(e.target.value)} type="date" style={{ width: "100%", padding: "10px 12px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", marginBottom: 5, fontWeight: 600 }}>Dieta</label>
            <select value={dietType} onChange={e => setDietType(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box", appearance: "none" }}>
              <option value="">Sin especificar</option>
              <option value="omnivore">Carnívoro</option>
              <option value="vegetarian">Vegetariano</option>
              <option value="vegan">Vegano</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 22, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={loading} style={{ padding: "9px 16px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: "var(--adm-text2)", cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => onSave({ name, email, birthDate, dietType })} disabled={loading} style={{ padding: "9px 16px", background: GOLD, border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "white", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteClientModal({ client, onClose, onConfirm, loading }: { client: Client; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--adm-card)", borderRadius: 16, padding: "24px", maxWidth: 380, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.25)", position: "relative" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Trash2 size={20} color="#ef4444" />
        </div>
        <h2 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>Borrar cliente</h2>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 18px", lineHeight: 1.5 }}>
          Vas a quitar a <strong>{client.name || client.email}</strong> de la lista de clientes de este local. La cuenta del usuario sigue existiendo si tiene relación con otros locales.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={loading} style={{ padding: "9px 16px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: "var(--adm-text2)", cursor: "pointer" }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: "9px 16px", background: "#ef4444", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "white", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Borrando..." : "Sí, borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
