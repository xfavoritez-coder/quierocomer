"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Source = "photo" | "link" | "none";

const CUISINES = ["Sushi", "Pizzería", "Hamburguesas", "Cafetería", "Cocina chilena", "Cocina de autor", "Peruana", "Mexicana", "Italiana", "Vegana / vegetariana", "Pastelería", "Comida rápida", "Bar", "Otra"];
const COMMUNES = ["Santiago", "Providencia", "Las Condes", "Vitacura", "Lo Barnechea", "Ñuñoa", "La Reina", "Macul", "Peñalolén", "La Florida", "Puente Alto", "Maipú", "San Miguel", "Recoleta", "Independencia", "Estación Central", "Quilicura", "Huechuraba", "Viña del Mar", "Valparaíso", "Concepción"];

const SOURCES: { id: Source; title: string; desc: string; icon: string }[] = [
  { id: "photo", title: "Foto de la carta", desc: "Saca una o varias fotos", icon: "📷" },
  { id: "link", title: "Link", desc: "Fudo, Toteat, Instagram, web…", icon: "🔗" },
  { id: "none", title: "Sin datos", desc: "Solo el nombre: usa el local de ejemplo", icon: "✨" },
];

export default function VentasNuevoPage() {
  const router = useRouter();
  const [source, setSource] = useState<Source>("photo");
  const [localName, setLocalName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [commune, setCommune] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [address, setAddress] = useState("");
  const [cartaUrl, setCartaUrl] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos, ...Array.from(files).filter((f) => f.type.startsWith("image/")).map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(0, 10);
    setPhotos(next);
  };

  const canSubmit = !busy && (source === "photo" ? photos.length > 0 : source === "link" ? cartaUrl.trim().length > 3 : localName.trim().length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      const photoUrls: string[] = [];
      for (let i = 0; i < (source === "photo" ? photos.length : 0); i++) {
        setBusy(`Subiendo foto ${i + 1} de ${photos.length}…`);
        const fd = new FormData();
        fd.append("file", photos[i].file);
        const r = await fetch("/api/ventas/upload", { method: "POST", body: fd });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "No se pudo subir la foto");
        photoUrls.push(d.url);
      }
      setBusy("Creando el local…");
      const r = await fetch("/api/ventas/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, localName, cuisine, commune, contactName, whatsapp: contactPhone, email: contactEmail, address, cartaUrl, photoUrls }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo crear el local");
      router.push(d.needsProcessing ? `/ventas/${d.id}/armando` : `/ventas/${d.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 6, display: "block" };

  return (
    <form onSubmit={submit} style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 20 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Nuevo local</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {SOURCES.map((s) => (
          <button key={s.id} type="button" onClick={() => setSource(s.id)} className="ventas-card" style={{
            padding: "16px 16px", textAlign: "left", cursor: "pointer", font: "inherit",
            borderColor: source === s.id ? "var(--amber)" : "var(--line)", boxShadow: source === s.id ? "0 0 0 2px var(--amber-tint)" : "none",
          }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontWeight: 800, marginTop: 6 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>{s.desc}</div>
          </button>
        ))}
      </div>

      {source === "photo" && (
        <div className="ventas-card" style={{ padding: 16 }}>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="ventas-btn" onClick={() => cameraRef.current?.click()}>📷 Tomar foto</button>
            <button type="button" className="ventas-btn ghost" onClick={() => galleryRef.current?.click()}>Elegir fotos</button>
          </div>
          {photos.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {photos.map((p, i) => (
                <div key={p.preview} style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt={`Foto ${i + 1}`} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
                  <button type="button" aria-label="Quitar foto" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "#111", color: "#fff", cursor: "pointer", fontSize: 12 }}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "12px 0 0" }}>Hasta 10 fotos. Una por página de la carta.</p>
          )}
        </div>
      )}

      {source === "link" && (
        <div>
          <label style={label}>Link de la carta</label>
          <input className="ventas-input" inputMode="url" placeholder="fudo.cl/milocal, instagram.com/milocal, toteat…" value={cartaUrl} onChange={(e) => setCartaUrl(e.target.value)} />
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={label}>Nombre del local {source !== "none" && <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>(opcional si viene en la carta)</span>}</label>
          <input className="ventas-input" placeholder="Ej: Caléndula" value={localName} onChange={(e) => setLocalName(e.target.value)} />
        </div>
        <details style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "12px 14px", background: "var(--surface)" }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, color: "var(--ink-2)" }}>Más datos <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>(opcional)</span></summary>
        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <div>
            <label style={label}>Tipo de cocina</label>
            <select className="ventas-input" value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
              <option value="">Elegir…</option>
              {CUISINES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Comuna</label>
            <input className="ventas-input" list="ventas-comunas" placeholder="Ej: Providencia" value={commune} onChange={(e) => setCommune(e.target.value)} />
            <datalist id="ventas-comunas">{COMMUNES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <div>
            <label style={label}>Nombre de contacto</label>
            <input className="ventas-input" placeholder="Con quién hablaste" autoComplete="off" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <label style={label}>Teléfono / WhatsApp</label>
            <input className="ventas-input" inputMode="tel" placeholder="9 1234 5678" autoComplete="off" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div>
            <label style={label}>Correo</label>
            <input className="ventas-input" type="email" inputMode="email" placeholder="dueno@milocal.cl" autoComplete="off" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={label}>Dirección del local</label>
          <input className="ventas-input" placeholder="Ej: Av. Italia 1450, Providencia" autoComplete="off" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        </div>
        </details>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 14, margin: 0 }}>{error}</p>}
      <button className="ventas-btn" type="submit" disabled={!canSubmit} style={{ fontSize: 17, padding: "16px 24px" }}>
        {busy || (source === "none" ? "Crear local" : "Armar su local →")}
      </button>
    </form>
  );
}
