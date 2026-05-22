"use client";

import { useState, useEffect } from "react";

interface Lead {
  id: string;
  localName: string;
  ownerName: string;
  email: string;
  whatsapp: string | null;
  cartaType: "LINK" | "DOCUMENT" | "PHOTO";
  cartaUrl: string | null;
  cartaFileUrl: string | null;
  cartaStatus: string;
  generatedSlug: string | null;
  ip: string | null;
  city: string | null;
  activated: boolean;
  detectedProvider: { name: string } | null;
  createdAt: string;
  step2At: string | null;
  completedAt: string | null;
  previewAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  emailOpenedAt: string | null;
  emailClickedAt: string | null;
  emailBouncedAt: string | null;
  whatsappSentAt: string | null;
  whatsappOpenedAt: string | null;
  whatsappClickedAt: string | null;
  openedVia: string | null;
  onboardingDoneAt: string | null;
  panelVisitedAt: string | null;
  activarVisitedAt: string | null;
  activatedAt: string | null;
  errorLog: string | null;
  events?: any[];
}

interface Stats {
  visitCount: number;
  total: number;
  reachedStep2: number;
  completed: number;
  delivered: number;
  emailOpened: number;
  emailClicked: number;
  onboardingDone: number;
  panelVisited: number;
  activarVisited: number;
  activated: number;
  abandoned: number;
  orphanLeads: number;
  visitToLeadRate: number;
  step2Rate: number;
  conversionRate: number;
  deliveredRate: number;
  openRate: number;
  clickRate: number;
  onboardingRate: number;
  panelRate: number;
  activarVisitedRate: number;
  activatedRate: number;
  byType: { LINK: number; DOCUMENT: number; PHOTO: number };
}

const FUNNEL_STEPS = [
  { key: "visitCount", label: "Visitas /subircarta", color: "#6366f1", rateKey: null },
  { key: "total", label: "Subieron carta", color: "#8b5cf6", rateKey: "visitToLeadRate" },
  { key: "reachedStep2", label: "Paso 2", color: "#a78bfa", rateKey: "step2Rate" },
  { key: "completed", label: "Completaron datos", color: "#3b82f6", rateKey: "conversionRate" },
  { key: "delivered", label: "Email enviado", color: "#06b6d4", rateKey: "deliveredRate" },
  { key: "emailOpened", label: "Abrieron email", color: "#14b8a6", rateKey: "openRate" },
  { key: "emailClicked", label: "Click ver carta", color: "#22c55e", rateKey: "clickRate" },
  { key: "onboardingDone", label: "Onboarding", color: "#84cc16", rateKey: "onboardingRate" },
  { key: "panelVisited", label: "Visitaron panel", color: "#eab308", rateKey: "panelRate" },
  { key: "activarVisited", label: "Vieron /activar", color: "#f59e0b", rateKey: "activarVisitedRate" },
  { key: "activated", label: "Activaron", color: "#F4A623", rateKey: "activatedRate" },
] as const;

interface Visit {
  id: string;
  ip: string | null;
  createdAt: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  userAgent: string | null;
  matchedLeadId: string | null;
}

