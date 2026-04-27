"use client";
import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { toast } from "sonner";
import { Camera, Phone, Globe, MapPin, Clock, QrCode, Bell, Copy, ExternalLink, Check } from "lucide-react";
import SubirFoto from "@/components/SubirFoto";
import QRGeneratorModal from "@/components/admin/QRGeneratorModal";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const DAYS = [
  { key: "lun", label: "Lunes" },
  { key: "mar", label: "Martes" },
  { key: "mie", label: "Miércoles" },
  { key: "jue", label: "Jueves" },
  { key: "vie", label: "Viernes" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

interface RestaurantData {
  id: string; slug: string; name: string; description: string | null;
  logoUrl: string | null; bannerUrl: string | null;
  phone: string | null; whatsapp: string | null; address: string | null;
  instagram: string | null; website: string | null;
  scheduleJson: Record<string, string> | null;
  waiterPanelActive: boolean;
}

function Card({ children, title, icon: Icon }: { children: React.ReactNode; title: string; icon?: any }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
      <h3 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
        {Icon && <Icon size={18} color={GOLD} />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
  borderRadius: 8, fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--adm-text)",
  outline: "none", boxSizing: "border-box",
};

export default function MiRestaurantePage() {
  const { selectedRestaurantId, restaurants } = useAdminSession();
  const [data, setData] = useState<RestaurantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [schedule, setSchedule] = useState<Record<string, string>>({});

  const rid = selectedRestaurantId;

  const fetchData = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/locales/${rid}`);
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setData(d);
      setName(d.name || "");
      setDescription(d.description || "");
      setLogoUrl(d.logoUrl || "");
      setBannerUrl(d.bannerUrl || "");
      setPhone(d.phone || "");
      setWhatsapp(d.whatsapp || "");
      setAddress(d.address || "");
      setInstagram(d.instagram || "");
      setWebsite(d.website || "");
      setSchedule(d.scheduleJson || {});
    } catch {}
    setLoading(false);
  }, [rid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const save = async (fields: Record<string, any>) => {
    if (!rid) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/locales/${rid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        toast.success("Guardado");
        const updated = await res.json();
        setData(updated);
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al guardar");
      }
    } catch { toast.error("Error de conexión"); }
    setSaving(false);
  };

  const saveInfo = () => save({ name, description, logoUrl: logoUrl || null, bannerUrl: bannerUrl || null });
  const saveContact = () => save({ phone: phone || null, whatsapp: whatsapp || null, address: address || null });
  const saveSocial = () => save({ instagram: instagram || null, website: website || null });
  const saveSchedule = () => save({ scheduleJson: Object.keys(schedule).length > 0 ? schedule : null });

  const updateDay = (key: string, value: string) => {
    setSchedule(prev => ({ ...prev, [key]: value }));
  };
  const toggleDay = (key: string) => {
    setSchedule(prev => {
      const copy = { ...prev };
      if (copy[key] === "closed") { delete copy[key]; }
      else { copy[key] = "closed"; }
      return copy;
    });
  };
  const copyScheduleToAll = () => {
    const first = DAYS.find(d => schedule[d.key] && schedule[d.key] !== "closed");
    if (!first) return;
    const val = schedule[first.key];
    const newSched: Record<string, string> = {};
    DAYS.forEach(d => { newSched[d.key] = val; });
    setSchedule(newSched);
  };

  const garzonLink = data ? `https://quierocomer.cl/qr/admin/garzon/${data.slug}` : "";

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedRestaurant = restaurants.find(r => r.id === rid);

  if (loading) return <SkeletonLoading type="form" />;
  if (!data || !rid) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurant</p></div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.3rem", color: "var(--adm-text)", margin: "0 0 4px" }}>Mi Restaurante</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>Configura la información y apariencia de tu local</p>

      {/* ── Info básica ── */}
      <Card title="Información básica" icon={Camera}>
        {/* Logo */}
        <Field label="Logo">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `2px solid ${GOLD}` }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--adm-input)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed var(--adm-card-border)" }}>
                <Camera size={20} color="var(--adm-text3)" />
              </div>
            )}
            <SubirFoto folder="logos" label="Cambiar logo" circular height="64px" onUpload={(url: string) => setLogoUrl(url)} />
          </div>
        </Field>

        <Field label="Nombre del local">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Nombre del restaurant" />
        </Field>

        <Field label={`Descripción (${description.length}/200)`}>
          <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 200))} maxLength={200} rows={3}
            style={{ ...inputStyle, resize: "vertical", minHeight: 70 }} placeholder="Breve descripción de tu local" />
        </Field>

        <button onClick={saveInfo} disabled={saving} style={{ width: "100%", padding: 10, background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Guardando..." : "Guardar información"}
        </button>
      </Card>

      {/* ── Contacto ── */}
      <Card title="Contacto" icon={Phone}>
        <Field label="Teléfono">
          <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="+56 2 1234 5678" type="tel" />
        </Field>
        <Field label="WhatsApp">
          <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inputStyle} placeholder="+56 9 1234 5678" type="tel" />
          <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", marginTop: 3 }}>Incluye código país: +56 9 ...</p>
        </Field>
        <Field label="Dirección">
          <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} placeholder="Av. Providencia 1234, Santiago" />
        </Field>
        <button onClick={saveContact} disabled={saving} style={{ width: "100%", padding: 10, background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Guardando..." : "Guardar contacto"}
        </button>
      </Card>

      {/* ── Redes ── */}
      <Card title="Redes sociales y web" icon={Globe}>
        <Field label="Instagram">
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ padding: "10px 10px 10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)", borderRight: "none", borderRadius: "8px 0 0 8px", fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)" }}>@</span>
            <input value={instagram} onChange={e => setInstagram(e.target.value.replace(/^@/, ""))} style={{ ...inputStyle, borderRadius: "0 8px 8px 0" }} placeholder="tu_usuario" />
          </div>
        </Field>
        <Field label="Sitio web">
          <input value={website} onChange={e => setWebsite(e.target.value)} style={inputStyle} placeholder="https://tu-sitio.cl" type="url" />
        </Field>
        <button onClick={saveSocial} disabled={saving} style={{ width: "100%", padding: 10, background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Guardando..." : "Guardar redes"}
        </button>
      </Card>

      {/* ── Horarios ── */}
      <Card title="Horarios" icon={Clock}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DAYS.map(day => {
            const val = schedule[day.key];
            const isClosed = val === "closed";
            const isOpen = val && val !== "closed";
            return (
              <div key={day.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", width: 80, flexShrink: 0 }}>{day.label}</span>
                <button onClick={() => toggleDay(day.key)} style={{
                  padding: "4px 10px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: isClosed ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                  color: isClosed ? "#ef4444" : "#22c55e",
                  fontFamily: FB, fontSize: "0.7rem", fontWeight: 600, flexShrink: 0,
                }}>
                  {isClosed ? "Cerrado" : "Abierto"}
                </button>
                {!isClosed && (
                  <input
                    value={val || ""}
                    onChange={e => updateDay(day.key, e.target.value)}
                    style={{ ...inputStyle, padding: "6px 10px", fontSize: "0.78rem", flex: 1, minWidth: 0 }}
                    placeholder="12:00-23:00"
                  />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={copyScheduleToAll} style={{ flex: 1, padding: 8, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", cursor: "pointer" }}>
            Copiar a todos los días
          </button>
          <button onClick={saveSchedule} disabled={saving} style={{ flex: 1, padding: 8, background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Guardando..." : "Guardar horarios"}
          </button>
        </div>
      </Card>

      {/* ── Generar QR ── */}
      <div id="qr" style={{ background: "linear-gradient(135deg, #FFF4E0, #FDEFC7)", border: "1px solid #E8D0A0", borderRadius: 16, padding: "24px 20px", marginBottom: 16, textAlign: "center" }}>
        <QrCode size={40} color={GOLD} style={{ marginBottom: 10 }} />
        <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px" }}>Código QR de tu local</h3>
        <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "#8a7550", margin: "0 0 16px", lineHeight: 1.5 }}>
          Imprime este código para pegarlo en las mesas. Tus clientes lo escanean y ven tu carta.
        </p>
        <button onClick={() => setQrModalOpen(true)} style={{
          padding: "12px 32px", background: GOLD, color: "white", border: "none", borderRadius: 50,
          fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 14px rgba(244,166,35,0.25)",
        }}>
          Generar QR
        </button>
      </div>

      {/* ── Link del garzón ── */}
      <div id="garzon" style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "24px 20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <Bell size={36} color={GOLD} style={{ marginBottom: 8 }} />
          <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>Panel de llamadas del garzón</h3>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
            Comparte este link con tu garzón para que reciba notificaciones cuando los clientes llamen.
          </p>
        </div>

        {/* Link display */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--adm-input)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--adm-input-border)", marginBottom: 12 }}>
          <span style={{ fontFamily: FB, fontSize: "0.72rem", color: GOLD, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{garzonLink}</span>
          <button onClick={() => copyLink(garzonLink)} style={{
            padding: "6px 12px", background: copied ? "rgba(34,197,94,0.15)" : `rgba(244,166,35,0.15)`,
            border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            fontFamily: FB, fontSize: "0.7rem", fontWeight: 600, color: copied ? "#22c55e" : GOLD, flexShrink: 0,
          }}>
            {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <a href={garzonLink} target="_blank" rel="noopener noreferrer" style={{
            flex: 1, padding: "10px", background: GOLD, color: "white", border: "none", borderRadius: 8,
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textDecoration: "none", textAlign: "center",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <ExternalLink size={14} /> Abrir panel
          </a>
        </div>

        <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", marginTop: 12, textAlign: "center" }}>
          Este link es público. No lo compartas en redes sociales.
        </p>
      </div>

      {/* ── Fotos referenciales ── */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>📷 Fotos referenciales</h3>
            <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: 0 }}>Muestra "Imagen referencial" en todos los platos de tu carta</p>
          </div>
          <button
            onClick={() => save({ allPhotosReferential: !(data as any)?.allPhotosReferential })}
            style={{
              width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
              background: (data as any)?.allPhotosReferential ? GOLD : "var(--adm-input-border)",
              transition: "background 0.2s",
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: "50%", background: "white", position: "absolute", top: 3,
              left: (data as any)?.allPhotosReferential ? 23 : 3, transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </button>
        </div>
      </div>

      {/* QR Modal */}
      {qrModalOpen && selectedRestaurant && (
        <QRGeneratorModal restaurant={selectedRestaurant} onClose={() => setQrModalOpen(false)} />
      )}
    </div>
  );
}
