"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

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
  device: string | null;
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
  ownerLastLoginAt: string | null;
  emailVerificado: boolean | null;
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

type FilterKey = "todos" | "landing" | "subircarta" | "sin_activar" | "activados";

function isLandingLead(lead: Lead) {
  return !lead.step2At && !lead.previewAt && lead.activated;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function fmtTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function diffStr(from: string | null, to: string | null) {
  if (!from || !to) return null;
  const secs = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000);
  if (secs < 0) return null;
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) { const m = Math.floor(secs / 60); return `${m}m`; }
  const h = Math.floor(secs / 3600); const m = Math.floor((secs % 3600) / 60);
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

export default function FunnelPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("todos");
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

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filter === "landing") return isLandingLead(l);
      if (filter === "subircarta") return !isLandingLead(l);
      if (filter === "sin_activar") return !l.activated;
      if (filter === "activados") return l.activated;
      return true;
    });
  }, [leads, filter]);

  const landingCount = leads.filter(isLandingLead).length;
  const subircartaCount = leads.filter((l) => !isLandingLead(l)).length;
  const activadosCount = leads.filter((l) => l.activated).length;
  const sinActivarCount = leads.filter((l) => !l.activated).length;

  if (loading) {
    return <div style={{ padding: 40, color: "#aaa" }}>Cargando...</div>;
  }

  return (
    <div style={{ maxWidth: 1000, padding: "0 12px 40px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: "var(--font-display, Georgia)", fontSize: 22, color: "#F4A623", margin: 0 }}>Funnel</h1>
        <button
          onClick={pushStatus === "idle" ? enablePush : undefined}
          style={{
            padding: "7px 14px", borderRadius: 8, border: "none",
            cursor: pushStatus === "idle" ? "pointer" : "default",
            background: pushStatus === "active" ? "#1a3a1a" : pushStatus === "denied" ? "#3a1a1a" : "#F4A623",
            color: pushStatus === "active" ? "#43d17b" : pushStatus === "denied" ? "#e85d5d" : "#0a0a0a",
            fontSize: 12, fontWeight: 600,
          }}
        >
          {pushStatus === "active" ? "🔔 Notificaciones activas" : pushStatus === "denied" ? "🔕 Bloqueadas" : "Activar notificaciones"}
        </button>
      </div>

      {/* Métricas top */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginBottom: 20 }}>
          <MetricCard label="Visitas" value={stats.visitCount} color="#6366f1" />
          <MetricCard label="Leads" value={stats.total} rate={`${stats.visitToLeadRate}%`} color="#8b5cf6" />
          <MetricCard label="Landing" value={landingCount} color="#F4A623" />
          <MetricCard label="Email abierto" value={stats.emailOpened} rate={`${stats.openRate}%`} color="#14b8a6" />
          <MetricCard label="Email click" value={stats.emailClicked} rate={`${stats.clickRate}%`} color="#22c55e" />
          <MetricCard label="Activados" value={activadosCount} rate={stats.total > 0 ? `${Math.round(activadosCount / stats.total * 100)}%` : "0%"} color="#F4A623" />
          <MetricCard label="Ingresaron" value={leads.filter((l) => l.ownerLastLoginAt).length} color="#43d17b" />
        </div>
      )}

      {/* Tabs filtro */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "todos" as FilterKey, label: `Todos (${leads.length})` },
          { key: "landing" as FilterKey, label: `🚀 Landing (${landingCount})`, active_color: "#F4A623" },
          { key: "subircarta" as FilterKey, label: `📋 Subircarta (${subircartaCount})`, active_color: "#8b5cf6" },
          { key: "activados" as FilterKey, label: `⚡ Activados (${activadosCount})`, active_color: "#22c55e" },
          { key: "sin_activar" as FilterKey, label: `⏳ Sin activar (${sinActivarCount})`, active_color: "#f59e0b" },
        ].map(({ key, label, active_color }) => (
          <button key={key} onClick={() => { setFilter(key); setShowVisits(false); }} style={{
            padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: filter === key ? (active_color || "#fff") : "#1e1e1e",
            color: filter === key ? (active_color ? "#0a0a0a" : "#0a0a0a") : "#666",
            transition: "all .15s",
          }}>{label}</button>
        ))}
        <button onClick={() => setShowVisits(!showVisits)} style={{
          padding: "7px 14px", borderRadius: 20, border: "1px solid #2a2a2a", cursor: "pointer", fontSize: 12, fontWeight: 600,
          background: showVisits ? "#1e2a3a" : "transparent", color: showVisits ? "#60a5fa" : "#555",
        }}>Visitas /subircarta ({visits.length})</button>
      </div>

      {/* Panel visitas */}
      {showVisits && (
        <div style={{ marginBottom: 20 }}>
          {visits.map((v) => {
            const d = new Date(v.createdAt);
            const ds = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
            const converted = !!v.matchedLeadId;
            return (
              <div key={v.id} style={{
                background: converted ? "rgba(34,197,94,0.06)" : "#141414",
                borderRadius: 10, padding: "10px 14px",
                border: `1px solid ${converted ? "rgba(34,197,94,0.2)" : "#202020"}`, marginBottom: 5,
                display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 12, color: "#555" }}>{ds}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: converted ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)", color: converted ? "#22c55e" : "#444" }}>
                  {converted ? "Subió carta" : "Solo visitó"}
                </span>
                {v.utmCampaign && <span style={{ fontSize: 11, color: "#a78bfa" }}>{v.utmCampaign}</span>}
                {v.utmSource && <span style={{ fontSize: 11, color: "#666" }}>{v.utmSource}{v.utmMedium ? `/${v.utmMedium}` : ""}</span>}
                {v.referrer && <span style={{ fontSize: 11, color: "#60a5fa" }}>{(() => { try { return new URL(v.referrer).hostname; } catch { return v.referrer; } })()}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Leads */}
      {!showVisits && (
        <div>
          {filteredLeads.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#444" }}>Sin leads en este filtro.</div>
          )}
          {filteredLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onDelete={fetchData} onReprocess={fetchData} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Lead Card ─── */
function LeadCard({ lead, onDelete, onReprocess }: { lead: Lead; onDelete: () => void; onReprocess: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLanding = isLandingLead(lead);
  const isOrphan = !lead.email && (lead.cartaUrl || lead.cartaFileUrl) && new Date(lead.createdAt) < new Date(Date.now() - 10 * 60 * 1000);

  const d = new Date(lead.createdAt);
  const dateStr = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

  const domain = lead.cartaUrl ? (() => { try { return new URL(lead.cartaUrl).hostname; } catch { return lead.cartaUrl; } })() : null;

  // Journey steps
  const steps = isLanding
    ? [
        { label: "Registro", done: true, ts: lead.createdAt },
        { label: "Email", done: !!lead.deliveredAt, ts: lead.deliveredAt },
        { label: "Abierto", done: !!lead.emailOpenedAt, ts: lead.emailOpenedAt },
        { label: "Click", done: !!lead.emailClickedAt, ts: lead.emailClickedAt },
        { label: "Activado", done: !!lead.activatedAt, ts: lead.activatedAt, highlight: true },
        { label: "Ingresó", done: !!lead.ownerLastLoginAt, ts: lead.ownerLastLoginAt, green: true },
      ]
    : [
        { label: "Carta", done: true, ts: lead.createdAt },
        { label: "Paso 2", done: !!lead.step2At, ts: lead.step2At },
        { label: "Email", done: !!lead.deliveredAt, ts: lead.deliveredAt },
        { label: "Abierto", done: !!lead.emailOpenedAt, ts: lead.emailOpenedAt },
        { label: "Click", done: !!lead.emailClickedAt, ts: lead.emailClickedAt },
        { label: "Onboard", done: !!lead.onboardingDoneAt, ts: lead.onboardingDoneAt },
        { label: "Panel", done: !!lead.panelVisitedAt, ts: lead.panelVisitedAt },
        { label: "Activado", done: !!lead.activatedAt, ts: lead.activatedAt, highlight: true },
        { label: "Ingresó", done: !!lead.ownerLastLoginAt, ts: lead.ownerLastLoginAt, green: true },
      ];

  const doneCount = steps.filter((s) => s.done).length;
  const score = Math.round((doneCount / steps.length) * 100);

  // Attention: activated but never logged in
  const needsAttention = lead.activatedAt && !lead.ownerLastLoginAt;
  // Stuck: has email but never opened after 48h
  const emailSentLong = lead.deliveredAt && !lead.emailOpenedAt &&
    new Date(lead.deliveredAt) < new Date(Date.now() - 48 * 60 * 60 * 1000);

  const borderColor = isOrphan ? "rgba(239,68,68,0.3)" :
    lead.activatedAt && lead.ownerLastLoginAt ? "rgba(67,209,123,0.2)" :
    lead.activatedAt ? "rgba(244,166,35,0.25)" :
    "#202020";

  const bgColor = isOrphan ? "rgba(239,68,68,0.04)" :
    lead.activatedAt && lead.ownerLastLoginAt ? "rgba(67,209,123,0.04)" :
    lead.activatedAt ? "rgba(244,166,35,0.04)" :
    "#141414";

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${borderColor}`, background: bgColor, marginBottom: 8, overflow: "hidden" }}>

      {/* Main row */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {isOrphan && <span style={{ color: "#f87171" }}>⚠</span>}
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{lead.localName || "Sin nombre"}</span>
              {isLanding && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(244,166,35,0.15)", color: "#F4A623" }}>LANDING</span>
              )}
              {lead.activatedAt && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(67,209,123,0.12)", color: "#43d17b" }}>ACTIVADO</span>
              )}
              {lead.activatedAt && lead.emailVerificado === false && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(239,68,68,0.12)", color: "#f87171" }}>EMAIL NO VERIFICADO</span>
              )}
              {lead.activatedAt && lead.emailVerificado === true && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>✓ VERIFICADO</span>
              )}
              {lead.emailBouncedAt && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(239,68,68,0.12)", color: "#f87171" }}>REBOTÓ</span>
              )}
              {needsAttention && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>NO INGRESÓ</span>
              )}
              {emailSentLong && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(239,68,68,0.08)", color: "#f87171" }}>EMAIL NO ABIERTO</span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", marginTop: 5, fontSize: 12, color: "#666" }}>
              <span style={{ color: "#555" }}>{dateStr}</span>
              {lead.city && <span style={{ color: "#60a5fa" }}>{lead.city}</span>}
              {lead.device && <span>{lead.device === "mobile" ? "📱" : lead.device === "tablet" ? "📟" : "💻"}</span>}
              {lead.ownerName && lead.ownerName !== lead.localName && <span style={{ color: "#888" }}>{lead.ownerName}</span>}
              {lead.detectedProvider?.name && <span style={{ color: "#a78bfa" }}>{lead.detectedProvider.name}</span>}
              {!isLanding && (
                <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 5, background: "rgba(255,255,255,0.05)", color: "#555" }}>{lead.cartaType}</span>
              )}
            </div>
            {lead.email && (
              <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                {lead.email}
                {lead.openedVia && <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 5px", borderRadius: 4, background: lead.openedVia === "whatsapp" ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)", color: lead.openedVia === "whatsapp" ? "#22c55e" : "#60a5fa", fontWeight: 600 }}>vía {lead.openedVia}</span>}
              </div>
            )}
            {lead.whatsapp && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 2 }}>+{lead.whatsapp}</div>}
          </div>

          {/* Score ring */}
          <ScoreRing score={score} activated={!!lead.activatedAt} loggedIn={!!lead.ownerLastLoginAt} />
        </div>

        {/* Journey steps */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 12 }}>
          {steps.map((step, i) => {
            const color = step.done
              ? step.green ? "#43d17b"
              : step.highlight ? "#F4A623"
              : "#60a5fa"
              : "#2a2a2a";
            const textColor = step.done ? (step.green ? "#43d17b" : step.highlight ? "#F4A623" : "#aaa") : "#444";
            return (
              <div key={step.label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: color,
                    boxShadow: step.done ? `0 0 6px ${color}66` : "none",
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 9, color: textColor, marginTop: 3, textAlign: "center", lineHeight: 1.2 }}>{step.label}</span>
                  {step.done && step.ts && (
                    <span style={{ fontSize: 8, color: "#333", marginTop: 1 }}>{fmtDate(step.ts)}</span>
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div style={{ height: 1, flex: 1, background: steps[i + 1].done ? "#2a4a7a" : "#1e1e1e", marginBottom: 16, flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Actions row */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {domain && <a href={lead.cartaUrl!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#F4A623", fontWeight: 600 }}>{domain} ↗</a>}
          {lead.cartaFileUrl && lead.cartaFileUrl.split(",").map((url, i) => (
            <a key={i} href={url.trim()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600 }}>Foto {lead.cartaFileUrl!.includes(",") ? i + 1 : ""} ↗</a>
          ))}
          {lead.generatedSlug && <a href={`/qr/${lead.generatedSlug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#43d17b", fontWeight: 600 }}>Ver carta ↗</a>}
          {lead.generatedSlug && lead.activatedAt && <a href={`/panel`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>Panel ↗</a>}
          {(lead.cartaStatus === "FAILED" || lead.cartaStatus === "PENDING") && lead.email && (
            <ReprocessButton leadId={lead.id} onDone={onReprocess} />
          )}
          <button onClick={() => setExpanded(!expanded)} style={{
            marginLeft: "auto", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
            background: expanded ? "rgba(255,255,255,0.08)" : "transparent", color: expanded ? "#aaa" : "#444",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            {expanded ? "Ocultar ▲" : "Detalle ▼"}
          </button>
          {lead.activated
            ? <NukeButton leadId={lead.id} onDone={onDelete} />
            : <DeleteButton leadId={lead.id} onDone={onDelete} />
          }
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid #1e1e1e", padding: "12px 16px", background: "rgba(0,0,0,0.2)" }}>

          {/* Error log */}
          {lead.cartaStatus === "FAILED" && lead.errorLog && (
            <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", fontSize: 12, color: "#f87171", lineHeight: 1.4 }}>
              {lead.errorLog}
            </div>
          )}

          {/* Full timeline */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 6 }}>Timeline completo</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", fontSize: 11 }}>
              <TL label="Inicio" time={fmtTime(lead.createdAt)} />
              {!isLanding && <>
                <TL label="Paso 2" time={fmtTime(lead.step2At)} delta={diffStr(lead.createdAt, lead.step2At)} />
                <TL label="Preview" time={fmtTime(lead.previewAt)} delta={diffStr(lead.step2At || lead.createdAt, lead.previewAt)} />
                <TL label="Lista" time={fmtTime(lead.readyAt)} />
              </>}
              <TL label="Email" time={fmtDate(lead.deliveredAt)} />
              {lead.emailBouncedAt && <TL label="Rebotó" time={fmtDate(lead.emailBouncedAt)} color="#ef4444" />}
              <TL label="Abierto" time={fmtDate(lead.emailOpenedAt)} delta={diffStr(lead.deliveredAt, lead.emailOpenedAt)} />
              <TL label="Click" time={fmtDate(lead.emailClickedAt)} delta={diffStr(lead.deliveredAt, lead.emailClickedAt)} />
              {lead.whatsappSentAt && <TL label="WA" time={fmtDate(lead.whatsappSentAt)} color="#22c55e" />}
              {lead.whatsappClickedAt && <TL label="WA Click" time={fmtDate(lead.whatsappClickedAt)} color="#22c55e" />}
              {!isLanding && <>
                <TL label="Onboard" time={fmtDate(lead.onboardingDoneAt)} />
                <TL label="Panel" time={fmtDate(lead.panelVisitedAt)} />
                <TL label="/activar" time={fmtDate(lead.activarVisitedAt)} />
              </>}
              <TL label="Activado" time={fmtDate(lead.activatedAt)} color="#F4A623" />
              {lead.activatedAt && <TL label="Ingresó panel" time={fmtDate(lead.ownerLastLoginAt)} color="#43d17b" />}
            </div>
          </div>

          {/* Onboard journey */}
          {lead.events && lead.events.some((e: any) => e.action?.startsWith("onboard_")) && (
            <OnboardBlock events={lead.events.filter((e: any) => e.action?.startsWith("onboard_") || e.action === "abandoned_onboarding")} />
          )}

          {/* Panel journey */}
          {lead.events && lead.events.some((e: any) => e.action?.startsWith("panel_")) && (
            <PanelJourneyBlock events={lead.events.filter((e: any) => e.action?.startsWith("panel_"))} />
          )}

          {/* Abandonment badges */}
          {lead.events && lead.events.filter((e: any) => e.action === "abandoned_panel" || e.action === "abandoned_carta").length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {lead.events.filter((e: any) => e.action === "abandoned_panel" || e.action === "abandoned_carta").map((e: any, i: number) => (
                <AbandonmentBadge key={i} event={e} />
              ))}
            </div>
          )}

          {/* Event log */}
          {lead.events && lead.events.some((e: any) => e.action && !e.action.startsWith("lead_doctor")) && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {lead.events.filter((e: any) => !e.action?.startsWith("lead_doctor")).map((e: any, i: number) => {
                const isError = e.action?.includes("error") || (e.action?.includes("timeout") && !e.action?.includes("confirmacion"));
                return (
                  <span key={i} style={{
                    fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 500,
                    background: isError ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                    color: isError ? "#f87171" : "#555",
                    border: `1px solid ${isError ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)"}`,
                  }} title={e.error || e.fileName || ""}>
                    {e.action}{e.files ? ` (${e.files} fotos)` : ""}{e.error ? `: ${e.error.slice(0, 30)}` : ""}
                  </span>
                );
              })}
            </div>
          )}

          {/* Doctor */}
          {lead.events && lead.events.some((e: any) => e.action?.startsWith("doctor_") || e.action?.startsWith("lead_doctor")) && (
            <DoctorInline events={lead.events.filter((e: any) => e.action?.startsWith("doctor_") || e.action?.startsWith("lead_doctor"))} />
          )}

          {/* Panel activity (lazy loaded) */}
          {lead.activated && <PanelActivitiesBlock leadId={lead.id} />}
        </div>
      )}
    </div>
  );
}

/* ─── Score Ring ─── */
function ScoreRing({ score, activated, loggedIn }: { score: number; activated: boolean; loggedIn: boolean }) {
  const color = loggedIn ? "#43d17b" : activated ? "#F4A623" : score > 60 ? "#60a5fa" : "#333";
  const r = 16, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
      <svg width={44} height={44} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={22} cy={22} r={r} fill="none" stroke="#222" strokeWidth={4} />
        <circle cx={22} cy={22} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${(score / 100) * c} ${c}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray .4s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>{score}%</span>
      </div>
    </div>
  );
}

/* ─── Timeline step ─── */
function TL({ label, time, delta, color }: { label: string; time: string | null; delta?: string | null; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <span style={{ color: time ? (color || "#60a5fa") : "#2a2a2a", fontWeight: 600 }}>{label}</span>
      {time
        ? <span style={{ color: "#666" }}>{time}{delta && <span style={{ color: "#444", marginLeft: 2 }}>({delta})</span>}</span>
        : <span style={{ color: "#2a2a2a" }}>—</span>}
    </div>
  );
}

/* ─── Metric card ─── */
function MetricCard({ label, value, color, rate }: { label: string; value: number; color?: string; rate?: string }) {
  return (
    <div style={{ background: "#141414", borderRadius: 10, padding: "12px 14px", border: "1px solid #1e1e1e" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: color || "#fff" }}>{value}</span>
        {rate && <span style={{ fontSize: 11, color: "#555" }}>{rate}</span>}
      </div>
      <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>{label}</div>
    </div>
  );
}

/* ─── Onboard Block ─── */
function OnboardBlock({ events }: { events: any[] }) {
  const [open, setOpen] = useState(false);
  const start = events.find((e: any) => e.action === "onboard_start");
  const steps = events.filter((e: any) => e.action?.startsWith("onboard_step_"));
  const done = events.find((e: any) => e.action === "onboard_done");
  const abandoned = events.find((e: any) => e.action === "abandoned_onboarding");
  const totalSteps = 6;
  const completedSteps = done ? totalSteps : steps.length;
  const isComplete = !!done;

  const allSteps = [
    { label: "Inicio", event: start },
    { label: "Fotos", event: steps.find((e: any) => e.stepName === "fotos") },
    { label: "Galería", event: steps.find((e: any) => e.stepName === "esencial") },
    { label: "Impact", event: steps.find((e: any) => e.stepName === "impact") },
    { label: "Idioma", event: steps.find((e: any) => e.stepName === "idioma") },
    { label: "Listo", event: done },
  ];

  const fmt = (ts: string) => { const d = new Date(ts); return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`; };
  const diff = (from: string, to: string) => { const s = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`; };

  return (
    <div style={{ marginTop: 8, borderRadius: 8, background: "rgba(132,204,22,0.04)", border: "1px solid rgba(132,204,22,0.12)", overflow: "hidden" }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "7px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#84cc16", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>🧞 Onboarding</span>
          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 700, background: isComplete ? "rgba(34,197,94,0.1)" : abandoned ? "rgba(239,68,68,0.08)" : "rgba(132,204,22,0.1)", color: isComplete ? "#22c55e" : abandoned ? "#f87171" : "#84cc16" }}>
            {isComplete ? `${totalSteps}/${totalSteps} COMPLETO` : abandoned ? `Abandonó paso ${(abandoned.atStep ?? 0) + 1}` : `${completedSteps}/${totalSteps}`}
          </span>
        </div>
        <span style={{ color: "#444", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "0 12px 10px", display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 11 }}>
          {allSteps.map((s, i) => {
            const prev = i > 0 ? allSteps[i - 1].event : null;
            const delta = s.event && prev ? diff(prev.ts, s.event.ts) : null;
            return (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: s.event ? "#84cc16" : "#333", fontWeight: 600 }}>{s.label}</span>
                {s.event ? <span style={{ color: "#666" }}>{fmt(s.event.ts)}{delta && <span style={{ color: "#444", marginLeft: 2 }}>({delta})</span>}</span> : <span style={{ color: "#2a2a2a" }}>—</span>}
              </div>
            );
          })}
          {abandoned && !done && (
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 700, background: "rgba(239,68,68,0.08)", color: "#f87171" }}>
              Cerró en {abandoned.stepName || `paso ${(abandoned.atStep ?? 0) + 1}`} · {fmt(abandoned.ts)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Panel Journey Block ─── */
function PanelJourneyBlock({ events }: { events: any[] }) {
  const [open, setOpen] = useState(false);
  const panelVisits = events.filter((e: any) => e.action === "panel_visit");
  const leave = events.filter((e: any) => e.action === "panel_leave").pop();
  const uniqueSections = [...new Set(panelVisits.map((v: any) => v.section || "inicio"))];

  const fmt = (ts: string) => { const d = new Date(ts); return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`; };
  const diff = (from: string, to: string) => { const s = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000); if (s < 60) return `${s}s`; if (s < 3600) { const m = Math.floor(s / 60); return `${m}m`; } return `${Math.floor(s / 3600)}h`; };

  const firstVisit = panelVisits[0];
  const lastEvent = leave || panelVisits[panelVisits.length - 1];
  const totalTime = firstVisit && lastEvent ? diff(firstVisit.ts, lastEvent.ts) : null;

  const LABELS: Record<string, string> = { inicio: "Inicio", menus: "Mi Carta", analytics: "Analytics", clientes: "Clientes", promociones: "Ofertas", anuncios: "Anuncios", garzon: "Garzón", campanias: "Email Mkt", usuarios: "Usuarios", ajustes: "Ajustes", live: "Venta en vivo" };

  return (
    <div style={{ marginTop: 8, borderRadius: 8, background: "rgba(234,179,8,0.04)", border: "1px solid rgba(234,179,8,0.12)", overflow: "hidden" }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "7px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#eab308", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>📊 Panel</span>
          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 700, background: "rgba(234,179,8,0.1)", color: "#eab308" }}>
            {uniqueSections.length} sección{uniqueSections.length !== 1 ? "es" : ""}{totalTime ? ` · ${totalTime}` : ""}
          </span>
        </div>
        <span style={{ color: "#444", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "0 12px 10px", display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 11 }}>
          {panelVisits.map((v: any, i: number) => {
            const prev = i > 0 ? panelVisits[i - 1] : null;
            const delta = prev ? diff(prev.ts, v.ts) : null;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "#eab308", fontWeight: 600 }}>{LABELS[v.section] || v.section}</span>
                <span style={{ color: "#666" }}>{fmt(v.ts)}{delta && <span style={{ color: "#444", marginLeft: 2 }}>({delta})</span>}</span>
              </div>
            );
          })}
          {leave && (
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 700, background: "rgba(239,68,68,0.08)", color: "#f87171" }}>
              Salió de {LABELS[leave.section] || leave.section} · {fmt(leave.ts)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Abandonment Badge ─── */
function AbandonmentBadge({ event }: { event: any }) {
  const fmt = (ts: string) => { const d = new Date(ts); return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`; };
  const LABELS: Record<string, string> = { abandoned_onboarding: "Abandonó onboarding", abandoned_panel: "Abandonó panel", abandoned_carta: "Abandonó carta" };
  const label = LABELS[event.action] || event.action.replace("abandoned_", "Abandonó ");
  const detail = event.stepName ? ` (${event.stepName})` : event.section ? ` (${event.section})` : "";
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700, background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}>
      🔴 {label}{detail} · {fmt(event.ts)}
    </span>
  );
}

/* ─── Doctor Inline ─── */
function DoctorInline({ events }: { events: any[] }) {
  const [open, setOpen] = useState(false);
  const isEscalated = events.some((e: any) => e.action === "doctor_escalated" || e.action === "doctor_escalate_to_human");
  const isFixed = events.some((e: any) => e.action === "doctor_retry_lead" && e.detail?.includes("exitoso"));
  return (
    <>
      <span onClick={() => setOpen(!open)} style={{
        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, cursor: "pointer",
        background: isFixed ? "rgba(34,197,94,0.1)" : isEscalated ? "rgba(239,68,68,0.08)" : "rgba(168,85,247,0.08)",
        color: isFixed ? "#22c55e" : isEscalated ? "#f87171" : "#a855f7",
        border: `1px solid ${isFixed ? "rgba(34,197,94,0.15)" : isEscalated ? "rgba(239,68,68,0.15)" : "rgba(168,85,247,0.15)"}`,
      }}>
        🩺 {isFixed ? "Resuelto" : isEscalated ? "Escalado" : `${events.length}`}
      </span>
      {open && (
        <div style={{ width: "100%", flexBasis: "100%", marginTop: 6 }}>
          {events.map((e: any, i: number) => {
            const isSummary = e.action === "doctor_run_summary" || e.action === "doctor_escalated" || e.action === "doctor_escalate_to_human";
            const isRetry = e.action === "doctor_retry" || e.action === "doctor_retry_lead" || e.action === "lead_doctor_retry";
            const isSuccess = e.action === "doctor_retry_lead" && e.detail?.includes("exitoso");
            const msg = e.detail || e.reason || (e.diagnosis ? `Intento ${e.attempt}: ${e.diagnosis}` : "");
            if (!msg) return null;
            return (
              <div key={i} style={{ fontSize: 11, marginBottom: 4, padding: "4px 0", borderBottom: "1px solid rgba(168,85,247,0.06)" }}>
                <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 700, marginRight: 6, background: isSuccess ? "rgba(34,197,94,0.1)" : isSummary ? "rgba(168,85,247,0.12)" : isRetry ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)", color: isSuccess ? "#22c55e" : isSummary ? "#a855f7" : isRetry ? "#60a5fa" : "#666" }}>
                  {isSuccess ? "OK" : isSummary ? (e.action?.includes("escalat") ? "ESC" : "FIN") : isRetry ? "RETRY" : e.action?.replace("doctor_", "")}
                </span>
                <span style={{ color: "#777" }}>{msg.slice(0, 120)}{msg.length > 120 ? "..." : ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ─── Delete Button (solo lead) ─── */
function DeleteButton({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "confirm" | "loading" | "error">("idle");
  const del = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/subircarta/${leadId}`, { method: "DELETE" });
      if (res.ok) onDone();
      else { setState("error"); setTimeout(() => setState("idle"), 3000); }
    } catch { setState("error"); setTimeout(() => setState("idle"), 3000); }
  };
  if (state === "error") return <span style={{ fontSize: 10, color: "#f87171" }}>Error ✕</span>;
  if (state === "confirm") return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <button onClick={del} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, cursor: "pointer", background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>Confirmar</button>
      <button onClick={() => setState("idle")} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, cursor: "pointer", background: "transparent", color: "#555", border: "1px solid rgba(255,255,255,0.06)" }}>No</button>
    </span>
  );
  return (
    <button onClick={() => setState("confirm")} disabled={state === "loading"} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, cursor: "pointer", background: "transparent", color: "#333", border: "1px solid rgba(255,255,255,0.06)" }}>
      {state === "loading" ? "..." : "✕"}
    </button>
  );
}

/* ─── Nuke Button (elimina cuenta completa: lead + owner + restaurant) ─── */
function NukeButton({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "confirm" | "loading" | "error">("idle");
  const nuke = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/admin/lead/${leadId}/nuke`, { method: "DELETE" });
      if (res.ok) onDone();
      else {
        const data = await res.json().catch(() => ({}));
        console.error("[nuke]", data.error);
        setState("error");
        setTimeout(() => setState("idle"), 4000);
      }
    } catch { setState("error"); setTimeout(() => setState("idle"), 4000); }
  };
  if (state === "error") return <span style={{ fontSize: 10, color: "#f87171" }}>Error al eliminar ✕</span>;
  if (state === "confirm") return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <span style={{ fontSize: 10, color: "#f87171" }}>¿Eliminar cuenta?</span>
      <button onClick={nuke} style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, cursor: "pointer", background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>Sí, eliminar todo</button>
      <button onClick={() => setState("idle")} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, cursor: "pointer", background: "transparent", color: "#555", border: "1px solid rgba(255,255,255,0.06)" }}>No</button>
    </span>
  );
  return (
    <button onClick={() => setState("confirm")} disabled={state === "loading"} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, cursor: "pointer", background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>
      {state === "loading" ? "..." : "🗑 Eliminar cuenta"}
    </button>
  );
}

/* ─── Panel Activities (lazy) ─── */
interface PanelActivity {
  id: string;
  action: string;
  details: any;
  ip: string | null;
  createdAt: string;
  restaurantName: string | null;
}

function PanelActivitiesBlock({ leadId }: { leadId: string }) {
  const [activities, setActivities] = useState<PanelActivity[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (activities !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lead/${leadId}/activities`);
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, activities]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ fontSize: 11, color: "#444", padding: "6px 0" }}>Cargando acciones...</div>;
  if (!activities || activities.length === 0) return <div style={{ fontSize: 11, color: "#333", padding: "4px 0" }}>Sin acciones registradas en el panel.</div>;

  const SECTION_LABELS: Record<string, string> = {
    "": "Dashboard",
    inicio: "Dashboard",
    menus: "Carta / Menús",
    analytics: "Analytics",
    clientes: "Clientes",
    loyalty: "Loyalty",
    "pedir-online": "Pedir Online",
    promociones: "Promociones",
    anuncios: "Anuncios",
    configuracion: "Configuración",
    ajustes: "Ajustes",
    "mi-restaurante": "Mi Restaurante",
    facturacion: "Facturación",
    suscripcion: "Suscripción",
    qr: "Código QR",
    exportar: "Exportar",
    garzon: "Garzón",
    control: "Control de stock",
    valoraciones: "Valoraciones",
    segmentos: "Segmentos",
    campanias: "Campañas",
    usuarios: "Usuarios",
    automatizaciones: "Automatizaciones",
    ayuda: "Ayuda",
    perfil: "Perfil",
    live: "Vista en vivo",
    invite: "Invitar equipo",
  };

  function getLabel(a: PanelActivity): string {
    const det = a.details as any;
    if (a.action === "panel_visit") {
      const raw = det?.section || "";
      // section puede ser "menus", "loyalty/miembros", "pedir-online", etc.
      const base = raw.split("/")[0];
      const sub = raw.includes("/") ? raw.split("/").slice(1).join("/") : null;
      const sectionName = SECTION_LABELS[base] || base || "Dashboard";
      return sub ? `Visitó ${sectionName} › ${sub}` : `Visitó ${sectionName}`;
    }
    const LABELS: Record<string, string> = {
      panel_login: "Ingresó al panel",
      dish_edit: "Editó un plato",
      dish_create: "Creó un plato",
      dish_delete: "Eliminó un plato",
      dish_show: "Mostró un plato",
      dish_hide: "Ocultó un plato",
      photo_upload: "Subió foto",
      category_create: "Creó categoría",
      category_edit: "Editó categoría",
      category_delete: "Eliminó categoría",
      category_show: "Mostró categoría",
      category_hide: "Ocultó categoría",
      settings_change: "Cambió configuración",
      promo_create: "Creó promoción",
      promo_edit: "Editó promoción",
      announcement_create: "Creó anuncio",
      modifier_create: "Creó modificador",
      modifier_edit: "Editó modificador",
      modifier_delete: "Eliminó modificador",
      pedidos_online_visit: "Visitó Pedir Online",
      pedidos_online_activated: "Activó Pedir Online",
      loyalty_visit: "Visitó Loyalty",
      loyalty_member_add: "Agregó miembro Loyalty",
      qr_download: "Descargó QR",
      menu_create: "Creó menú",
      menu_edit: "Editó menú",
      menu_delete: "Eliminó menú",
      dish_move: "Movió un plato",
      dish_reorder: "Reordenó platos",
      import_start: "Inició importación",
      import_complete: "Completó importación",
      menu_import: "Importó carta",
      password_change: "Cambió contraseña",
      weekly_email_toggle: "Cambió email semanal",
      exportar_carta_viewed: "Vio exportar carta",
      exportar_pdf_download: "Descargó PDF",
      exportar_image_download: "Descargó imagen",
      plan_modal_opened: "Abrió modal de planes",
      plan_subscribe_clicked: "Hizo clic en suscribirse",
    };
    return LABELS[a.action] || a.action;
  }

  // Group by unique IPs seen
  const uniqueIps = [...new Set(activities.map((a) => a.ip).filter(Boolean))];

  // Collapse consecutive panel_visit to same section (keep first + count)
  const collapsed: Array<PanelActivity & { count: number }> = [];
  for (const a of activities) {
    const prev = collapsed[collapsed.length - 1];
    const det = a.details as any;
    const prevDet = prev?.details as any;
    if (
      prev &&
      a.action === "panel_visit" &&
      prev.action === "panel_visit" &&
      det?.section === prevDet?.section
    ) {
      prev.count++;
    } else {
      collapsed.push({ ...a, count: 1 });
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        Acciones en panel
        <span style={{ color: "#555", fontWeight: 400, fontSize: 9, textTransform: "none" }}>{activities.length} eventos</span>
        {uniqueIps.length > 0 && (
          <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 600, background: "rgba(239,68,68,0.08)", padding: "1px 6px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.15)" }}>
            IP{uniqueIps.length > 1 ? "s" : ""}: {uniqueIps.join(", ")}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {collapsed.map((a) => {
          const label = getLabel(a);
          const d = new Date(a.createdAt);
          const ts = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
          const device = (a.details as any)?.deviceType;
          const isVisit = a.action === "panel_visit";
          const isAction = !isVisit && a.action !== "panel_login";
          return (
            <div key={a.id} style={{
              display: "flex", gap: 8, alignItems: "center", fontSize: 11,
              padding: "3px 0", borderBottom: "1px solid #0d0d0d",
              opacity: isVisit ? 0.65 : 1,
            }}>
              <span style={{ color: "#333", minWidth: 90, fontFamily: "monospace", fontSize: 10 }}>{ts}</span>
              <span title={device}>{device === "mobile" ? "📱" : "💻"}</span>
              <span style={{
                flex: 1,
                color: isAction ? "#e8c87a" : isVisit ? "#666" : "#aaa",
                fontWeight: isAction ? 600 : 400,
              }}>
                {label}
                {a.count > 1 && <span style={{ color: "#444", fontSize: 10, marginLeft: 4 }}>×{a.count}</span>}
              </span>
              {(a.details as any)?.email && (
                <span style={{ color: "#555", fontSize: 10 }}>{(a.details as any).email}</span>
              )}
              {a.ip && <span style={{ color: "#333", fontSize: 10, fontFamily: "monospace" }}>{a.ip}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Reprocess Button ─── */
function ReprocessButton({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const reprocess = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/subircarta/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId }) });
      if (res.ok) { setState("ok"); onDone(); } else { setState("error"); setTimeout(() => setState("idle"), 3000); }
    } catch { setState("error"); setTimeout(() => setState("idle"), 3000); }
  };
  return (
    <button onClick={reprocess} disabled={state === "loading" || state === "ok"} style={{
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, cursor: state === "loading" ? "wait" : "pointer",
      background: state === "ok" ? "rgba(34,197,94,0.1)" : state === "error" ? "rgba(239,68,68,0.1)" : "rgba(168,85,247,0.1)",
      color: state === "ok" ? "#22c55e" : state === "error" ? "#f87171" : "#a855f7",
      border: `1px solid ${state === "ok" ? "rgba(34,197,94,0.2)" : state === "error" ? "rgba(239,68,68,0.2)" : "rgba(168,85,247,0.2)"}`,
    }}>
      {state === "loading" ? "Procesando..." : state === "ok" ? "Listo" : state === "error" ? "Error" : "Reprocesar"}
    </button>
  );
}
