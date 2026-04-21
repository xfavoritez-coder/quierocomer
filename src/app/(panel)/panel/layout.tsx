"use client";
import { usePathname } from "next/navigation";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { SessionContext } from "@/lib/admin/SessionContext";
import AdminLayoutOwner from "@/components/admin/layouts/AdminLayoutOwner";

const PUBLIC_PATHS = ["/panel/login", "/panel/forgot-password", "/panel/reset-password"];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { name, loading, error, logout, restaurants, selectedRestaurantId, setSelectedRestaurant, role } = usePanelSession();

  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
        {/* Desktop skeleton */}
        <div className="panel-skel-desktop">
          <aside style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 220, background: "#FFF9ED", borderRight: "1px solid #E8D0A0", padding: "18px 16px" }}>
            <div className="skel-pulse" style={{ width: 120, height: 18, borderRadius: 4, marginBottom: 24 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...Array(6)].map((_, i) => <div key={i} className="skel-pulse" style={{ height: 36, borderRadius: 8 }} />)}
            </div>
          </aside>
          <main style={{ marginLeft: 220, padding: "24px 32px" }}>
            <div className="skel-pulse" style={{ width: 200, height: 24, borderRadius: 6, marginBottom: 12 }} />
            <div className="skel-pulse" style={{ width: 300, height: 14, borderRadius: 4, marginBottom: 24 }} />
            <div className="skel-pulse" style={{ height: 90, borderRadius: 16, marginBottom: 20 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skel-pulse" style={{ height: 72, borderRadius: 12 }} />)}
            </div>
          </main>
        </div>
        {/* Mobile skeleton */}
        <div className="panel-skel-mobile">
          <header style={{ height: 56, background: "#FFF9ED", borderBottom: "1px solid #E8D0A0", display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
            <div className="skel-pulse" style={{ width: 100, height: 18, borderRadius: 4 }} />
            <div style={{ flex: 1 }} />
            <div className="skel-pulse" style={{ width: 36, height: 36, borderRadius: "50%" }} />
          </header>
          <div style={{ padding: "20px 16px" }}>
            <div className="skel-pulse" style={{ width: 160, height: 20, borderRadius: 6, marginBottom: 10 }} />
            <div className="skel-pulse" style={{ width: 240, height: 12, borderRadius: 4, marginBottom: 20 }} />
            <div className="skel-pulse" style={{ height: 80, borderRadius: 16, marginBottom: 16 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skel-pulse" style={{ height: 64, borderRadius: 12 }} />)}
            </div>
          </div>
          <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 64, background: "white", borderTop: "1px solid #E8D0A0", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 16px" }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skel-pulse" style={{ width: 40, height: 40, borderRadius: 8 }} />)}
          </nav>
        </div>
        <style>{`
          @keyframes skelPulse { 0%, 100% { opacity: 0.06; } 50% { opacity: 0.12; } }
          .skel-pulse { background: #F4A623; animation: skelPulse 1.4s ease-in-out infinite; }
          .panel-skel-mobile { display: none; }
          @media (max-width: 767px) {
            .panel-skel-desktop { display: none; }
            .panel-skel-mobile { display: block; }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    if (typeof window !== "undefined") window.location.href = "/panel/login";
    return null;
  }

  const ctxValue = {
    role,
    name,
    restaurants,
    selectedRestaurantId,
    isSuper: false,
    loading: false,
    error: false,
    setSelectedRestaurant,
    logout,
  };

  return (
    <SessionContext.Provider value={ctxValue}>
      <AdminLayoutOwner
        name={name}
        restaurants={restaurants}
        selectedRestaurantId={selectedRestaurantId}
        setSelectedRestaurant={setSelectedRestaurant}
        logout={logout}
        basePath="/panel"
      >
        {children}
      </AdminLayoutOwner>
    </SessionContext.Provider>
  );
}
