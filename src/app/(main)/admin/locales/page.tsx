"use client";
import { useState, useEffect, useMemo } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import QRGeneratorModal from "@/components/admin/QRGeneratorModal";
import { QRCodeCanvas } from "qrcode.react";
import { norm } from "@/lib/normalize";
import SubirFoto from "@/components/SubirFoto";

interface Restaurant {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  instagram: string | null;
  website: string | null;
  dietType: string;
  enabledLangs: string[];
  cartaTheme: string;
  cartaColorMode: string;
  cartaAccentColor: string | null;
  defaultView: string | null;
  qrActivatedAt: string | null;
  qrToken: string | null;
  isActive: boolean;
  ownerId: string | null;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
  waiterPanelActive: boolean;
  plan: string;
  subscriptionStatus?: string;
  trialEndsAt?: string | null;
  flowSubscriptionId?: string | null;
  billingExempt?: boolean;
  toteatRestaurantId: string | null;
  toteatLocalId: number | null;
  toteatUserId: number | null;
  toteatApiToken: string | null;
  toteatLastSyncAt: string | null;
  _count: { dishes: number; categories: number; statEvents: number; sessions: number };
}

const F = "var(--font-display)";

export default function AdminLocales() {
  const { isSuper } = useAdminSession();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "activos" | "inactivos" | "sin_owner">("todos");
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffEmail, setHandoffEmail] = useState("");
  const [handoffName, setHandoffName] = useState("");
  const [handoffWhatsapp, setHandoffWhatsapp] = useState("");
  const [handoffPlan, setHandoffPlan] = useState<"FREE" | "GOLD" | "PREMIUM">("PREMIUM");
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffResult, setHandoffResult] = useState<null | { ok: boolean; trialEndsAt: string | null; isPaidPlan: boolean; plan: string; emailSent: boolean; emailError: string | null; passwordGenerated: string | null }>(null);

  useEffect(() => {
    fetch("/api/admin/locales").then(r => r.json()).then(d => { if (Array.isArray(d)) setRestaurants(d); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editInstagram, setEditInstagram] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDietType, setEditDietType] = useState("OMNIVORE");
  const [editLangs, setEditLangs] = useState<string[]>(["es", "en", "pt"]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync form when selected changes
  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name);
    setEditDesc(selected.description || "");
    setEditPhone(selected.phone || "");
    setEditWhatsapp(selected.whatsapp || "");
    setEditInstagram(selected.instagram || "");
    setEditWebsite(selected.website || "");
    setEditAddress(selected.address || "");
    setEditDietType(selected.dietType || "OMNIVORE");
    setEditLangs(selected.enabledLangs?.length ? selected.enabledLangs : ["es", "en", "pt"]);
    setSaved(false);
  }, [selected?.id]);

  const saveChanges = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const body = {
        name: editName.trim() || selected.name,
        description: editDesc.trim() || null,
        phone: editPhone.trim() || null,
        whatsapp: editWhatsapp.trim() || null,
        instagram: editInstagram.trim().replace(/^@/, "") || null,
        website: editWebsite.trim() || null,
        address: editAddress.trim() || null,
        dietType: editDietType,
        enabledLangs: editLangs,
      };
      await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const u = { ...selected, ...body };
      setSelected(u);
      setRestaurants(prev => prev.map(x => x.id === selected.id ? u : x));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  const filtered = useMemo(() => {
    let list = restaurants;
    if (search) {
      const q = norm(search);
      list = list.filter(r => norm(r.name).includes(q) || norm(r.slug).includes(q));
    }
    if (filter === "activos") list = list.filter(r => r.isActive);
    if (filter === "inactivos") list = list.filter(r => !r.isActive);
    if (filter === "sin_owner") list = list.filter(r => !r.ownerId);
    return list;
  }, [restaurants, search, filter]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteRestaurant = async (r: Restaurant) => {
    if (!confirm(`¿Estás seguro de eliminar "${r.name}"? Esto borrará TODOS sus platos, categorías, sesiones y datos. Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/locales/${r.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Error"); return; }
      setRestaurants(prev => prev.filter(x => x.id !== r.id));
      setSelected(null as any);
    } catch { alert("Error al eliminar"); }
  };

  const toggleActive = async (r: Restaurant) => {
    await fetch(`/api/admin/locales/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !r.isActive }) });
    setRestaurants(prev => prev.map(x => x.id === r.id ? { ...x, isActive: !x.isActive } : x));
  };

  if (loading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando locales...</p>;

  if (selected) return (
    <div style={{ maxWidth: 600 }}>
      <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#F4A623", fontFamily: F, fontSize: "0.85rem", cursor: "pointer", marginBottom: 20 }}>&larr; Volver a locales</button>
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          {selected.logoUrl ? (
            <img src={selected.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#0a0a0a" }}>{selected.name.charAt(0)}</div>
          )}
          <div>
            <h2 style={{ fontFamily: F, fontSize: "1.3rem", color: "white", margin: 0 }}>{selected.name}</h2>
            <p style={{ fontFamily: F, fontSize: "0.8rem", color: "#888", margin: 0 }}>/{selected.slug}</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <span style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: 20,
              background: selected.plan === "PREMIUM" ? "rgba(124,58,237,0.1)" : selected.plan === "GOLD" ? "rgba(244,166,35,0.1)" : "rgba(255,255,255,0.06)",
              color: selected.plan === "PREMIUM" ? "#c084fc" : selected.plan === "GOLD" ? "#F4A623" : "#888",
              border: `1px solid ${selected.plan === "PREMIUM" ? "rgba(124,58,237,0.2)" : selected.plan === "GOLD" ? "rgba(244,166,35,0.2)" : "rgba(255,255,255,0.1)"}`,
            }}>
              {selected.plan === "PREMIUM" ? "Premium" : selected.plan === "GOLD" ? "Gold" : "Free"}
            </span>
            <span style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: 20, background: selected.isActive ? "rgba(74,222,128,0.1)" : "rgba(255,100,100,0.1)", color: selected.isActive ? "#4ade80" : "#ff6b6b", border: `1px solid ${selected.isActive ? "rgba(74,222,128,0.2)" : "rgba(255,100,100,0.2)"}` }}>
              {selected.isActive ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>

        <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Platos", value: selected._count.dishes },
            { label: "Categorias", value: selected._count.categories },
            { label: "Sesiones", value: selected._count.sessions },
            { label: "Eventos", value: selected._count.statEvents },
          ].map(s => (
            <div key={s.label} style={{ background: "#111", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0, fontWeight: 700 }}>{s.value}</p>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Editable fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Nombre</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Descripción</label>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box", resize: "vertical" }} />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Logo</label>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {selected.logoUrl ? (
                <img src={selected.logoUrl} alt="Logo" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#0a0a0a" }}>{selected.name.charAt(0)}</div>
              )}
              <SubirFoto folder="logos" label="Cambiar logo" circular height="56px" preview={selected.logoUrl} onUpload={async (url: string) => {
                await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logoUrl: url }) });
                const u = { ...selected, logoUrl: url }; setSelected(u); setRestaurants(prev => prev.map(x => x.id === selected.id ? u : x));
              }} />
            </div>
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Teléfono</label>
            <input value={editPhone} onChange={e => setEditPhone(e.target.value)} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} placeholder="+56 2 1234 5678" />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>WhatsApp</label>
            <input value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} placeholder="+56 9 1234 5678" />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Instagram</label>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRight: "none", borderRadius: "8px 0 0 8px", color: "#666", fontFamily: F, fontSize: "0.82rem" }}>@</span>
              <input value={editInstagram} onChange={e => setEditInstagram(e.target.value.replace(/^@/, ""))} style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: "0 8px 8px 0", color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} placeholder="tu_usuario" />
            </div>
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Sitio web</label>
            <input value={editWebsite} onChange={e => setEditWebsite(e.target.value)} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} placeholder="https://tu-sitio.cl" />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Dirección</label>
            <input value={editAddress} onChange={e => setEditAddress(e.target.value)} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} placeholder="Av. Providencia 1234, Santiago" />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Tipo de local</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { value: "OMNIVORE", label: "Carnívoro", icon: "🍖" },
                { value: "VEGETARIAN", label: "Vegetariano", icon: "🌱" },
                { value: "VEGAN", label: "Vegano", icon: "🌿" },
              ].map(opt => (
                <button key={opt.value} onClick={() => setEditDietType(opt.value)} style={{
                  flex: 1, padding: "8px 6px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
                  background: editDietType === opt.value ? (opt.value === "OMNIVORE" ? "rgba(139,90,43,0.2)" : "rgba(74,222,128,0.15)") : "rgba(255,255,255,0.04)",
                  color: editDietType === opt.value ? (opt.value === "OMNIVORE" ? "#c9935a" : "#4ade80") : "#666",
                }}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Idiomas de la carta</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { code: "es", label: "Español", flag: "🇪🇸" },
                { code: "en", label: "Inglés", flag: "🇺🇸" },
                { code: "pt", label: "Portugués", flag: "🇧🇷" },
                { code: "it", label: "Italiano", flag: "🇮🇹" },
              ].map(lang => {
                const isOn = editLangs.includes(lang.code);
                const isEs = lang.code === "es";
                return (
                  <button key={lang.code} disabled={isEs} onClick={() => {
                    if (isEs) return;
                    setEditLangs(prev => isOn ? prev.filter(l => l !== lang.code) : [...prev, lang.code]);
                  }} style={{
                    padding: "8px 12px", borderRadius: 8, border: "none", cursor: isEs ? "default" : "pointer",
                    fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
                    background: isOn ? "rgba(127,191,220,0.15)" : "rgba(255,255,255,0.04)",
                    color: isOn ? "#7fbfdc" : "#555",
                    opacity: isEs ? 0.7 : 1,
                  }}>
                    {lang.flag} {lang.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontFamily: F, fontSize: "0.62rem", color: "#555", margin: "6px 0 0" }}>Español siempre activo. Los demás se pueden activar o desactivar.</p>
          </div>
          <button onClick={saveChanges} disabled={saving} style={{ padding: "12px", background: saved ? "rgba(74,222,128,0.15)" : "#F4A623", color: saved ? "#4ade80" : "#0a0a0a", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", marginTop: 6 }}>
            {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar cambios"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.85rem", fontFamily: F, color: "#aaa" }}>
          <p style={{ margin: 0 }}>Tema: {selected.cartaTheme}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <span>Modo:</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["LIGHT", "DARK"] as const).map((m) => (
                <button
                  key={m}
                  onClick={async () => {
                    await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cartaColorMode: m }) });
                    const updated = { ...selected, cartaColorMode: m };
                    setSelected(updated);
                    setRestaurants((prev) => prev.map((x) => x.id === selected.id ? updated : x));
                  }}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
                    background: (selected.cartaColorMode || "LIGHT") === m ? "#F4A623" : "rgba(255,255,255,0.06)",
                    color: (selected.cartaColorMode || "LIGHT") === m ? "#0a0a0a" : "#888",
                  }}
                >
                  {m === "LIGHT" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <span>Color:</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { value: null, label: "Amber", color: "#F4A623" },
                { value: "#C41E3A", label: "Rojo", color: "#C41E3A" },
              ].map((c) => (
                <button
                  key={c.label}
                  onClick={async () => {
                    await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cartaAccentColor: c.value }) });
                    const updated = { ...selected, cartaAccentColor: c.value };
                    setSelected(updated);
                    setRestaurants((prev: any[]) => prev.map((x: any) => x.id === selected.id ? updated : x));
                  }}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
                    background: (selected.cartaAccentColor || null) === c.value ? c.color : "rgba(255,255,255,0.06)",
                    color: (selected.cartaAccentColor || null) === c.value ? "#fff" : "#888",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <span>Vista por defecto:</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { value: "lista", label: "Lista" },
                { value: "premium", label: "Galería" },
                { value: "viaje", label: "Espacial" },
              ].map((v) => (
                <button
                  key={v.value}
                  onClick={async () => {
                    await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultView: v.value }) });
                    const updated = { ...selected, defaultView: v.value };
                    setSelected(updated);
                    setRestaurants((prev) => prev.map((x) => x.id === selected.id ? updated : x));
                  }}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
                    background: (selected.defaultView || "premium") === v.value ? "#F4A623" : "rgba(255,255,255,0.06)",
                    color: (selected.defaultView || "premium") === v.value ? "#0a0a0a" : "#888",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <span>Plan:</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { value: "FREE", label: "Gratis", color: "#9ca3af", bg: "rgba(156,163,175,0.18)" },
                { value: "GOLD", label: "Gold", color: "#F4A623", bg: "rgba(244,166,35,0.15)" },
                { value: "PREMIUM", label: "Premium", color: "#c084fc", bg: "rgba(192,132,252,0.15)" },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={async () => {
                    await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: p.value }) });
                    const updated = { ...selected, plan: p.value };
                    setSelected(updated);
                    setRestaurants((prev) => prev.map((x) => x.id === selected.id ? updated : x));
                  }}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
                    background: (selected.plan || "PREMIUM") === p.value ? p.bg : "rgba(255,255,255,0.06)",
                    color: (selected.plan || "PREMIUM") === p.value ? p.color : "#888",
                    transition: "all 0.15s ease",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <p style={{ margin: 0 }}>Owner: {selected.owner ? `${selected.owner.name} (${selected.owner.email})` : <span style={{ color: "#666" }}>Sin asignar</span>}</p>
          <p style={{ margin: 0 }}>Creado: {new Date(selected.createdAt).toLocaleDateString("es-CL")}</p>
        </div>

        <div className="adm-btn-row" style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <a href={`/qr/${selected.slug}`} target="_blank" style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 10, color: "#F4A623", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>Ver carta</a>
          {selected.ownerId && (
            <button onClick={async () => {
              const res = await fetch("/api/admin/impersonate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId: selected.ownerId }) });
              const data = await res.json();
              if (res.ok) window.open("/panel", "_blank");
              else alert(data.error || "Error");
            }} style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(192,132,252,0.1)", border: "1px solid rgba(192,132,252,0.2)", borderRadius: 10, color: "#c084fc", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
              🔑 Entrar como owner
            </button>
          )}
          {!selected.ownerId && !selected.billingExempt && (
            <button
              onClick={() => {
                setHandoffEmail(selected.owner?.email || "");
                setHandoffName(selected.owner?.name || "");
                setHandoffWhatsapp("");
                // Default al plan actual del local — el vendedor lo cambia en el modal
                // si el dueño escogio otro
                const currentPlan = (selected.plan === "GOLD" || selected.plan === "PREMIUM" || selected.plan === "FREE") ? selected.plan : "PREMIUM";
                setHandoffPlan(currentPlan as "FREE" | "GOLD" | "PREMIUM");
                setHandoffError(null);
                setHandoffResult(null);
                setHandoffOpen(true);
              }}
              style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 10, color: "#4ade80", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
            >
              🤝 Entregar al dueño
            </button>
          )}
          <button onClick={() => { navigator.clipboard.writeText(`https://quierocomer.cl/qr/generar/${selected.slug}`); setQrModalOpen(true); }} style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>📱 Generar QR</button>
          <a href={`/qr/${selected.slug}?mesa=demo&demo=true`} target="_blank" style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(127,191,220,0.1)", border: "1px solid rgba(127,191,220,0.2)", borderRadius: 10, color: "#7fbfdc", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>🔔 Demo Garzón</a>
          <a href={`/qr/admin/garzon/${selected.slug}`} target="_blank" style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, color: "#4ade80", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>📱 Panel Garzón</a>
          <button onClick={() => { toggleActive(selected); setSelected({ ...selected, isActive: !selected.isActive }); }} style={{ flex: 1, padding: "10px", background: selected.isActive ? "rgba(255,100,100,0.1)" : "rgba(74,222,128,0.1)", border: `1px solid ${selected.isActive ? "rgba(255,100,100,0.2)" : "rgba(74,222,128,0.2)"}`, borderRadius: 10, color: selected.isActive ? "#ff6b6b" : "#4ade80", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
            {selected.isActive ? "Desactivar" : "Activar"}
          </button>
          {selected.plan === "PREMIUM" && !(selected as any).billingExempt && (
            <button
              onClick={async () => {
                if (!confirm(`¿Pasar "${selected.name}" a plan FREE?\n\nEl dueño verá el plan Gratis al entrar al panel y podrá activar el trial Gold/Premium cuando quiera.`)) return;
                const res = await fetch(`/api/admin/locales/${selected.id}`, {
                  method: "PUT", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ plan: "FREE" }),
                });
                if (res.ok) {
                  const updated = { ...selected, plan: "FREE" };
                  setSelected(updated);
                  setRestaurants((prev) => prev.map((x) => x.id === selected.id ? updated : x));
                } else {
                  const d = await res.json().catch(() => ({}));
                  alert(d.error || "Error");
                }
              }}
              style={{ flex: 1, padding: "10px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 10, color: "#4ade80", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
            >
              ✅ Entregar al dueño (FREE)
            </button>
          )}
          <button onClick={() => deleteRestaurant(selected)} style={{ flex: 1, padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, color: "#ef4444", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
            🗑 Eliminar local
          </button>
        </div>

        {/* Toteat integration — super-admin only */}
        {isSuper && (
          <ToteatSection
            restaurant={selected}
            onUpdate={(patch) => { const updated = { ...selected, ...patch }; setSelected(updated); setRestaurants((prev) => prev.map((x) => x.id === selected.id ? updated : x)); }}
          />
        )}

        {/* Inline QR */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid #2A2A2A", borderRadius: 12, marginTop: 16 }}>
          <div style={{ background: "white", borderRadius: 10, padding: 8, flexShrink: 0 }}>
            <QRCodeCanvas value={`https://quierocomer.cl/qr/${selected.slug}${selected.qrToken ? `?t=${selected.qrToken}` : ""}`} size={80} level="H" />
          </div>
          <div>
            <p style={{ fontFamily: F, fontSize: "0.75rem", color: "#888", margin: "0 0 4px" }}>QR de la carta</p>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#F4A623", margin: 0, wordBreak: "break-all" }}>quierocomer.cl/qr/{selected.slug}{selected.qrToken ? `?t=${selected.qrToken}` : ""}</p>
          </div>
        </div>

        {/* Toggle garzón */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid #2A2A2A", borderRadius: 12, marginTop: 12 }}>
          <div>
            <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "white", margin: 0 }}>🔔 Campanita garzón</p>
            <p style={{ fontFamily: F, fontSize: "0.68rem", color: "#888", margin: "2px 0 0" }}>{selected.waiterPanelActive ? "Visible en la carta" : "Desactivada"}</p>
          </div>
          <button
            onClick={async () => {
              const val = !selected.waiterPanelActive;
              await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ waiterPanelActive: val }) });
              const u = { ...selected, waiterPanelActive: val };
              setSelected(u);
              setRestaurants(prev => prev.map(x => x.id === selected.id ? u : x));
            }}
            style={{
              width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
              background: selected.waiterPanelActive ? "#4ade80" : "rgba(255,255,255,0.15)",
              transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: "50%", background: "white", position: "absolute", top: 3,
              left: selected.waiterPanelActive ? 23 : 3, transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </button>
        </div>

        {/* Toggle bonificado */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: selected.billingExempt ? "rgba(255,214,0,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${selected.billingExempt ? "rgba(255,214,0,0.3)" : "#2A2A2A"}`, borderRadius: 12, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: selected.billingExempt ? "#FFD600" : "white", margin: 0 }}>🎁 Plan bonificado</p>
            <p style={{ fontFamily: F, fontSize: "0.68rem", color: "#888", margin: "2px 0 0", lineHeight: 1.4 }}>
              {selected.billingExempt
                ? "Sin cobro · Disfruta funciones del plan sin pagar"
                : "Pago normal — el dueño paga su plan via Flow"}
            </p>
          </div>
          <button
            onClick={async () => {
              const val = !selected.billingExempt;
              if (val && !confirm(`¿Marcar ${selected.name} como plan bonificado? No se le cobrará nada.`)) return;
              if (!val && !confirm(`¿Quitar el plan bonificado de ${selected.name}? Volverá al flujo normal de cobro.`)) return;
              const res = await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billingExempt: val }) });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || "Error al actualizar");
                return;
              }
              const u = { ...selected, billingExempt: val };
              setSelected(u);
              setRestaurants(prev => prev.map(x => x.id === selected.id ? u : x));
            }}
            style={{
              width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
              background: selected.billingExempt ? "#FFD600" : "rgba(255,255,255,0.15)",
              transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: "50%", background: "white", position: "absolute", top: 3,
              left: selected.billingExempt ? 23 : 3, transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </button>
        </div>

      </div>
      {qrModalOpen && <QRGeneratorModal restaurant={selected} onClose={() => setQrModalOpen(false)} />}

      {handoffOpen && selected && (
        <div onClick={() => !handoffSubmitting && setHandoffOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a1a", border: "1px solid #2A2A2A", borderRadius: 16, padding: 28, maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            {!handoffResult ? (
              <>
                <h2 style={{ fontFamily: F, fontSize: "1.1rem", color: "#4ade80", margin: "0 0 6px" }}>🤝 Entregar al dueño</h2>
                <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", margin: "0 0 18px", lineHeight: 1.5 }}>
                  Crea cuenta para el dueño de <strong style={{ color: "#fff" }}>{selected.name}</strong> y le manda email con sus credenciales y enlaces.
                </p>

                {handoffError && (
                  <div style={{ background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                    <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#ff6b6b", margin: 0 }}>{handoffError}</p>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                  <div>
                    <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Plan que escogió el dueño *</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      {(["FREE", "GOLD", "PREMIUM"] as const).map((p) => {
                        const selected = handoffPlan === p;
                        const colors = p === "PREMIUM"
                          ? { bg: selected ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.04)", border: selected ? "rgba(124,58,237,0.6)" : "#2A2A2A", text: selected ? "#c4b5fd" : "#888" }
                          : p === "GOLD"
                            ? { bg: selected ? "rgba(244,166,35,0.18)" : "rgba(255,255,255,0.04)", border: selected ? "rgba(244,166,35,0.6)" : "#2A2A2A", text: selected ? "#F4A623" : "#888" }
                            : { bg: selected ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)", border: selected ? "rgba(255,255,255,0.4)" : "#2A2A2A", text: selected ? "#fff" : "#888" };
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setHandoffPlan(p)}
                            style={{
                              padding: "10px 8px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8,
                              color: colors.text, fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {p === "PREMIUM" ? "💎 Premium" : p === "GOLD" ? "⭐ Gold" : "Gratis"}
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", margin: "6px 0 0", lineHeight: 1.4 }}>
                      {handoffPlan === "FREE"
                        ? "Sin trial. Email simple sin urgencia."
                        : `Activa 7 días gratis. Email con instrucciones para inscribir tarjeta antes de que venza.`}
                    </p>
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Email del dueño *</label>
                    <input value={handoffEmail} onChange={(e) => setHandoffEmail(e.target.value)} type="email" placeholder="dueno@restaurante.cl" style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "#fff", fontFamily: "monospace", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Nombre *</label>
                    <input value={handoffName} onChange={(e) => setHandoffName(e.target.value)} placeholder="Juan Pérez" style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "#fff", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>WhatsApp (opcional)</label>
                    <input value={handoffWhatsapp} onChange={(e) => setHandoffWhatsapp(e.target.value)} placeholder="+56 9 1234 5678" style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "#fff", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setHandoffOpen(false)} disabled={handoffSubmitting} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "#aaa", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button
                    disabled={handoffSubmitting || !handoffEmail || !handoffName}
                    onClick={async () => {
                      setHandoffSubmitting(true);
                      setHandoffError(null);
                      try {
                        const res = await fetch(`/api/admin/locales/${selected.id}/handoff`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: handoffEmail, name: handoffName, whatsapp: handoffWhatsapp || undefined, plan: handoffPlan }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setHandoffError(data.error || "Error al entregar");
                          setHandoffSubmitting(false);
                          return;
                        }
                        setHandoffResult(data);
                        // Refresh local data
                        const updated = { ...selected, ownerId: data.ownerId, plan: data.plan, subscriptionStatus: data.isPaidPlan ? "TRIALING" : "NONE", trialEndsAt: data.trialEndsAt };
                        setSelected(updated);
                        setRestaurants(prev => prev.map(r => r.id === selected.id ? updated : r));
                      } catch (e: any) {
                        setHandoffError(e?.message || "Error de conexión");
                      }
                      setHandoffSubmitting(false);
                    }}
                    style={{ flex: 2, padding: "11px", background: handoffSubmitting ? "#666" : "#4ade80", border: "none", borderRadius: 8, color: "#0a0a0a", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: handoffSubmitting ? "wait" : "pointer" }}
                  >
                    {handoffSubmitting ? "Entregando..." : "🤝 Entregar y empezar trial"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontFamily: F, fontSize: "1.1rem", color: "#4ade80", margin: "0 0 18px", textAlign: "center" }}>✓ Local entregado</h2>
                <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <p style={{ fontFamily: F, fontSize: "0.82rem", color: "#fff", margin: "0 0 6px" }}>
                    {handoffResult.isPaidPlan
                      ? `Trial activo · ${handoffResult.plan === "PREMIUM" ? "Premium" : "Gold"}`
                      : "Plan Gratis activado"}
                  </p>
                  {handoffResult.isPaidPlan && handoffResult.trialEndsAt && (
                    <p style={{ fontFamily: F, fontSize: "0.74rem", color: "#aaa", margin: 0 }}>
                      Vence: {new Date(handoffResult.trialEndsAt).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                  {!handoffResult.isPaidPlan && (
                    <p style={{ fontFamily: F, fontSize: "0.74rem", color: "#aaa", margin: 0 }}>
                      Sin trial. El dueño puede subir de plan cuando quiera desde su panel.
                    </p>
                  )}
                </div>
                {handoffResult.passwordGenerated && (
                  <div style={{ background: "rgba(255,214,0,0.06)", border: "1px solid rgba(255,214,0,0.2)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                    <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#FFD600", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Contraseña generada</p>
                    <p style={{ fontFamily: "monospace", fontSize: "0.92rem", color: "#fff", margin: 0, wordBreak: "break-all" }}>{handoffResult.passwordGenerated}</p>
                    <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#888", margin: "8px 0 0" }}>Se la enviamos por email. Cópiala por si acaso.</p>
                  </div>
                )}
                <div style={{ background: handoffResult.emailSent ? "rgba(74,222,128,0.06)" : "rgba(255,100,100,0.08)", border: `1px solid ${handoffResult.emailSent ? "rgba(74,222,128,0.2)" : "rgba(255,100,100,0.25)"}`, borderRadius: 8, padding: "10px 12px", marginBottom: 18 }}>
                  <p style={{ fontFamily: F, fontSize: "0.78rem", color: handoffResult.emailSent ? "#4ade80" : "#ff6b6b", margin: 0 }}>
                    {handoffResult.emailSent ? "📧 Email enviado al dueño" : `⚠ El email falló: ${handoffResult.emailError}. Mándale las credenciales tú.`}
                  </p>
                </div>
                <button onClick={() => { setHandoffOpen(false); setHandoffResult(null); }} style={{ width: "100%", padding: "11px", background: "#F4A623", border: "none", borderRadius: 8, color: "#0a0a0a", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                  Listo
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", marginBottom: 20 }}>Locales ({filtered.length})</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar local..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 0, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.85rem", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(["todos", "activos", "inactivos", "sin_owner"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
              background: filter === f ? "#F4A623" : "rgba(255,255,255,0.05)",
              color: filter === f ? "#0a0a0a" : "#888",
            }}>
              {f === "sin_owner" ? "Sin owner" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(r => (
          <button key={r.id} onClick={() => setSelected(r)} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
            background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12,
            cursor: "pointer", width: "100%", textAlign: "left", transition: "border-color 0.2s",
          }}
            onMouseOver={e => (e.currentTarget.style.borderColor = "rgba(244,166,35,0.3)")}
            onMouseOut={e => (e.currentTarget.style.borderColor = "#2A2A2A")}
          >
            {r.logoUrl ? (
              <img src={r.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(244,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#F4A623", flexShrink: 0 }}>{r.name.charAt(0)}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: F, fontSize: "0.92rem", color: "white", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#666", margin: 0 }}>/{r.slug} · {r._count.dishes} platos · {r._count.sessions} sesiones</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontFamily: F, fontSize: "0.6rem", fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                background: r.plan === "PREMIUM" ? "rgba(124,58,237,0.15)" : r.plan === "GOLD" ? "rgba(244,166,35,0.15)" : "rgba(255,255,255,0.06)",
                color: r.plan === "PREMIUM" ? "#c084fc" : r.plan === "GOLD" ? "#F4A623" : "#666",
              }}>
                {r.plan === "PREMIUM" ? "Premium" : r.plan === "GOLD" ? "Gold" : "Free"}
              </span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.isActive ? "#4ade80" : "#ff6b6b" }} />
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#666", textAlign: "center", padding: 40 }}>No hay locales que coincidan</p>
        )}
      </div>
    </div>
  );
}

function ToteatSection({ restaurant, onUpdate }: { restaurant: Restaurant; onUpdate: (patch: Partial<Restaurant>) => void }) {
  const isConfigured = !!(restaurant.toteatRestaurantId && restaurant.toteatLocalId !== null && restaurant.toteatUserId !== null && restaurant.toteatApiToken);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [xir, setXir] = useState(restaurant.toteatRestaurantId || "");
  const [xil, setXil] = useState(restaurant.toteatLocalId !== null ? String(restaurant.toteatLocalId) : "");
  const [xiu, setXiu] = useState(restaurant.toteatUserId !== null ? String(restaurant.toteatUserId) : "");
  const [token, setToken] = useState("");

  useEffect(() => {
    setXir(restaurant.toteatRestaurantId || "");
    setXil(restaurant.toteatLocalId !== null ? String(restaurant.toteatLocalId) : "");
    setXiu(restaurant.toteatUserId !== null ? String(restaurant.toteatUserId) : "");
    setToken("");
    setEditing(false);
    setMsg(null);
  }, [restaurant.id]);

  const save = async () => {
    setBusy(true); setMsg(null);
    const payload: any = {
      toteatRestaurantId: xir.trim() || null,
      toteatLocalId: xil.trim() || null,
      toteatUserId: xiu.trim() || null,
    };
    // Only send token if user actually typed something — empty input means "leave existing token"
    if (token.trim()) payload.toteatApiToken = token.trim();
    try {
      const res = await fetch(`/api/admin/locales/${restaurant.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "err", text: data.error || "Error al guardar" }); setBusy(false); return; }
      onUpdate({
        toteatRestaurantId: payload.toteatRestaurantId,
        toteatLocalId: payload.toteatLocalId === null ? null : Number(payload.toteatLocalId),
        toteatUserId: payload.toteatUserId === null ? null : Number(payload.toteatUserId),
        ...(token.trim() && { toteatApiToken: token.trim() }),
      });
      setMsg({ type: "ok", text: "Configuración guardada" });
      setEditing(false);
      setToken("");
    } catch {
      setMsg({ type: "err", text: "Error de conexión" });
    }
    setBusy(false);
  };

  const disconnect = async () => {
    if (!confirm("¿Desconectar este local de Toteat? Las ventas cacheadas se mantienen pero no se sincronizarán nuevas hasta que reconfigures.")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/locales/${restaurant.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toteatRestaurantId: null, toteatLocalId: null, toteatUserId: null, toteatApiToken: null }) });
      onUpdate({ toteatRestaurantId: null, toteatLocalId: null, toteatUserId: null, toteatApiToken: null });
      setXir(""); setXil(""); setXiu(""); setToken("");
      setMsg({ type: "ok", text: "Integración desconectada" });
      setEditing(false);
    } catch { setMsg({ type: "err", text: "Error" }); }
    setBusy(false);
  };

  const triggerSync = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/toteat/sync-now", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: restaurant.id, days: 7, force: true }) });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "err", text: data.error || "Error al sincronizar" }); }
      else if (data.skipped) { setMsg({ type: "ok", text: `Sincronización debounced — última corrida hace pocos minutos` }); }
      else { setMsg({ type: "ok", text: `Sincronización OK · ${data.upserted} ventas actualizadas` }); }
    } catch { setMsg({ type: "err", text: "Error" }); }
    setBusy(false);
  };

  return (
    <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid #2A2A2A", borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <div>
          <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "#fff", margin: 0 }}>
            🔌 Integración Toteat {isConfigured ? <span style={{ color: "#4ade80", fontSize: "0.7rem", marginLeft: 6 }}>● Conectado</span> : <span style={{ color: "#666", fontSize: "0.7rem", marginLeft: 6 }}>○ Sin configurar</span>}
          </p>
          {isConfigured && (
            <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#888", margin: "2px 0 0" }}>
              {restaurant.toteatLastSyncAt ? `Última sincronización: ${new Date(restaurant.toteatLastSyncAt).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Sin sincronizar aún"}
            </p>
          )}
        </div>
        <span style={{ color: "#666", fontSize: "0.8rem" }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #2A2A2A", display: "flex", flexDirection: "column", gap: 10 }}>
          {!editing && isConfigured ? (
            <div style={{ fontFamily: F, fontSize: "0.78rem", color: "#aaa" }}>
              <p style={{ margin: 0 }}><span style={{ color: "#666" }}>Restaurant ID (xir):</span> {restaurant.toteatRestaurantId}</p>
              <p style={{ margin: "4px 0 0" }}><span style={{ color: "#666" }}>Local ID (xil):</span> {restaurant.toteatLocalId}</p>
              <p style={{ margin: "4px 0 0" }}><span style={{ color: "#666" }}>User ID (xiu):</span> {restaurant.toteatUserId}</p>
              <p style={{ margin: "4px 0 0" }}><span style={{ color: "#666" }}>Token:</span> ••••••••{restaurant.toteatApiToken?.slice(-4)}</p>
            </div>
          ) : !editing && !isConfigured ? (
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", margin: 0 }}>Este local todavía no tiene integración con Toteat. Configura las credenciales para activar el cruce de vistas vs ventas, dashboard live y badges en tiempo real.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Input label="Restaurant ID (xir)" value={xir} onChange={setXir} placeholder="1028812002756304" />
              <Input label="Local ID (xil)" value={xil} onChange={setXil} placeholder="1" type="number" />
              <Input label="User ID API (xiu)" value={xiu} onChange={setXiu} placeholder="1002" type="number" />
              <Input label="Token (xapitoken)" value={token} onChange={setToken} placeholder={isConfigured ? "Dejar vacío para mantener el actual" : "CoN2rv5sTcYAdks..."} type="password" />
            </div>
          )}

          {msg && (
            <p style={{ fontFamily: F, fontSize: "0.74rem", margin: 0, color: msg.type === "ok" ? "#4ade80" : "#ef4444" }}>
              {msg.type === "ok" ? "✓ " : "✗ "}{msg.text}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {editing ? (
              <>
                <button onClick={save} disabled={busy} style={{ padding: "8px 14px", background: "#F4A623", color: "#000", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Guardando..." : "Guardar"}
                </button>
                <button onClick={() => { setEditing(false); setMsg(null); }} disabled={busy} style={{ padding: "8px 14px", background: "transparent", color: "#888", border: "1px solid #2A2A2A", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", cursor: "pointer" }}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} disabled={busy} style={{ padding: "8px 14px", background: "rgba(244,166,35,0.1)", color: "#F4A623", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                  {isConfigured ? "Editar credenciales" : "Configurar"}
                </button>
                {isConfigured && (
                  <>
                    <button onClick={triggerSync} disabled={busy} style={{ padding: "8px 14px", background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
                      {busy ? "Sincronizando..." : "Sincronizar ahora"}
                    </button>
                    <button onClick={disconnect} disabled={busy} style={{ padding: "8px 14px", background: "transparent", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                      Desconectar
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontFamily: F, fontSize: "0.66rem", color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 6, color: "#fff", fontFamily: "monospace", fontSize: "0.78rem", outline: "none" }}
      />
    </label>
  );
}
