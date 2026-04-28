"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { toast } from "sonner";
import { Check } from "lucide-react";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
  borderRadius: 8, fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--adm-text)",
  outline: "none", boxSizing: "border-box",
};

export default function AnunciosPage() {
  const { selectedRestaurantId: rid } = useAdminSession();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [annText, setAnnText] = useState("");
  const [annLink, setAnnLink] = useState("");
  const [annDays, setAnnDays] = useState<number[]>([]);
  const [annStart, setAnnStart] = useState("");
  const [annEnd, setAnnEnd] = useState("");
  const [annSaving, setAnnSaving] = useState(false);

  useEffect(() => {
    if (!rid) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/admin/announcements?restaurantId=${rid}`)
      .then(r => r.json())
      .then(d => setAnnouncements(d.announcements || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rid]);

  if (loading) return <SkeletonLoading type="form" />;
  if (!rid) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurant</p></div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.3rem", color: "var(--adm-text)", margin: "0 0 4px" }}>Cinta de anuncios</h1>
      <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>
        Publica avisos que aparecen en tu carta: horarios especiales, eventos, links a reservas o lo que necesites. Máximo 3 anuncios.
      </p>

      {/* Existing announcements */}
      {announcements.map((ann) => (
        <div key={ann.id} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px", marginBottom: 10, boxShadow: "var(--adm-card-shadow, none)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <button onClick={async () => {
              await fetch("/api/admin/announcements", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ann.id, isActive: !ann.isActive }) });
              setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, isActive: !a.isActive } : a));
              toast.success(ann.isActive ? "Anuncio desactivado" : "Anuncio activado");
            }} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${ann.isActive ? GOLD : "var(--adm-input-border)"}`, background: ann.isActive ? GOLD : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, marginTop: 2 }}>
              {ann.isActive && <Check size={13} color="white" />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: FB, fontSize: "0.92rem", color: ann.isActive ? "var(--adm-text)" : "var(--adm-text3)", margin: "0 0 4px", lineHeight: 1.4 }}>{ann.text}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ann.linkUrl && <span style={{ fontSize: "0.68rem", color: "#7fbfdc", background: "rgba(127,191,220,0.1)", padding: "2px 8px", borderRadius: 4 }}>🔗 {ann.linkUrl.replace(/^https?:\/\//, "").slice(0, 30)}</span>}
                {ann.daysOfWeek?.length > 0 && ann.daysOfWeek.length < 7 && <span style={{ fontSize: "0.68rem", color: "var(--adm-text3)", background: "var(--adm-hover)", padding: "2px 8px", borderRadius: 4 }}>{["Do","Lu","Ma","Mi","Ju","Vi","Sa"].filter((_: string, i: number) => ann.daysOfWeek.includes(i)).join(", ")}</span>}
                {ann.startDate && <span style={{ fontSize: "0.68rem", color: "var(--adm-text3)", background: "var(--adm-hover)", padding: "2px 8px", borderRadius: 4 }}>Desde {new Date(ann.startDate).toLocaleDateString("es-CL")}</span>}
                {ann.endDate && <span style={{ fontSize: "0.68rem", color: "var(--adm-text3)", background: "var(--adm-hover)", padding: "2px 8px", borderRadius: 4 }}>Hasta {new Date(ann.endDate).toLocaleDateString("es-CL")}</span>}
              </div>
            </div>
            <button onClick={async () => {
              await fetch("/api/admin/announcements", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ann.id }) });
              setAnnouncements(prev => prev.filter(a => a.id !== ann.id));
              toast.success("Anuncio eliminado");
            }} style={{ background: "none", border: "none", color: "var(--adm-text3)", cursor: "pointer", fontSize: "1rem", padding: 4, flexShrink: 0, marginTop: -2 }}>✕</button>
          </div>
        </div>
      ))}

      {announcements.length === 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "40px 20px", marginBottom: 20, textAlign: "center" }}>
          <p style={{ fontSize: "2rem", marginBottom: 8 }}>📢</p>
          <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text3)", margin: 0 }}>No tienes anuncios. Crea el primero.</p>
        </div>
      )}

      {/* Add new announcement */}
      {announcements.length < 3 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "20px", marginTop: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
          <h3 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 16px" }}>Nuevo anuncio</h3>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>Texto del anuncio</label>
            <input value={annText} onChange={e => setAnnText(e.target.value)} style={inputStyle} placeholder="Ej: Este viernes abrimos hasta las 2 AM" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>Link (opcional)</label>
            <input value={annLink} onChange={e => setAnnLink(e.target.value)} style={inputStyle} placeholder="https://..." />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>Días que se muestra <span style={{ textTransform: "none", fontWeight: 400, color: "var(--adm-text3)" }}>(vacío = todos los días)</span></label>
            <div style={{ display: "flex", gap: 6 }}>
              {["Do","Lu","Ma","Mi","Ju","Vi","Sa"].map((d, i) => (
                <button key={i} onClick={() => setAnnDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: FB, fontSize: "0.75rem", fontWeight: 600, background: annDays.includes(i) ? GOLD : "var(--adm-input)", color: annDays.includes(i) ? "white" : "var(--adm-text3)", transition: "all 0.15s" }}>{d}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>Desde (opcional)</label>
              <input type="date" value={annStart} onChange={e => setAnnStart(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>Hasta (opcional)</label>
              <input type="date" value={annEnd} onChange={e => setAnnEnd(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
            </div>
          </div>

          <button
            disabled={!annText.trim() || annSaving}
            onClick={async () => {
              setAnnSaving(true);
              try {
                const res = await fetch("/api/admin/announcements", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ restaurantId: rid, text: annText.trim(), linkUrl: annLink.trim() || null, daysOfWeek: annDays.length > 0 ? annDays : [], startDate: annStart || null, endDate: annEnd || null }),
                });
                const d = await res.json();
                if (!res.ok) { toast.error(d.error || "Error"); return; }
                setAnnouncements(prev => [...prev, d.announcement]);
                setAnnText(""); setAnnLink(""); setAnnDays([]); setAnnStart(""); setAnnEnd("");
                toast.success("Anuncio creado");
              } catch { toast.error("Error"); } finally { setAnnSaving(false); }
            }}
            style={{ width: "100%", padding: 12, background: annText.trim() ? GOLD : "var(--adm-input)", color: annText.trim() ? "white" : "var(--adm-text3)", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.88rem", fontWeight: 600, cursor: annText.trim() ? "pointer" : "default" }}
          >
            {annSaving ? "Guardando..." : "Crear anuncio"}
          </button>
        </div>
      )}
    </div>
  );
}
