"use client";

const F = "var(--font-display)";

export function Stat({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        {icon && <span style={{ fontSize: "1.1rem" }}>{icon}</span>}
        <p style={{ fontFamily: F, fontSize: "1.8rem", color: color || "var(--adm-stat)", margin: 0, fontWeight: 600 }}>{value}</p>
      </div>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>{label}</p>
      {sub && <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

export function RankList({ title, items, valueLabel = "" }: { title: string; items: { name: string; count: number }[]; valueLabel?: string }) {
  if (!items.length) return null;
  const max = items[0]?.count || 1;
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
      <h3 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</h3>
      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
            <span style={{ color: "var(--adm-text)", fontFamily: F }}>{item.name}</span>
            <span style={{ color: "var(--adm-text2)", fontFamily: F }}>{item.count}{valueLabel}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "var(--adm-card-border)" }}>
            <div style={{ width: `${(item.count / max) * 100}%`, height: "100%", background: i === 0 ? "var(--adm-accent)" : "rgba(244,166,35,0.4)", borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DistributionBar({ title, data, labels }: { title: string; data: Record<string, number>; labels?: Record<string, string> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const colors = ["#F4A623", "#3db89e", "#e85530", "#7fbfdc", "#c93010"];
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
      <h3 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</h3>
      <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", height: 8, marginBottom: 12 }}>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ width: `${(val / total) * 100}%`, background: colors[i % colors.length], height: "100%" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--adm-text2)", fontFamily: F }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />
            {labels?.[key] || key} ({Math.round((val / total) * 100)}%)
          </div>
        ))}
      </div>
    </div>
  );
}