export default function FunnelPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVisits, setShowVisits] = useState(false);
  const [pushStatus, setPushStatus] = useState<"idle" | "active" | "denied">("idle");

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      navigator.serviceWorker?.getRegistration("/sw-admin.js").then((reg) => {
        reg?.pushManager?.getSubscription().then((sub) => {
          if (sub) setPushStatus("active");
        });
      });
    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setPushStatus("denied");
    }
  }, []);

  const enablePush = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPushStatus("denied"); return; }
      const reg = await navigator.serviceWorker.register("/sw-admin.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      const keys = sub.toJSON().keys!;
      await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
      });
      setPushStatus("active");
    } catch (e) {
      console.error("Push subscription failed:", e);
    }
  };

  const fetchData = () => {
    fetch("/api/admin/funnel")
      .then((r) => r.json())
      .then((data) => {
        setLeads(data.leads || []);
        setVisits(data.visits || []);
        setStats(data.stats || null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const onVisible = () => { if (document.visibilityState === "visible") fetchData(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (loading) {
    return <div style={{ padding: 40, color: "#aaa" }}>Cargando...</div>;
  }

  const maxVal = stats ? Math.max(stats.visitCount, stats.total, 1) : 1;

  return (
    <div style={{ maxWidth: 1100, padding: "0 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: "var(--font-display, Georgia)", fontSize: 22, color: "#F4A623", margin: 0 }}>
          Funnel
        </h1>
        <button
          onClick={pushStatus === "idle" ? enablePush : undefined}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            cursor: pushStatus === "idle" ? "pointer" : "default",
            background: pushStatus === "active" ? "#1a3a1a" : pushStatus === "denied" ? "#3a1a1a" : "#F4A623",
            color: pushStatus === "active" ? "#43d17b" : pushStatus === "denied" ? "#e85d5d" : "#0a0a0a",
            fontSize: 13, fontWeight: 600,
          }}
        >
          {pushStatus === "active" ? "Notificaciones activas" : pushStatus === "denied" ? "Bloqueadas" : "Activar notificaciones"}
        </button>
      </div>

      {/* Stats cards compactas */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 20 }}>
          <StatCard label="Visitas" value={stats.visitCount} color="#6366f1" />
          <StatCard label="Leads" value={stats.total} suffix={`${stats.visitToLeadRate}%`} />
          <StatCard label="Completados" value={stats.completed} color="#3b82f6" suffix={`${stats.conversionRate}%`} />
          <StatCard label="Enviados" value={stats.delivered} color="#06b6d4" />
          <StatCard label="Abiertos" value={stats.emailOpened} color="#14b8a6" suffix={`${stats.openRate}%`} />
          <StatCard label="Click" value={stats.emailClicked} color="#22c55e" suffix={`${stats.clickRate}%`} />
          <StatCard label="Activados" value={stats.activated} color="#F4A623" suffix={`${stats.activatedRate}%`} />
          <StatCard label="Link" value={stats.byType.LINK} />
          <StatCard label="PDF" value={stats.byType.DOCUMENT} />
          <StatCard label="Foto" value={stats.byType.PHOTO} />
        </div>
      )}

      {/* Orphan leads alert */}
      {stats && stats.orphanLeads > 0 && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>
              {stats.orphanLeads} lead{stats.orphanLeads > 1 ? "s" : ""} sin datos de contacto
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>
              Subieron carta pero no completaron sus datos. Revisa las tarjetas marcadas en rojo.
            </div>
          </div>
        </div>
      )}

      {/* Toggle: Leads vs Visitas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => setShowVisits(false)} style={{
          padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
          background: !showVisits ? "#F4A623" : "#222", color: !showVisits ? "#0a0a0a" : "#888",
          fontSize: 13, fontWeight: 600,
        }}>Leads ({leads.length})</button>
        <button onClick={() => setShowVisits(true)} style={{
          padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
          background: showVisits ? "#6366f1" : "#222", color: showVisits ? "#fff" : "#888",
          fontSize: 13, fontWeight: 600,
        }}>Visitas /subircarta ({visits.length})</button>
      </div>

      {/* Visitas */}
      {showVisits && (
        <div className="funnel-cards" style={{ marginBottom: 20 }}>
          {visits.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#666" }}>No hay visitas.</div>
          )}
          {visits.map((v) => {
            const date = new Date(v.createdAt);
            const dateStr = `${date.getDate()}/${date.getMonth() + 1} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
            const converted = !!v.matchedLeadId;
            return (
              <div key={v.id} style={{
                background: converted ? "rgba(34,197,94,0.06)" : "#1a1a1a",
                borderRadius: 12, padding: "12px 16px",
                border: `1px solid ${converted ? "rgba(34,197,94,0.25)" : "#2a2a2a"}`,
                marginBottom: 6,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#aaa" }}>{dateStr}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                    background: converted ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                    color: converted ? "#22c55e" : "#666",
                  }}>{converted ? "Subió carta" : "Solo visitó"}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "#888", marginTop: 6 }}>
                  {v.utmCampaign && <span style={{ color: "#a78bfa" }}>{v.utmCampaign}</span>}
                  {v.utmSource && <span>{v.utmSource}{v.utmMedium ? ` / ${v.utmMedium}` : ""}</span>}
                  {v.referrer && <span style={{ color: "#60a5fa" }}>{(() => { try { return new URL(v.referrer).hostname; } catch { return v.referrer; } })()}</span>}
                  {v.ip && <span style={{ color: "#555" }}>{v.ip}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Leads — mobile cards */}
      <div className="funnel-cards" style={{ display: showVisits ? "none" : undefined }}>
        {leads.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#666" }}>No hay leads todavia.</div>
        )}
        {leads.map((lead) => {
          const isOrphan = !lead.email && (lead.cartaUrl || lead.cartaFileUrl) && new Date(lead.createdAt) < new Date(Date.now() - 10 * 60 * 1000);
          const date = new Date(lead.createdAt);
          const dateStr = `${date.getDate()}/${date.getMonth() + 1} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
          const domain = lead.cartaUrl ? (() => { try { return new URL(lead.cartaUrl).hostname; } catch { return lead.cartaUrl; } })() : null;

          const fmtTime = (iso: string | null) => {
            if (!iso) return null;
            const d = new Date(iso);
            return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
          };
          const fmtDate = (iso: string | null) => {
            if (!iso) return null;
            const d = new Date(iso);
            return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
          };
          const diffStr = (from: string | null, to: string | null) => {
            if (!from || !to) return null;
            const secs = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000);
            if (secs < 60) return `${secs}s`;
            if (secs < 3600) { const m = Math.floor(secs / 60); return `${m}m ${secs % 60}s`; }
            const h = Math.floor(secs / 3600); const m = Math.floor((secs % 3600) / 60);
            return `${h}h ${m}m`;
          };

          // Determine furthest stage for badge
          const stage = lead.activatedAt ? "ACTIVADO" :
            lead.activarVisitedAt ? "EN ACTIVAR" :
            lead.panelVisitedAt ? "EN PANEL" :
            lead.onboardingDoneAt ? "ONBOARDING" :
            lead.emailClickedAt ? "CLICK" :
            lead.emailOpenedAt ? "ABIERTO" :
            lead.cartaStatus;

          return (
            <div key={lead.id} style={{ background: isOrphan ? "rgba(239,68,68,0.06)" : "#1a1a1a", borderRadius: 12, padding: "14px 16px", border: `1px solid ${isOrphan ? "rgba(239,68,68,0.3)" : "#2a2a2a"}`, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                  {isOrphan && <span style={{ color: "#f87171", marginRight: 6 }}>⚠</span>}
                  {lead.localName || "Sin nombre"}
                </span>
                <StatusBadge status={isOrphan ? "HUÉRFANO" : stage} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "#aaa" }}>
                <span>{dateStr}</span>
                {lead.city && <span style={{ color: "#60a5fa" }}>{lead.city}</span>}
                {lead.ownerName && <span>{lead.ownerName}</span>}
                {lead.detectedProvider?.name && <span>{lead.detectedProvider.name}</span>}
                <TypeBadge type={lead.cartaType} />
              </div>
              {lead.email && (
                <div style={{ fontSize: 12, color: "#888", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  {lead.email}
                  {lead.emailBouncedAt && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 700 }}>REBOTÓ</span>}
                  {lead.openedVia && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: lead.openedVia === "whatsapp" ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.15)", color: lead.openedVia === "whatsapp" ? "#22c55e" : "#3b82f6", fontWeight: 600 }}>vía {lead.openedVia}</span>}
                </div>
              )}
              {lead.whatsapp && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 2 }}>+{lead.whatsapp}</div>}

              {/* Error log */}
              {lead.cartaStatus === "FAILED" && lead.errorLog && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#f87171", lineHeight: 1.4 }}>
                  {lead.errorLog}
                </div>
              )}

              {/* Timeline completo */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 11, marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "#111", border: "1px solid #222" }}>
                <TimelineStep label="Inicio" time={fmtTime(lead.createdAt)} />
                <TimelineStep label="Paso 2" time={fmtTime(lead.step2At)} delta={diffStr(lead.createdAt, lead.step2At)} />
                <TimelineStep label="Preview" time={fmtTime(lead.previewAt)} delta={diffStr(lead.step2At || lead.createdAt, lead.previewAt)} />
                <TimelineStep label="Lista" time={fmtTime(lead.readyAt)} delta={diffStr(lead.previewAt || lead.createdAt, lead.readyAt)} />
                <TimelineStep label="Email" time={fmtDate(lead.deliveredAt)} />
                {lead.emailBouncedAt && <TimelineStep label="Rebotó" time={fmtDate(lead.emailBouncedAt)} color="#ef4444" />}
                <TimelineStep label="Abierto" time={fmtDate(lead.emailOpenedAt)} delta={diffStr(lead.deliveredAt, lead.emailOpenedAt)} />
                <TimelineStep label="Click" time={fmtDate(lead.emailClickedAt)} delta={diffStr(lead.deliveredAt, lead.emailClickedAt)} />
                {lead.whatsappSentAt && <TimelineStep label="WA" time={fmtDate(lead.whatsappSentAt)} color="#22c55e" />}
                {lead.whatsappClickedAt && <TimelineStep label="WA Click" time={fmtDate(lead.whatsappClickedAt)} color="#22c55e" />}
                <TimelineStep label="Onboard" time={fmtDate(lead.onboardingDoneAt)} />
                <TimelineStep label="Panel" time={fmtDate(lead.panelVisitedAt)} />
                <TimelineStep label="/activar" time={fmtDate(lead.activarVisitedAt)} />
                <TimelineStep label="Activado" time={fmtDate(lead.activatedAt)} color="#F4A623" />
              </div>

              {/* Lead Doctor activity — collapsible */}
              {lead.events && lead.events.some((e: any) => e.action?.startsWith("doctor_") || e.action?.startsWith("lead_doctor")) && (
                <DoctorBlock events={lead.events.filter((e: any) => e.action?.startsWith("doctor_") || e.action?.startsWith("lead_doctor"))} />
              )}

              {/* Event log */}
              {lead.events && lead.events.some((e: any) => e.action && !e.action.startsWith("lead_doctor")) && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {lead.events.filter((e: any) => !e.action?.startsWith("lead_doctor")).map((e: any, i: number) => {
                    const isError = e.action?.includes("error") || e.action?.includes("timeout");
                    return (
                      <span key={i} style={{
                        fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 500,
                        background: isError ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)",
                        color: isError ? "#f87171" : "#888",
                        border: `1px solid ${isError ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)"}`,
                      }} title={e.error || e.fileName || ""}>
                        {e.action}{e.files ? ` (${e.files} fotos)` : ""}{e.error ? `: ${e.error.slice(0, 30)}` : ""}
                      </span>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                {domain && <a href={lead.cartaUrl!} target="_blank" rel="noopener noreferrer" style={{ color: "#F4A623", fontSize: 12, fontWeight: 600 }}>{domain}</a>}
                {lead.cartaFileUrl && lead.cartaFileUrl.split(",").map((url, i) => (
                  <a key={i} href={url.trim()} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: 12, fontWeight: 600 }}>Foto {lead.cartaFileUrl!.includes(",") ? i + 1 : ""}</a>
                ))}
                {lead.generatedSlug && <a href={`/qr/${lead.generatedSlug}`} target="_blank" rel="noopener noreferrer" style={{ color: "#43d17b", fontSize: 12, fontWeight: 600 }}>Ver carta</a>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, suffix }: { label: string; value: number; color?: string; suffix?: string }) {
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 12, padding: "16px 18px", border: "1px solid #2a2a2a" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: color || "#fff" }}>{value}</span>
        {suffix && <span style={{ fontSize: 13, color: "#888" }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = { LINK: "#3b82f6", DOCUMENT: "#f59e0b", PHOTO: "#8b5cf6" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${colors[type] || "#666"}22`, color: colors[type] || "#666" }}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "#f59e0b", PROCESSING: "#3b82f6", READY: "#06b6d4", DELIVERED: "#14b8a6",
    ABIERTO: "#22c55e", CLICK: "#84cc16", ONBOARDING: "#eab308",
    "EN PANEL": "#F4A623", "EN ACTIVAR": "#f59e0b", ACTIVADO: "#F4A623", FAILED: "#ef4444",
    "HUÉRFANO": "#ef4444",
  };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
      background: `${colors[status] || "#666"}22`, color: colors[status] || "#666",
    }}>
      {status}
    </span>
  );
}

function TimelineStep({ label, time, delta, color }: { label: string; time: string | null; delta?: string | null; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ color: time ? (color || "#F4A623") : "#444", fontWeight: 600 }}>{label}</span>
      {time ? (
        <span style={{ color: "#888" }}>{time}{delta && <span style={{ color: "#666", marginLeft: 3 }}>({delta})</span>}</span>
      ) : (
        <span style={{ color: "#333" }}>—</span>
      )}
    </div>
  );
}

function DoctorBlock({ events }: { events: any[] }) {
  const [open, setOpen] = useState(false);

  // Find the last summary/escalation for the collapsed preview
  const lastConclusion = [...events].reverse().find((e: any) =>
    e.action === "doctor_run_summary" || e.action === "doctor_escalated" || e.action === "doctor_escalate_to_human"
  );
  const isEscalated = events.some((e: any) => e.action === "doctor_escalated" || e.action === "doctor_escalate_to_human");
  const isFixed = events.some((e: any) => e.action === "doctor_retry_lead" && e.detail?.includes("exitoso"));

  return (
    <div style={{ marginTop: 8, borderRadius: 8, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", overflow: "hidden" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "8px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", WebkitTapHighlightColor: "transparent" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#a855f7", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>🩺 Lead Doctor</span>
          <span style={{
            fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 700,
            background: isFixed ? "rgba(34,197,94,0.12)" : isEscalated ? "rgba(239,68,68,0.1)" : "rgba(168,85,247,0.12)",
            color: isFixed ? "#22c55e" : isEscalated ? "#f87171" : "#a855f7",
          }}>
            {isFixed ? "RESUELTO" : isEscalated ? "ESCALADO" : `${events.length} acciones`}
          </span>
        </div>
        <span style={{ color: "#555", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* Collapsed: show last conclusion */}
      {!open && lastConclusion && (
        <div style={{ padding: "0 12px 8px", fontSize: 11, color: "#c4b5fd", lineHeight: 1.4 }}>
          {(lastConclusion.detail || lastConclusion.reason || "").slice(0, 150)}{(lastConclusion.detail || lastConclusion.reason || "").length > 150 ? "..." : ""}
        </div>
      )}

      {/* Expanded: all events */}
      {open && (
        <div style={{ padding: "0 12px 10px" }}>
          {events.map((e: any, i: number) => {
            const isSummary = e.action === "doctor_run_summary" || e.action === "doctor_escalated" || e.action === "doctor_escalate_to_human";
            const isRetry = e.action === "doctor_retry" || e.action === "doctor_retry_lead" || e.action === "lead_doctor_retry";
            const isSuccess = e.action === "doctor_retry_lead" && e.detail?.includes("exitoso");
            const msg = e.detail || e.reason || (e.diagnosis ? `Intento ${e.attempt}: ${e.diagnosis}` : "");
            if (!msg) return null;
            return (
              <div key={i} style={{ fontSize: 11, marginBottom: 6, padding: "4px 0", borderBottom: "1px solid rgba(168,85,247,0.08)" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                  <span style={{ color: "#555", flexShrink: 0, fontSize: 10 }}>
                    {e.ts ? new Date(e.ts).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                  <span style={{
                    fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 700,
                    background: isSuccess ? "rgba(34,197,94,0.12)" : isSummary ? "rgba(168,85,247,0.15)" : isRetry ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
                    color: isSuccess ? "#22c55e" : isSummary ? "#a855f7" : isRetry ? "#60a5fa" : "#888",
                  }}>
                    {isSuccess ? "RESUELTO" : isSummary ? (e.action === "doctor_escalated" || e.action === "doctor_escalate_to_human" ? "ESCALADO" : "CONCLUSION") : isRetry ? "REINTENTO" : e.action?.replace("doctor_", "").replace("lead_doctor_", "")}
                  </span>
                </div>
                <div style={{ color: isSuccess ? "#4ade80" : isSummary ? "#c4b5fd" : "#999", lineHeight: 1.4 }}>{msg}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
