"use client";
import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/adminFetch";
import SubirFoto from "@/components/SubirFoto";

const CATEGORIAS_MASTER: string[] = ["Sushi", "Pizza", "Hamburguesa", "Mexicano", "Vegano", "Vegetariano", "Saludable", "Pastas", "Pollo", "Mariscos", "Carnes / Parrilla", "Árabe", "Peruano", "India", "Coreano", "Thai", "Ramen", "Fusión", "Café", "Postres", "Brunch", "Chifa", "Empanadas", "Poke Bowl", "Sandwich", "Jugos y Smoothies", "Mediterráneo", "Sin gluten"];
const CATEGORIA_EMOJI: Record<string, string> = { "Sushi": "🍣", "Pizza": "🍕", "Hamburguesa": "🍔", "Mexicano": "🌮", "Vegano": "🌿", "Vegetariano": "🌱", "Saludable": "🥗", "Pastas": "🍝", "Pollo": "🍗", "Mariscos": "🦐", "Carnes / Parrilla": "🥩", "Árabe": "🧆", "Peruano": "🇵🇪", "India": "🍛", "Coreano": "🇰🇷", "Thai": "🍜", "Ramen": "🍜", "Fusión": "🍽️", "Café": "☕", "Postres": "🍰", "Brunch": "🥞", "Chifa": "🥡", "Empanadas": "🥟", "Poke Bowl": "🥙", "Sandwich": "🥪", "Jugos y Smoothies": "🧃", "Mediterráneo": "🫒", "Sin gluten": "🌾" };

