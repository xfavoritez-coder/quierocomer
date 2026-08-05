"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { toast } from "sonner";
import { Bell, Send, MapPin, Users, Cake } from "lucide-react";
import AddressPicker from "@/components/admin/AddressPicker";
import type { MemberFilter } from "@/lib/loyalty/memberFilter";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  boxSizing: "border-box",
  background: "var(--adm-card)",
  border: "1px solid var(--adm-card-border)",
  borderRadius: 8,
  color: "var(--adm-text)",
  fontFamily: FB,
  fontSize: "0.88rem",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: F,
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "var(--adm-text2)",
  marginBottom: 6,
};

const GEO_PRESETS = [
  { label: "150 m", km: 0.15 },
  { label: "500 m", km: 0.5 },
];

type FilterOption = {
  value: MemberFilter;
  label: string;
  description: string;
  emoji: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: "all",            label: "Todos",              description: "Todos los miembros activos",              emoji: "📣" },
  { value: "birthday_today", label: "Cumpleaños hoy",     description: "Miembros que cumplen años hoy",           emoji: "🎂" },
  { value: "birthday_week",  label: "Cumpleaños esta semana", description: "Cumplen años en los próximos 7 días", emoji: "🎁" },
  { value: "loyal",          label: "Frecuentes",         description: "Completaron al menos una tarjeta",        emoji: "⭐" },
  { value: "active",         label: "Activos",            description: "Tuvieron un sello en los últimos 30 días",emoji: "🔥" },
  { value: "inactive",       label: "Inactivos",          description: "Sin actividad por más de 30 días",        emoji: "😴" },
  { value: "no_stamps",      label: "Sin sellos",         description: "Se unieron pero nunca volvieron",         emoji: "👋" },
];

const FILTER_LABEL: Record<MemberFilter, string> = Object.fromEntries(
  FILTER_OPTIONS.map((o) => [o.value, o.label])
) as Record<MemberFilter, string>;

interface Broadcast {
  id: string;
  title: string;
  body: string;
  recipients: number;
  filter: string;
  createdAt: string;
}

