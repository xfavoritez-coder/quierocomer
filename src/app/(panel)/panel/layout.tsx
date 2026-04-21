"use client";
import { usePathname } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import AdminLayoutOwner from "@/components/admin/layouts/AdminLayoutOwner";

const PUBLIC_PATHS = ["/panel/login", "/panel/forgot-password", "/panel/reset-password"];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { name, loading, error, logout, restaurants, selectedRestaurantId, setSelectedRestaurant } = useAdminSession();

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

  return (
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
  );
}