const COMUNAS = ["Providencia", "Santiago Centro", "Ñuñoa", "Las Condes", "Vitacura", "San Miguel", "Maipú", "La Florida", "Pudahuel", "Peñalolén", "Macul", "La Reina", "Lo Barnechea", "Huechuraba", "Recoleta", "Independencia", "Estación Central", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "La Cisterna", "La Granja", "La Pintana", "Lo Espejo", "Lo Prado", "Quilicura", "Quinta Normal", "Renca", "San Bernardo", "San Joaquín", "San Ramón", "Padre Hurtado", "Puente Alto", "Pirque", "Colina", "Lampa", "Melipilla", "Talagante", "Pedro Aguirre Cerda", "Buin"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type L = any;

type HorarioDia = { activo: boolean; abre: string; cierra: string };
const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DEFAULT_HORARIOS: HorarioDia[] = DIAS_SEMANA.map(() => ({ activo: true, abre: "12:00", cierra: "22:00" }));

export default function AdminLocales() {
  const [locales, setLocales] = useState<L[]>([]);
  const [localesGoogle, setLocalesGoogle] = useState<L[]>([]);
  const [busq, setBusq] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [sel, setSel] = useState<L | null>(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [editHorarios, setEditHorarios] = useState<HorarioDia[]>(DEFAULT_HORARIOS);
  const [passMode, setPassMode] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [crearMode, setCrearMode] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [crearData, setCrearData] = useState<Record<string, any>>({ nombre: "", email: "", password: "", comuna: "", direccion: "", categorias: [], descripcion: "", lat: 0, lng: 0 });
  const [crearBuscando, setCrearBuscando] = useState(false);
  const [editBuscando, setEditBuscando] = useState(false);
  const CATEGORIAS = [...CATEGORIAS_MASTER];

  useEffect(() => { adminFetch("/api/admin/locales").then(r => r.json()).then(d => setLocales(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  const show = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const action = async (accion: string, extra?: Record<string, unknown>) => {
    if (!sel) return;
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/locales/${sel.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion, ...extra }) });
      if (!res.ok) { const d = await res.json(); show(d.error ?? "Error"); setLoading(false); return false; }
      setLoading(false); return true;
    } catch { show("Error de conexión"); setLoading(false); return false; }
  };

  const pendientes = locales.filter(l => !l.activo).length;
  const activos = locales.filter(l => l.activo).length;
  const isGoogleFilter = filtro === "importados";
  const sourceList = isGoogleFilter ? localesGoogle : locales;
  const filtered = sourceList.filter(l => {
    if (busq && !l.nombre?.toLowerCase().includes(busq.toLowerCase()) && !l.email?.toLowerCase().includes(busq.toLowerCase())) return false;
    if (filtro === "activos" && !l.activo) return false;
    if (filtro === "pendientes" && (l.activo || l.origenImportacion === "GOOGLE_PLACES")) return false;
    if (filtro === "reclamados" && !(l.origenImportacion === "GOOGLE_PLACES" && !l.activo && l.estadoLocal !== "RECHAZADO")) return false;
    return true;
  });

  const resetModes = () => { setEditMode(false); setPassMode(false); setDeleteConfirm(false); setRejectMode(false); setRejectMotivo(""); };

  // ── DETAIL VIEW ──
  if (sel) return (
    <div>
      {toast && <div style={toastS}>{toast}</div>}
      <button onClick={() => { setSel(null); resetModes(); }} style={backS}>← Locales</button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
        <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: sel.logoUrl ? "transparent" : "linear-gradient(135deg, #2a7a6f, #3db89e)", border: "2px solid rgba(232,168,76,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 700, color: "#fff", flexShrink: 0, overflow: "hidden" }}>{sel.logoUrl ? <img src={sel.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : sel.nombre?.charAt(0).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: "var(--font-display)", color: "#FFD600", fontSize: "1.1rem", margin: 0, wordBreak: "break-word" }}>{sel.nombre}</h2>
          <p style={{ fontFamily: "var(--font-display)", color: "rgba(240,234,214,0.5)", fontSize: "0.8rem", margin: "2px 0 0", wordBreak: "break-all" }}>{sel.email}</p>
        </div>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: sel.activo ? "#3db89e" : "#ff8080", background: sel.activo ? "rgba(61,184,158,0.1)" : "rgba(255,100,100,0.1)", border: `1px solid ${sel.activo ? "rgba(61,184,158,0.3)" : "rgba(255,100,100,0.3)"}`, borderRadius: "20px", padding: "4px 12px" }}>{sel.activo ? "✓ Activo" : "⏳ Pendiente"}</span>
        {sel.captadorCodigo && <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#FFD600", background: "rgba(232,168,76,0.12)", border: "1px solid rgba(232,168,76,0.3)", borderRadius: "6px", padding: "3px 10px" }}>🤝 Captado por {sel.captadorCodigo}</span>}
      </div>
      {sel.captadorCodigo && !sel.activo && (
        <p style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "rgba(240,234,214,0.5)", fontStyle: "italic", marginBottom: 16, background: "rgba(232,168,76,0.06)", border: "1px solid rgba(232,168,76,0.12)", borderRadius: 8, padding: "10px 14px" }}>
          Este local fue registrado por un captador ({sel.captadorCodigo}). Verifica que el local haya dado su consentimiento antes de activar.
        </p>
      )}

      {/* Portada + Logo */}
      <div style={cardS}>
        <div style={{ height: "120px", borderRadius: "10px", overflow: "hidden", marginBottom: "12px", position: "relative" }}>
          {sel.portadaUrl ? (
            <img src={sel.portadaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #2d1a08, #0D0D0D)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "2rem", opacity: 0.2 }}>🍽️</span>
            </div>
          )}
          {sel.logoUrl && <img src={sel.logoUrl} alt="" style={{ position: "absolute", bottom: "8px", left: "12px", width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(232,168,76,0.4)" }} />}
        </div>
      </div>

      {/* Info card */}
      <div style={cardS}>
        <p style={cardTitleS}>Datos del local</p>
        {[["Nombre", sel.nombre], ["Categorías", (sel.categorias ?? []).join(", ") || "—"], ["Comuna", sel.comuna], ["Dirección", sel.direccion], ["Teléfono", sel.telefono], ["Instagram", sel.instagram], ["Sitio web", sel.sitioWeb], ["Dueño", sel.nombreDueno], ["Celular dueño", sel.celularDueno], ["Email", sel.email], ["Registro", new Date(sel.createdAt).toLocaleDateString("es-CL")]].map(([l, v]) => <Row key={l} label={l} value={v ?? "—"} />)}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {(sel.sirveEnMesa ?? true) && <span style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: "10px", background: "rgba(128,64,208,0.1)", border: "1px solid rgba(128,64,208,0.2)", color: "#a070e0" }}>En mesa</span>}
          {sel.tieneDelivery && <span style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: "10px", background: "rgba(61,184,158,0.1)", border: "1px solid rgba(61,184,158,0.2)", color: "#3db89e" }}>Delivery</span>}
          {sel.tieneRetiro && <span style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: "10px", background: "rgba(232,168,76,0.1)", border: "1px solid rgba(232,168,76,0.2)", color: "#FFD600" }}>Retiro</span>}
        </div>
        {sel.descripcion && <div style={{ marginTop: "8px", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}><p style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "rgba(240,234,214,0.4)", marginBottom: "4px" }}>Descripción</p><p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "rgba(240,234,214,0.7)", lineHeight: 1.5 }}>{sel.descripcion}</p></div>}
      </div>

      <div style={cardS}>
        <p style={cardTitleS}>Estadísticas</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {[["🏆", sel._count?.concursos ?? 0, "Concursos"], ["⚡", sel._count?.promociones ?? 0, "Promos"], ["💛", sel._count?.favoritos ?? 0, "Favs"], ["👁️", sel.vistas ?? 0, "Vistas"]].map(([icon, val, label]) => (
            <div key={String(label)} style={{ textAlign: "center", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
              <p style={{ fontSize: "1rem", margin: "0 0 2px" }}>{icon}</p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#FFD600", margin: 0 }}>{val}</p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "rgba(240,234,214,0.4)", margin: "2px 0 0" }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div style={cardS}>
          <p style={cardTitleS}>Editar datos</p>
          {[["nombre", "Nombre local"], ["nombreDueno", "Nombre dueño"], ["celularDueno", "Celular dueño"], ["telefono", "Teléfono"], ["instagram", "Instagram"], ["sitioWeb", "Sitio web"]].map(([key, label]) => (
            <div key={key} style={{ marginBottom: "10px" }}>
              <label style={labelS}>{label}</label>
              <input style={inputS} value={editData[key] ?? ""} onChange={e => setEditData(d => ({ ...d, [key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ marginBottom: "10px" }}>
            <label style={labelS}>Dirección</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input style={{ ...inputS, flex: 1 }} value={editData.direccion ?? ""} onChange={e => setEditData(d => ({ ...d, direccion: e.target.value }))} placeholder="Ej: Av. Providencia 1234" />
              <button type="button" disabled={editBuscando || !editData.direccion?.trim()} onClick={async () => {
                setEditBuscando(true);
                try {
                  const q = `${editData.direccion}, ${editData.comuna || "Santiago"}, Chile`;
                  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`);
                  const data = await res.json();
                  if (data[0]) {
                    setEditData(d => ({ ...d, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }));
                    show("✓ Ubicación encontrada");
                  } else { show("No se encontró la dirección"); }
                } catch { show("Error buscando dirección"); }
                setEditBuscando(false);
              }} style={{ ...btnSecS, flex: "none", padding: "8px 14px", fontSize: "0.75rem", whiteSpace: "nowrap" }}>{editBuscando ? "..." : "📍 Buscar"}</button>
            </div>
          </div>
          {(editData.lat || editData.lng) && (
            <div style={{ marginBottom: "10px", padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 12, fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "rgba(240,234,214,0.5)" }}>
              Lat: {editData.lat}, Lng: {editData.lng}
            </div>
          )}
          <div style={{ marginBottom: "10px" }}>
            <label style={labelS}>Comuna</label>
            <select style={inputS} value={editData.comuna ?? ""} onChange={e => setEditData(d => ({ ...d, comuna: e.target.value }))}>
              <option value="">Seleccionar...</option>
              {COMUNAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={labelS}>Categorías (máx. 3)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {CATEGORIAS.map(cat => {
                const cats: string[] = editData.categorias ?? [];
                const idx = cats.indexOf(cat);
                const sel2 = idx !== -1;
                const isPrimary = idx === 0;
                const maxed = cats.length >= 3 && !sel2;
                return <button key={cat} type="button" disabled={maxed} onClick={() => {
                  const cur: string[] = editData.categorias ?? [];
                  setEditData(d => ({ ...d, categorias: sel2 ? cur.filter(c => c !== cat) : [...cur, cat] }));
                }} style={{ padding: "5px 12px", borderRadius: "16px", border: sel2 ? (isPrimary ? "1px solid #FFD600" : "1px solid rgba(61,184,158,0.3)") : "1px solid rgba(232,168,76,0.15)", background: sel2 ? (isPrimary ? "rgba(232,168,76,0.15)" : "rgba(61,184,158,0.12)") : "transparent", color: sel2 ? (isPrimary ? "#FFD600" : "#3db89e") : maxed ? "rgba(240,234,214,0.2)" : "rgba(240,234,214,0.5)", fontFamily: "var(--font-display)", fontSize: "0.78rem", cursor: maxed ? "default" : "pointer", opacity: maxed ? 0.3 : 1 }}>{CATEGORIA_EMOJI[cat] ?? "🍽️"} {cat}{isPrimary ? " ★" : ""}</button>;
              })}
            </div>
          </div>
          <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={labelS}>Sirve en mesa</label>
            <button type="button" onClick={() => setEditData(d => ({ ...d, sirveEnMesa: !d.sirveEnMesa }))} style={{ padding: "4px 14px", borderRadius: "20px", border: editData.sirveEnMesa ? "1px solid #3db89e" : "1px solid rgba(255,80,80,0.3)", background: editData.sirveEnMesa ? "rgba(61,184,158,0.12)" : "rgba(255,80,80,0.08)", color: editData.sirveEnMesa ? "#3db89e" : "#ff6b6b", fontFamily: "var(--font-display)", fontSize: "0.78rem", cursor: "pointer" }}>{editData.sirveEnMesa ? "Sí" : "No"}</button>
          </div>
          <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={labelS}>Tiene delivery</label>
            <button type="button" onClick={() => setEditData(d => ({ ...d, tieneDelivery: !d.tieneDelivery }))} style={{ padding: "4px 14px", borderRadius: "20px", border: editData.tieneDelivery ? "1px solid #3db89e" : "1px solid rgba(255,80,80,0.3)", background: editData.tieneDelivery ? "rgba(61,184,158,0.12)" : "rgba(255,80,80,0.08)", color: editData.tieneDelivery ? "#3db89e" : "#ff6b6b", fontFamily: "var(--font-display)", fontSize: "0.78rem", cursor: "pointer" }}>{editData.tieneDelivery ? "Sí" : "No"}</button>
          </div>
          <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={labelS}>Tiene retiro</label>
            <button type="button" onClick={() => setEditData(d => ({ ...d, tieneRetiro: !d.tieneRetiro }))} style={{ padding: "4px 14px", borderRadius: "20px", border: editData.tieneRetiro ? "1px solid #3db89e" : "1px solid rgba(255,80,80,0.3)", background: editData.tieneRetiro ? "rgba(61,184,158,0.12)" : "rgba(255,80,80,0.08)", color: editData.tieneRetiro ? "#3db89e" : "#ff6b6b", fontFamily: "var(--font-display)", fontSize: "0.78rem", cursor: "pointer" }}>{editData.tieneRetiro ? "Sí" : "No"}</button>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={labelS}>Descripción</label>
            <textarea style={{ ...inputS, minHeight: "60px", resize: "vertical" }} value={editData.descripcion ?? ""} onChange={e => setEditData(d => ({ ...d, descripcion: e.target.value }))} />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={labelS}>Logo</label>
            <SubirFoto folder="locales/logos" preview={editData.logoUrl || null} label="Subir logo" height="80px" onUpload={url => setEditData(d => ({ ...d, logoUrl: url }))} />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={labelS}>Portada</label>
            <SubirFoto folder="locales/portadas" preview={editData.portadaUrl || null} label="Subir portada" height="120px" onUpload={url => setEditData(d => ({ ...d, portadaUrl: url }))} />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ ...labelS, marginBottom: "8px" }}>Horarios</label>
            {DIAS_SEMANA.map((dia, i) => (
              <div key={dia} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <input type="checkbox" checked={editHorarios[i]?.activo ?? true} onChange={e => setEditHorarios(h => h.map((d, j) => j === i ? { ...d, activo: e.target.checked } : d))} style={{ accentColor: "#FFD600", width: "16px", height: "16px" }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "rgba(240,234,214,0.7)", width: "80px" }}>{dia}</span>
                {editHorarios[i]?.activo ? (<>
                  <input type="time" value={editHorarios[i]?.abre ?? "12:00"} onChange={e => setEditHorarios(h => h.map((d, j) => j === i ? { ...d, abre: e.target.value } : d))} style={{ ...inputS, width: "auto", padding: "6px 8px", fontSize: "0.78rem" }} />
                  <span style={{ color: "rgba(240,234,214,0.3)" }}>—</span>
                  <input type="time" value={editHorarios[i]?.cierra ?? "22:00"} onChange={e => setEditHorarios(h => h.map((d, j) => j === i ? { ...d, cierra: e.target.value } : d))} style={{ ...inputS, width: "auto", padding: "6px 8px", fontSize: "0.78rem" }} />
                </>) : <span style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#ff6b6b" }}>Cerrado</span>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={async () => { const payload = { ...editData, horarios: editHorarios }; if (await action("editar", payload)) { setSel({ ...sel, ...payload }); setLocales(p => p.map(l => l.id === sel.id ? { ...l, ...payload } : l)); setEditMode(false); show("✓ Datos actualizados"); } }} disabled={loading} style={btnPrimaryS}>{loading ? "..." : "Guardar"}</button>
            <button onClick={() => setEditMode(false)} style={btnSecS}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Change password */}
      {passMode && (
        <div style={cardS}>
          <p style={cardTitleS}>Cambiar contraseña</p>
          <input style={{ ...inputS, marginBottom: "10px" }} type="password" placeholder="Nueva contraseña (mín. 8)" value={newPass} onChange={e => setNewPass(e.target.value)} />
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={async () => { if (newPass.length < 8) { show("Mínimo 8 caracteres"); return; } if (await action("cambiar-password", { nuevaPassword: newPass })) { setPassMode(false); setNewPass(""); show("✓ Contraseña cambiada"); } }} disabled={loading} style={btnPrimaryS}>{loading ? "..." : "Cambiar"}</button>
            <button onClick={() => { setPassMode(false); setNewPass(""); }} style={btnSecS}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Reject form */}
      {rejectMode && (
        <div style={{ ...cardS, borderColor: "rgba(255,80,80,0.3)" }}>
          <p style={{ ...cardTitleS, color: "#ff6b6b" }}>{sel.activo ? "Desactivar" : "Rechazar"} local</p>
          <textarea style={{ ...inputS, minHeight: "60px", resize: "vertical", marginBottom: "10px" }} value={rejectMotivo} onChange={e => setRejectMotivo(e.target.value)} placeholder="Motivo (opcional)" />
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={async () => { if (await action("rechazar", { motivoRechazo: rejectMotivo })) { setSel({ ...sel, activo: false }); setLocales(p => p.map(l => l.id === sel.id ? { ...l, activo: false } : l)); setRejectMode(false); show("Local desactivado"); } }} disabled={loading} style={{ ...btnPrimaryS, background: "#ff6b6b" }}>{loading ? "..." : "Confirmar"}</button>
            <button onClick={() => setRejectMode(false)} style={btnSecS}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ ...cardS, borderColor: "rgba(255,80,80,0.3)", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", color: "#ff6b6b", fontWeight: 700, marginBottom: "6px" }}>¿Eliminar {sel.nombre}?</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "rgba(240,234,214,0.5)", marginBottom: "14px" }}>Se borran todos sus datos. No se puede deshacer.</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={async () => { setLoading(true); try { const r = await adminFetch(`/api/admin/locales/${sel.id}`, { method: "DELETE" }); if (r.ok) { setLocales(p => p.filter(l => l.id !== sel.id)); setSel(null); show("Eliminado"); } } catch {} setLoading(false); }} disabled={loading} style={{ ...btnPrimaryS, background: "#ff6b6b" }}>{loading ? "..." : "Eliminar"}</button>
            <button onClick={() => setDeleteConfirm(false)} style={btnSecS}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!editMode && !passMode && !rejectMode && !deleteConfirm && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
          <a href={`/locales/${sel.slug || sel.id}`} target="_blank" rel="noopener" style={{ ...btnOutlineS, textDecoration: "none", textAlign: "center" }}>👁️ Ver local público</a>
          <a href={`/locales/${sel.slug || sel.id}?tab=Concursos`} target="_blank" rel="noopener" style={{ ...btnOutlineS, textDecoration: "none", textAlign: "center", color: "#FFD600", borderColor: "rgba(232,168,76,0.4)" }}>🏆 Ver concursos del local</a>
          <a href={`/locales/${sel.slug || sel.id}?tab=Promociones`} target="_blank" rel="noopener" style={{ ...btnOutlineS, textDecoration: "none", textAlign: "center", color: "#3db89e", borderColor: "rgba(61,184,158,0.4)" }}>⚡ Ver promociones del local</a>
          {!sel.activo && <button onClick={async () => { if (await action("aprobar")) { setSel({ ...sel, activo: true }); setLocales(p => p.map(l => l.id === sel.id ? { ...l, activo: true } : l)); show("✓ Aprobado y notificado"); } }} disabled={loading} style={{ ...btnOutlineS, color: "#3db89e", borderColor: "rgba(61,184,158,0.4)" }}>✓ Aprobar y notificar</button>}
          {!sel.activo && <button onClick={async () => { if (await action("reenviar-activacion")) show("✓ Email de activación enviado"); }} disabled={loading} style={btnOutlineS}>📧 Reenviar email de activación</button>}
          <button onClick={() => { resetModes(); setEditMode(true); setEditData({ nombre: sel.nombre ?? "", nombreDueno: sel.nombreDueno ?? "", celularDueno: sel.celularDueno ?? "", categorias: sel.categorias ?? [], comuna: sel.comuna ?? "", direccion: sel.direccion ?? "", telefono: sel.telefono ?? "", instagram: sel.instagram ?? "", sitioWeb: sel.sitioWeb ?? "", descripcion: sel.descripcion ?? "", logoUrl: sel.logoUrl ?? "", portadaUrl: sel.portadaUrl ?? "", sirveEnMesa: sel.sirveEnMesa ?? true, tieneDelivery: sel.tieneDelivery ?? false, tieneRetiro: sel.tieneRetiro ?? false, lat: sel.lat ?? 0, lng: sel.lng ?? 0 }); setEditHorarios(Array.isArray(sel.horarios) && sel.horarios.length === 7 ? sel.horarios : DEFAULT_HORARIOS); }} style={btnOutlineS}>✏️ Editar datos</button>
          <button onClick={() => { resetModes(); setPassMode(true); }} style={btnOutlineS}>🔑 Cambiar contraseña</button>
          <button onClick={() => { resetModes(); setRejectMode(true); }} style={{ ...btnOutlineS, color: "#ff8080", borderColor: "rgba(255,80,80,0.3)" }}>✗ {sel.activo ? "Desactivar" : "Rechazar"}</button>
          <button onClick={() => { resetModes(); setDeleteConfirm(true); }} style={{ ...btnOutlineS, color: "#ff8080", borderColor: "rgba(255,80,80,0.3)" }}>🗑️ Eliminar</button>
        </div>
      )}
    </div>
  );

  // ── LIST VIEW ──
  return (
    <div>
      {toast && <div style={toastS}>{toast}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: "#FFD600", margin: 0 }}>Locales ({locales.length})</h1>
        <div style={{ display: "flex", gap: "6px" }}>
          <span style={{ fontSize: "0.8rem", color: "#ff8080", background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.2)", borderRadius: "6px", padding: "4px 10px" }}>{pendientes} pend.</span>
          <span style={{ fontSize: "0.8rem", color: "#3db89e", background: "rgba(61,184,158,0.1)", border: "1px solid rgba(61,184,158,0.2)", borderRadius: "6px", padding: "4px 10px" }}>{activos} act.</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input style={{ ...inputS, flex: 1, minWidth: "150px" }} placeholder="Buscar..." value={busq} onChange={e => setBusq(e.target.value)} />
        {["todos", "pendientes", "reclamados", "activos", "importados"].map(f => (
          <button key={f} onClick={() => { setFiltro(f); if (f === "importados" && localesGoogle.length === 0) { adminFetch("/api/admin/locales?incluir=google").then(r => r.json()).then(d => setLocalesGoogle(Array.isArray(d) ? d : [])).catch(() => {}); } }} style={{ padding: "6px 12px", borderRadius: "6px", fontFamily: "var(--font-display)", fontSize: "0.78rem", textTransform: "uppercase", cursor: "pointer", background: filtro === f ? (f === "importados" ? "#7b9aff" : "#FFD600") : "transparent", color: filtro === f ? "#0D0D0D" : "rgba(240,234,214,0.5)", border: filtro === f ? "none" : "1px solid rgba(255,255,255,0.1)" }}>{f === "importados" ? "Google" : f}</button>
        ))}
      </div>

      {/* Create local */}
      {!crearMode ? (
        <button onClick={() => setCrearMode(true)} style={{ ...btnOutlineS, marginBottom: "16px", textAlign: "center", color: "#3db89e", borderColor: "rgba(61,184,158,0.4)" }}>+ Crear local</button>
      ) : (
        <div style={{ ...cardS, marginBottom: "16px" }}>
          <p style={cardTitleS}>Crear nuevo local</p>
          {[["nombre", "Nombre del local"], ["email", "Email"], ["password", "Contraseña"]].map(([key, label]) => (
            <div key={key} style={{ marginBottom: "10px" }}>
              <label style={labelS}>{label}</label>
              <input style={inputS} type={key === "password" ? "password" : "text"} value={crearData[key] ?? ""} onChange={e => setCrearData(d => ({ ...d, [key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ marginBottom: "10px" }}>
            <label style={labelS}>Dirección</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input style={{ ...inputS, flex: 1 }} value={crearData.direccion ?? ""} onChange={e => setCrearData(d => ({ ...d, direccion: e.target.value }))} placeholder="Ej: Av. Providencia 1234" />
              <button type="button" disabled={crearBuscando || !crearData.direccion?.trim()} onClick={async () => {
                setCrearBuscando(true);
                try {
                  const q = `${crearData.direccion}, ${crearData.comuna || "Santiago"}, Chile`;
                  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`);
                  const data = await res.json();
                  if (data[0]) {
                    setCrearData(d => ({ ...d, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }));
                    show("✓ Ubicación encontrada");
                  } else { show("No se encontró la dirección"); }
                } catch { show("Error buscando dirección"); }
                setCrearBuscando(false);
              }} style={{ ...btnSecS, flex: "none", padding: "8px 14px", fontSize: "0.75rem", whiteSpace: "nowrap" }}>{crearBuscando ? "..." : "📍 Buscar"}</button>
            </div>
          </div>
          {(crearData.lat !== 0 || crearData.lng !== 0) && (
            <div style={{ marginBottom: "10px", padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 12, fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "rgba(240,234,214,0.5)" }}>
              Lat: {crearData.lat}, Lng: {crearData.lng}
            </div>
          )}
          <div style={{ marginBottom: "10px" }}>
            <label style={labelS}>Comuna</label>
            <select style={inputS} value={crearData.comuna ?? ""} onChange={e => setCrearData(d => ({ ...d, comuna: e.target.value }))}>
              <option value="">Seleccionar...</option>
              {COMUNAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={labelS}>Categorías (máx. 3)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {CATEGORIAS.map(cat => {
                const cats: string[] = crearData.categorias ?? [];
                const sel2 = cats.includes(cat);
                const maxed = cats.length >= 3 && !sel2;
                return <button key={cat} type="button" disabled={maxed} onClick={() => {
                  setCrearData(d => ({ ...d, categorias: sel2 ? cats.filter((c: string) => c !== cat) : [...cats, cat] }));
                }} style={{ padding: "5px 12px", borderRadius: "16px", border: sel2 ? "1px solid #FFD600" : "1px solid rgba(232,168,76,0.15)", background: sel2 ? "rgba(232,168,76,0.15)" : "transparent", color: sel2 ? "#FFD600" : maxed ? "rgba(240,234,214,0.2)" : "rgba(240,234,214,0.5)", fontFamily: "var(--font-display)", fontSize: "0.78rem", cursor: maxed ? "default" : "pointer", opacity: maxed ? 0.3 : 1 }}>{CATEGORIA_EMOJI[cat] ?? "🍽️"} {cat}</button>;
              })}
            </div>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={labelS}>Descripción (opcional)</label>
            <textarea style={{ ...inputS, minHeight: "60px", resize: "vertical" }} value={crearData.descripcion ?? ""} onChange={e => setCrearData(d => ({ ...d, descripcion: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={async () => {
              if (!crearData.nombre?.trim() || !crearData.email?.trim() || !crearData.password?.trim()) { show("Nombre, email y contraseña son obligatorios"); return; }
              setLoading(true);
              try {
                const res = await adminFetch("/api/admin/locales", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(crearData),
                });
                const d = await res.json();
                if (d.error) { show("Error: " + d.error); } else { setLocales(p => [d, ...p]); setCrearMode(false); setCrearData({ nombre: "", email: "", password: "", comuna: "", direccion: "", categorias: [], descripcion: "" }); show("✓ Local creado"); }
              } catch { show("Error de conexión"); }
              setLoading(false);
            }} disabled={loading} style={btnPrimaryS}>{loading ? "..." : "Crear"}</button>
            <button onClick={() => setCrearMode(false)} style={btnSecS}>Cancelar</button>
          </div>
        </div>
      )}

      {isGoogleFilter && <p style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "rgba(240,234,214,0.4)", marginBottom: "12px" }}>Locales importados desde Google Places ({filtered.length}). Puedes editarlos o eliminarlos.</p>}

      {/* Card list (mobile-friendly) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map(l => (
          <div key={l.id} onClick={() => { setSel(l); resetModes(); }} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", cursor: "pointer" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: l.logoUrl ? "transparent" : "linear-gradient(135deg, #2a7a6f, #3db89e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, color: "#fff", flexShrink: 0, overflow: "hidden", border: "1px solid rgba(232,168,76,0.2)" }}>{l.logoUrl ? <img src={l.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : l.nombre?.charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: "#FFFFFF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nombre}</p>
                {l._count?.menuItems === 0 ? (
                  <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 99, background: "#FEE2E2", color: "#991B1B", fontSize: 11, flexShrink: 0 }}>Sin carta</span>
                ) : (
                  <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 99, background: "#DCFCE7", color: "#166534", fontSize: 11, flexShrink: 0 }}>{l._count?.menuItems} platos</span>
                )}
                {l.origenImportacion === "GOOGLE_PLACES" && <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: "4px", background: "rgba(123,154,255,0.12)", border: "1px solid rgba(123,154,255,0.3)", color: "#7b9aff", flexShrink: 0 }}>Google</span>}
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "rgba(240,234,214,0.4)", margin: "2px 0 0" }}>{isGoogleFilter ? (l.comuna ?? "Sin comuna") + (l.googleRating ? ` · ⭐ ${l.googleRating}` : "") : l.email}</p>
            </div>
            {l.activo ? (
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#3db89e", flexShrink: 0 }}>✓</span>
            ) : isGoogleFilter ? (
              <button onClick={async (e) => { e.stopPropagation(); setLoading(true); try { const r = await adminFetch(`/api/admin/locales/${l.id}`, { method: "DELETE" }); if (r.ok) { setLocalesGoogle(p => p.filter(x => x.id !== l.id)); show("✓ Eliminado"); } } catch {} setLoading(false); }} style={{ padding: "4px 10px", background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: "6px", color: "#ff6b6b", fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>Eliminar</button>
            ) : (
              <button onClick={async (e) => { e.stopPropagation(); setLoading(true); try { const res = await adminFetch(`/api/admin/locales/${l.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "aprobar" }) }); if (res.ok) { setLocales(p => p.map(x => x.id === l.id ? { ...x, activo: true } : x)); show("✓ " + l.nombre + " activado"); } } catch {} setLoading(false); }} style={{ padding: "4px 10px", background: "rgba(61,184,158,0.15)", border: "1px solid rgba(61,184,158,0.4)", borderRadius: "6px", color: "#3db89e", fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>Activar</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><span style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "rgba(240,234,214,0.5)" }}>{label}</span><span style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "#FFFFFF", textAlign: "right", maxWidth: "60%", wordBreak: "break-word" }}>{value}</span></div>;
}

const toastS: React.CSSProperties = { position: "fixed", top: "16px", right: "16px", background: "rgba(13,7,3,0.97)", border: "1px solid rgba(232,168,76,0.4)", borderRadius: "10px", padding: "10px 18px", fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "#FFD600", zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" };
const backS: React.CSSProperties = { background: "none", border: "none", color: "rgba(240,234,214,0.5)", fontFamily: "var(--font-display)", fontSize: "0.85rem", cursor: "pointer", padding: 0, marginBottom: "16px" };
const cardS: React.CSSProperties = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px", marginBottom: "12px" };
const cardTitleS: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "0.72rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(240,234,214,0.4)", marginBottom: "10px", margin: "0 0 10px" };
const inputS: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#FFFFFF", fontFamily: "var(--font-display)", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" };
const labelS: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "0.75rem", color: "rgba(240,234,214,0.4)", display: "block", marginBottom: "4px" };
const btnPrimaryS: React.CSSProperties = { flex: 1, padding: "10px", background: "#FFD600", border: "none", borderRadius: "8px", color: "#0D0D0D", fontFamily: "var(--font-display)", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" };
const btnSecS: React.CSSProperties = { flex: 1, padding: "10px", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(240,234,214,0.5)", fontFamily: "var(--font-display)", fontSize: "0.8rem", cursor: "pointer" };
const btnOutlineS: React.CSSProperties = { display: "block", width: "100%", padding: "10px", background: "none", border: "1px solid rgba(232,168,76,0.2)", borderRadius: "8px", color: "#FFD600", fontFamily: "var(--font-display)", fontSize: "0.78rem", cursor: "pointer", textAlign: "left" };