export default function LoyaltyNotifyPage() {
  const { selectedRestaurantId, loading } = usePanelSession();
  const [tab, setTab] = useState<"send" | "birthday" | "proximity">("send");

  // ── Enviar notificación ──
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cumpleaños automático ──
  const [birthdayEnabled, setBirthdayEnabled] = useState(false);
  const [birthdayTitle, setBirthdayTitle] = useState("");
  const [birthdayMessage, setBirthdayMessage] = useState("");
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [loadingBirthday, setLoadingBirthday] = useState(true);

  // ── Cercanía ──
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [geoRadiusKm, setGeoRadiusKm] = useState(0.5);
  const [geoMessage, setGeoMessage] = useState("");
  const [loadingGeo, setLoadingGeo] = useState(true);
  const [savingGeo, setSavingGeo] = useState(false);
  const [savedGeo, setSavedGeo] = useState(false);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);

  const loadHistory = useCallback(() => {
    if (!selectedRestaurantId) return;
    fetch(`/api/loyalty/notify?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []))
      .catch(() => {});
  }, [selectedRestaurantId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Cargar preview count cuando cambia restaurante o filtro
  const fetchPreview = useCallback((restaurantId: string, f: MemberFilter) => {
    setLoadingPreview(true);
    setPreviewCount(null);
    fetch(`/api/loyalty/notify/preview?restaurantId=${restaurantId}&filter=${f}`)
      .then((r) => r.json())
      .then((d) => setPreviewCount(typeof d.count === "number" ? d.count : null))
      .catch(() => setPreviewCount(null))
      .finally(() => setLoadingPreview(false));
  }, []);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    previewDebounce.current = setTimeout(() => fetchPreview(selectedRestaurantId, filter), 300);
  }, [selectedRestaurantId, filter, fetchPreview]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoadingGeo(true);
    setLoadingBirthday(true);
    setSavedGeo(false);

    Promise.all([
      fetch(`/api/loyalty/program?restaurantId=${selectedRestaurantId}`).then(r => r.json()),
      fetch(`/api/admin/locales/${selectedRestaurantId}`).then(r => r.json()),
    ]).then(([loyaltyData, localData]) => {
      if (loyaltyData.program) {
        setGeoEnabled(!!loyaltyData.program.geoEnabled);
        const rawKm = loyaltyData.program.geoRadiusKm ?? 0.5;
        setGeoRadiusKm([0.15, 0.5].includes(rawKm) ? rawKm : 0.5);
        setGeoMessage(loyaltyData.program.geoMessage || "");
        setBirthdayEnabled(!!loyaltyData.program.birthdayEnabled);
        setBirthdayTitle(loyaltyData.program.birthdayTitle || "");
        setBirthdayMessage(loyaltyData.program.birthdayMessage || "");
      }
      setAddress(localData.address || "");
      setLat(localData.lat ?? null);
      setLng(localData.lng ?? null);
    }).catch(() => {}).finally(() => { setLoadingGeo(false); setLoadingBirthday(false); });
  }, [selectedRestaurantId]);

  const send = async () => {
    if (!selectedRestaurantId || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/loyalty/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, title, body, filter }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      const total = (d.appleDevices || 0) + (d.googleMembers || 0);
      if (total === 0) {
        toast.info("Sin destinatarios en este segmento");
      } else {
        toast.success(`📣 Enviada · ${d.appleDevices} iPhone${d.googleMembers ? ` + ${d.googleMembers} Android` : ""}`);
      }
      setTitle("");
      setBody("");
      setConfirm(false);
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  const saveBirthday = async () => {
    if (!selectedRestaurantId) return;
    setSavingBirthday(true);
    try {
      const res = await fetch("/api/loyalty/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurantId,
          birthdayEnabled,
          birthdayTitle: birthdayTitle.trim(),
          birthdayMessage: birthdayMessage.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al guardar");
      }
      toast.success("Configuración de cumpleaños guardada");
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSavingBirthday(false);
    }
  };

  const saveAddress = async () => {
    if (!selectedRestaurantId) return;
    setSavingAddress(true);
    try {
      const res = await fetch(`/api/admin/locales/${selectedRestaurantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address || null, lat, lng }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Dirección guardada");
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSavingAddress(false);
    }
  };

  const saveGeo = async () => {
    if (!selectedRestaurantId) return;
    setSavingGeo(true);
    setSavedGeo(false);
    try {
      const res = await fetch("/api/loyalty/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, geoEnabled, geoRadiusKm, geoMessage }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al guardar");
      }
      const refreshRes = await fetch("/api/loyalty/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId }),
      });
      const rd = await refreshRes.json();
      const devCount = (rd.appleDevices || 0) + (rd.google || 0);
      if (devCount > 0) {
        toast.success(`Guardado · aplicado a ${devCount} tarjeta${devCount === 1 ? "" : "s"}`);
      } else {
        setSavedGeo(true);
      }
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSavingGeo(false);
    }
  };

  const selectedFilter = FILTER_OPTIONS.find((o) => o.value === filter)!;

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={20} color="var(--adm-text3)" /> Notificaciones
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Envía mensajes push a tus miembros o activa avisos automáticos por cercanía.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--adm-card-border)", marginBottom: 24 }}>
        {([
          { key: "send", label: "Enviar" },
          { key: "birthday", label: "Cumpleaños" },
          { key: "proximity", label: "Cercanía" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              padding: "8px 16px",
              marginBottom: -1,
              border: "none",
              borderBottom: `2px solid ${tab === key ? GOLD : "transparent"}`,
              background: "transparent",
              fontFamily: F,
              fontSize: "0.85rem",
              fontWeight: 600,
              color: tab === key ? "var(--adm-text)" : "var(--adm-text3)",
              cursor: "pointer",
              transition: "color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando…</p>
      ) : tab === "send" ? (
        <>
          {/* Selector de audiencia */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={13} color="var(--adm-text3)" /> Audiencia
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {FILTER_OPTIONS.map((opt) => {
                const active = filter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setFilter(opt.value); setConfirm(false); }}
                    title={opt.description}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "7px 13px",
                      borderRadius: 20,
                      border: `1.5px solid ${active ? GOLD : "var(--adm-card-border)"}`,
                      background: active ? "rgba(244,166,35,0.12)" : "var(--adm-card)",
                      color: active ? GOLD : "var(--adm-text2)",
                      fontFamily: F,
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <span>{opt.emoji}</span> {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Contador de destinatarios */}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>
                {loadingPreview
                  ? "Contando…"
                  : previewCount === null
                  ? ""
                  : previewCount === 0
                  ? "Sin miembros en este segmento"
                  : `${previewCount} destinatario${previewCount !== 1 ? "s" : ""} · ${selectedFilter.description}`
                }
              </span>
            </div>
          </div>

          {/* Redactar */}
          <div style={{ padding: 16, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Título <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>(opcional)</span></label>
              <input
                type="text"
                value={title}
                maxLength={80}
                onChange={(e) => { setTitle(e.target.value); setConfirm(false); }}
                placeholder="Ej: ¡Novedad esta semana!"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Mensaje</label>
              <textarea
                value={body}
                maxLength={300}
                rows={3}
                onChange={(e) => { setBody(e.target.value); setConfirm(false); }}
                placeholder="Ej: Este fin de semana tenemos una oferta especial para ti. ¡Te esperamos!"
                style={{ ...inputStyle, resize: "none" }}
              />
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0", textAlign: "right" }}>{body.length}/300</p>
            </div>

            {/* Preview de la notificación */}
            {body.trim() && (
              <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Bell size={16} color={GOLD} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  {title.trim() && <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{title}</p>}
                  <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "1px 0 0", lineHeight: 1.4 }}>{body}</p>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 10, alignItems: "center" }}>
              {confirm ? (
                <>
                  <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)" }}>
                    ¿Enviar a {previewCount !== null ? `${previewCount} miembro${previewCount !== 1 ? "s" : ""}` : `los ${FILTER_LABEL[filter].toLowerCase()}`}?
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirm(false)}
                    style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={send}
                    disabled={sending || previewCount === 0}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: "none", background: previewCount === 0 ? "var(--adm-card-border)" : "#16a34a", color: previewCount === 0 ? "var(--adm-text3)" : "#fff", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: sending || previewCount === 0 ? "default" : "pointer", opacity: sending ? 0.6 : 1 }}
                  >
                    {sending ? "Enviando…" : "Sí, enviar"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={!body.trim() || previewCount === 0}
                  onClick={() => setConfirm(true)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: body.trim() && previewCount !== 0 ? "pointer" : "not-allowed", opacity: body.trim() && previewCount !== 0 ? 1 : 0.5 }}
                >
                  <Send size={16} /> Enviar notificación
                </button>
              )}
            </div>
          </div>

          {/* Historial */}
          {history.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <p style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text2)", margin: "0 0 10px" }}>Enviadas</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((b) => {
                  const filterOpt = FILTER_OPTIONS.find((o) => o.value === b.filter);
                  return (
                    <li key={b.id} style={{ padding: 12, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10 }}>
                      {b.title && <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{b.title}</p>}
                      <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "1px 0 0", lineHeight: 1.4 }}>{b.body}</p>
                      <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "6px 0 0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {new Date(b.createdAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {b.recipients} destinatario{b.recipients !== 1 ? "s" : ""}
                        {filterOpt && filterOpt.value !== "all" && (
                          <span style={{ padding: "1px 7px", borderRadius: 10, background: "var(--adm-hover)", color: "var(--adm-text3)" }}>
                            {filterOpt.emoji} {filterOpt.label}
                          </span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      ) : tab === "birthday" ? (
        /* ── Tab Cumpleaños ── */
        loadingBirthday ? (
          <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              El sistema enviará automáticamente un mensaje push a cada miembro el día de su cumpleaños. Solo llega a quienes tienen fecha de nacimiento registrada.
            </p>

            {/* Toggle activar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: 14, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
              <div>
                <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>Activar mensajes de cumpleaños</p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                  Se envían automáticamente cada mañana.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBirthdayEnabled(v => !v)}
                aria-pressed={birthdayEnabled}
                style={{ position: "relative", height: 26, width: 46, flexShrink: 0, borderRadius: 999, border: "none", cursor: "pointer", background: birthdayEnabled ? "#16a34a" : "var(--adm-card-border)", transition: "background 0.15s" }}
              >
                <span style={{ position: "absolute", top: 3, left: birthdayEnabled ? 23 : 3, height: 20, width: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
              </button>
            </div>

            {birthdayEnabled && (
              <div style={{ padding: 16, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Título <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    type="text"
                    value={birthdayTitle}
                    maxLength={80}
                    onChange={e => setBirthdayTitle(e.target.value)}
                    placeholder="Ej: ¡Feliz cumpleaños!"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mensaje</label>
                  <textarea
                    value={birthdayMessage}
                    maxLength={300}
                    rows={3}
                    onChange={e => setBirthdayMessage(e.target.value)}
                    placeholder="Ej: Hoy es tu día 🎂 Ven a celebrarlo con nosotros y te tenemos una sorpresa."
                    style={{ ...inputStyle, resize: "none" }}
                  />
                  <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "4px 0 0", textAlign: "right" }}>{birthdayMessage.length}/300</p>
                </div>

                {/* Preview */}
                {birthdayMessage.trim() && (
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Cake size={16} color={GOLD} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      {birthdayTitle.trim() && <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{birthdayTitle}</p>}
                      <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "1px 0 0", lineHeight: 1.4 }}>{birthdayMessage}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={saveBirthday}
              disabled={savingBirthday || (birthdayEnabled && !birthdayMessage.trim())}
              style={{ alignSelf: "flex-start", padding: "10px 20px", borderRadius: 8, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: savingBirthday ? "default" : "pointer", opacity: savingBirthday || (birthdayEnabled && !birthdayMessage.trim()) ? 0.5 : 1 }}
            >
              {savingBirthday ? "Guardando…" : "Guardar configuración"}
            </button>
          </div>
        )
      ) : (
        /* ── Tab Cercanía ── */
        loadingGeo ? (
          <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              Avisa al cliente en su pantalla cuando pasa cerca de tu local. El teléfono lo detecta usando la ubicación que configures aquí.
            </p>

            <div style={{ padding: 16, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <MapPin size={14} color={GOLD} /> Dirección del local
              </label>
              <AddressPicker
                address={address}
                lat={lat}
                lng={lng}
                onChange={(a, la, ln) => { setAddress(a); setLat(la); setLng(ln); setSavedGeo(false); }}
              />
              <button
                type="button"
                onClick={saveAddress}
                disabled={savingAddress}
                style={{ marginTop: 12, padding: "9px 18px", borderRadius: 8, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: savingAddress ? "default" : "pointer", opacity: savingAddress ? 0.6 : 1 }}
              >
                {savingAddress ? "Guardando…" : "Guardar dirección"}
              </button>
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0", lineHeight: 1.5 }}>
                Esta es la misma dirección que aparece en los Ajustes del local. Cambiarla aquí la actualiza en ambos lados.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: 14, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
              <div>
                <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>Activar avisos por cercanía</p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                  Requiere que el local tenga coordenadas configuradas arriba.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setGeoEnabled((v) => !v); setSavedGeo(false); }}
                aria-pressed={geoEnabled}
                style={{ position: "relative", height: 26, width: 46, flexShrink: 0, borderRadius: 999, border: "none", cursor: "pointer", background: geoEnabled ? "#16a34a" : "var(--adm-card-border)", transition: "background 0.15s" }}
              >
                <span style={{ position: "absolute", top: 3, left: geoEnabled ? 23 : 3, height: 20, width: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
              </button>
            </div>

            {geoEnabled && (
              <>
                <div>
                  <label style={labelStyle}>Distancia del aviso</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {GEO_PRESETS.map((opt) => {
                      const active = Math.abs(geoRadiusKm - opt.km) < 0.001;
                      return (
                        <button key={opt.km} type="button" onClick={() => { setGeoRadiusKm(opt.km); setSavedGeo(false); }} style={{ padding: "9px 16px", borderRadius: 8, cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, background: active ? "rgba(244,166,35,0.14)" : "var(--adm-card)", border: `1.5px solid ${active ? GOLD : "var(--adm-card-border)"}`, color: active ? GOLD : "var(--adm-text2)" }}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>
                    A qué distancia del local se activa (iPhone). En Android el radio es fijo (~150 m).
                  </p>
                </div>

                <div>
                  <label style={labelStyle}>Mensaje del aviso</label>
                  <input type="text" value={geoMessage} maxLength={120} placeholder="Ej: ¡Estás cerca! Pásate por tus sellos 🍣" onChange={(e) => { setGeoMessage(e.target.value); setSavedGeo(false); }} style={inputStyle} />
                </div>
              </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button type="button" onClick={saveGeo} disabled={savingGeo} style={{ padding: "10px 20px", borderRadius: 8, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: savingGeo ? "default" : "pointer", opacity: savingGeo ? 0.6 : 1 }}>
                {savingGeo ? "Guardando…" : "Guardar configuración"}
              </button>
              {savedGeo && <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#16a34a" }}>✓ Guardado</span>}
            </div>
          </div>
        )
      )}
    </div>
  );
}
