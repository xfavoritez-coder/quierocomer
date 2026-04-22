"use client";

// Reusable skeleton patterns for admin/panel pages
// Usage: <Skeleton type="list" /> or <Skeleton type="analytics" />

type SkeletonType = "list" | "analytics" | "cards" | "form" | "table";

const PULSE_STYLE = `
  @keyframes skelPulse { 0%, 100% { opacity: 0.06; } 50% { opacity: 0.12; } }
  .sk { background: #F4A623; animation: skelPulse 1.4s ease-in-out infinite; }
`;

function Box({ w, h, r = 8, mb = 0 }: { w?: string | number; h: number; r?: number; mb?: number }) {
  return <div className="sk" style={{ width: w || "100%", height: h, borderRadius: r, marginBottom: mb }} />;
}

function ListSkeleton() {
  return (
    <div>
      <Box h={14} w={120} r={4} mb={16} />
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
          <div className="sk" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Box h={12} w="60%" r={4} mb={6} />
            <Box h={10} w="35%" r={4} />
          </div>
          <Box h={14} w={50} r={4} />
        </div>
      ))}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Box h={14} w={100} r={4} />
        <div style={{ flex: 1 }} />
        <Box h={32} w={140} r={8} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[...Array(4)].map((_, i) => <Box key={i} h={90} r={14} />)}
      </div>
      <Box h={200} r={14} mb={16} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Box h={120} r={14} />
        <Box h={120} r={14} />
      </div>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div>
      <Box h={14} w={100} r={4} mb={16} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...Array(4)].map((_, i) => (
          <Box key={i} h={80} r={14} />
        ))}
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div>
      <Box h={20} w={180} r={6} mb={8} />
      <Box h={12} w={280} r={4} mb={24} />
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ marginBottom: 20 }}>
          <Box h={80} r={14} />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div>
      <Box h={14} w={100} r={4} mb={16} />
      <Box h={36} r={8} mb={8} />
      {[...Array(6)].map((_, i) => (
        <Box key={i} h={44} r={0} mb={1} />
      ))}
    </div>
  );
}

export default function SkeletonLoading({ type = "list" }: { type?: SkeletonType }) {
  const Component = {
    list: ListSkeleton,
    analytics: AnalyticsSkeleton,
    cards: CardsSkeleton,
    form: FormSkeleton,
    table: TableSkeleton,
  }[type];

  return (
    <div style={{ maxWidth: 800 }}>
      <Component />
      <style>{PULSE_STYLE}</style>
    </div>
  );
}
