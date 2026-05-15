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
  activated: boolean;
  detectedProvider: { name: string } | null;
  createdAt: string;
  step2At: string | null;
  completedAt: string | null;
  previewAt: string | null;
  readyAt: string | null;
}

interface Stats {
  total: number;
  reachedStep2: number;
  completed: number;
  abandoned: number;
  conversionRate: number;
  step2Rate: number;
  byType: { LINK: number; DOCUMENT: number; PHOTO: number };
}

export default function FunnelPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<"idle" | "active" | "denied">("idle");

  // Check if already subscribed on mount
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
        setStats(data.stats || null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    // Refresh when page becomes visible (coming back from notification or app switch)
    const onVisible = () => { if (document.visibilityState === "visible") fetchData(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (loading) {
    return <div style={{ padding: 40, color: "#aaa" }}>Cargando...</div>;
  }

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
          {pushStatus === "active" ? "🔔 Notificaciones activas" : pushStatus === "denied" ? "🔕 Bloqueadas" : "🔔 Activar notificaciones"}
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 20 }}>
          <StatCard label="Total leads" value={stats.total} />
          <StatCard label="Llegaron al paso 2" value={stats.reachedStep2} suffix={`${stats.step2Rate}%`} />
          <StatCard label="Completados" value={stats.completed} color="#43d17b" suffix={`${stats.conversionRate}%`} />
          <StatCard label="Abandonados" value={stats.abandoned} color="#e85d5d" />
          <StatCard label="Modo Link" value={stats.byType.LINK} />
          <StatCard label="Modo PDF" value={stats.byType.DOCUMENT} />
          <StatCard label="Modo Foto" value={stats.byType.PHOTO} />
        </div>
      )}

      {/* Leads — mobile cards */}
      <div className="funnel-cards">
        {leads.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#666" }}>No hay leads todavía.</div>
        )}
        {leads.map((lead) => {
          const date = new Date(lead.createdAt);
          const dateStr = `${date.getDate()}/${date.getMonth() + 1} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
          const domain = lead.cartaUrl ? (() => { try { return new URL(lead.cartaUrl).hostname; } catch { return lead.cartaUrl; } })() : null;

          const fmtTime = (iso: string | null) => {
            if (!iso) return null;
            const d = new Date(iso);
            return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
          };
          const diffStr = (from: string | null, to: string | null) => {
            if (!from || !to) return null;
            const secs = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000);
            if (secs < 60) return `${secs}s`;
            const mins = Math.floor(secs / 60);
            const remainSecs = secs % 60;
            return `${mins}m ${remainSecs}s`;
          };

          return (
            <div key={lead.id} style={{ background: "#1a1a1a", borderRadius: 12, padding: "14px 16px", border: "1px solid #2a2a2a", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{lead.localName || "Sin nombre"}</span>
                <StatusBadge status={lead.cartaStatus} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "#aaa" }}>
                <span>{dateStr}</span>
                {lead.ownerName && <span>{lead.ownerName}</span>}
                {lead.detectedProvider?.name && <span>{lead.detectedProvider.name}</span>}
                <TypeBadge type={lead.cartaType} />
              </div>
              {lead.email && <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>{lead.email}</div>}

              {/* Timeline de tiempos */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 11, marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "#111", border: "1px solid #222" }}>
                <TimelineStep label="Inicio" time={fmtTime(lead.createdAt)} />
                <TimelineStep label="Paso 2" time={fmtTime(lead.step2At)} delta={diffStr(lead.createdAt, lead.step2At)} />
                <TimelineStep label="Preview" time={fmtTime(lead.previewAt)} delta={diffStr(lead.step2At || lead.createdAt, lead.previewAt)} />
                <TimelineStep label="Lista" time={fmtTime(lead.readyAt)} delta={diffStr(lead.previewAt || lead.createdAt, lead.readyAt)} />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                {domain && <a href={lead.cartaUrl!} target="_blank" rel="noopener noreferrer" style={{ color: "#F4A623", fontSize: 12, fontWeight: 600 }}>{domain}</a>}
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
  const colors: Record<string, string> = { PENDING: "#f59e0b", PROCESSING: "#3b82f6", READY: "#43d17b", DELIVERED: "#43d17b" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${colors[status] || "#666"}22`, color: colors[status] || "#666" }}>
      {status}
    </span>
  );
}

function TimelineStep({ label, time, delta }: { label: string; time: string | null; delta?: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ color: time ? "#F4A623" : "#444", fontWeight: 600 }}>{label}</span>
      {time ? (
        <span style={{ color: "#888" }}>{time}{delta && <span style={{ color: "#666", marginLeft: 3 }}>({delta})</span>}</span>
      ) : (
        <span style={{ color: "#333" }}>—</span>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" };
const td: React.CSSProperties = { padding: "10px 12px", color: "#ddd" };
