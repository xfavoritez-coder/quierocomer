"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import PlanGate from "@/components/admin/PlanGate";
import { toast } from "sonner";
import { Camera, Phone, Globe, MapPin, Clock, QrCode, Bell, Copy, ExternalLink, Check, Store, Receipt } from "lucide-react";
import FacturacionPage from "./facturacionPage";
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
  dietType: string | null;
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
  const { activePlan } = usePanelSession();
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
  const [dietType, setDietType] = useState("OMNIVORE");
  const [highlightDiet, setHighlightDiet] = useState(false);
  const [highlightIg, setHighlightIg] = useState(false);
  const dietRef = useRef<HTMLDivElement>(null);
  const igRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const section = searchParams.get("section");

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
      const fromChecklist = section === "cocina" && !localStorage.getItem(`qc_diet_confirmed_${rid}`);
      setDietType(fromChecklist ? "" : (d.dietType || "OMNIVORE"));
    } catch {}
    setLoading(false);
  }, [rid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Handle ?section= query param for scroll + highlight (runs after data loads)
  useEffect(() => {
    if (loading || !section) return;

    setTimeout(() => {
      if (section === "cocina" && dietRef.current) {
        dietRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightDiet(true);
        setTimeout(() => setHighlightDiet(false), 2500);
      }
      if (section === "redes" && igRef.current) {
        igRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightIg(true);
        setTimeout(() => setHighlightIg(false), 2500);
      }
    }, 300);
  }, [loading, section, rid]);

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

  const saveInfo = () => {
    save({ name, description, logoUrl: logoUrl || null, dietType });
    if (rid) localStorage.setItem(`qc_diet_confirmed_${rid}`, "1");
  };
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
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}><Store size={20} color="var(--adm-text3)" /> Mi Restaurante</h1>
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

        <Field label="Tipo de cocina">
          <div ref={dietRef} style={{ display: "flex", gap: 8 }}>
            {highlightDiet && <style>{`@keyframes dietPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); box-shadow: 0 0 12px rgba(244,166,35,0.3); } }`}</style>}
            {([
              { value: "OMNIVORE", label: "Omnívoro", icon: "🍽️" },
              { value: "VEGETARIAN", label: "Vegetariano", icon: "🥗" },
              { value: "VEGAN", label: "Vegano", icon: "🌿" },
            ] as const).map(opt => {
              const active = dietType === opt.value;
              return (
                <button key={opt.value} onClick={() => setDietType(opt.value)} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                  background: active ? "rgba(244,166,35,0.12)" : "var(--adm-input)",
                  border: active ? "1px solid rgba(244,166,35,0.3)" : highlightDiet ? "1px solid rgba(244,166,35,0.2)" : "1px solid transparent",
                  color: active ? GOLD : "var(--adm-text3)",
                  fontFamily: F, fontSize: "0.78rem", fontWeight: active ? 700 : 500,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  transition: "all 0.2s",
                  animation: highlightDiet && !active ? "dietPulse 0.8s ease-in-out infinite" : "none",
                }}>
                  <span style={{ fontSize: "0.9rem" }}>{opt.icon}</span> {opt.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Instagram">
          <div ref={igRef} style={{ display: "flex", alignItems: "center", animation: highlightIg ? "dietPulse 0.8s ease-in-out infinite" : "none", borderRadius: 8 }}>
            {highlightIg && <style>{`@keyframes dietPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); box-shadow: 0 0 12px rgba(244,166,35,0.3); } }`}</style>}
            <span style={{ padding: "10px 10px 10px 14px", background: "var(--adm-input)", border: highlightIg ? "1px solid rgba(244,166,35,0.3)" : "1px solid var(--adm-input-border)", borderRight: "none", borderRadius: "8px 0 0 8px", fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)" }}>@</span>
            <input value={instagram} onChange={e => setInstagram(e.target.value.replace(/^@/, ""))} style={{ ...inputStyle, borderRadius: "0 8px 8px 0", ...(highlightIg ? { borderColor: "rgba(244,166,35,0.3)" } : {}) }} placeholder="tu_usuario" />
          </div>
        </Field>
        <Field label="Sitio web">
          <input value={website} onChange={e => setWebsite(e.target.value)} style={inputStyle} placeholder="https://tu-sitio.cl" type="url" />
        </Field>

        <button onClick={() => { saveInfo(); saveSocial(); }} disabled={saving} style={{ width: "100%", padding: 10, background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Guardando..." : "Guardar información"}
        </button>
      </Card>



      {/* ── Facturación ── */}
      <div style={{ marginBottom: 16 }}>
        <FacturacionPage />
      </div>




      {/* QR Modal */}
      {qrModalOpen && selectedRestaurant && (
        <QRGeneratorModal restaurant={selectedRestaurant} onClose={() => setQrModalOpen(false)} />
      )}
    </div>
  );
}
