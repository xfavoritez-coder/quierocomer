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
      <div style={{ minHeight: "100vh", background: "#FFF9ED", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#F4A623", fontFamily: "var(--font-display)", fontSize: "0.85rem" }}>🧞 Cargando...</p>
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
