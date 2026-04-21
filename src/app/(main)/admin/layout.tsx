"use client";
import { usePathname } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import AdminLayoutSuper from "@/components/admin/layouts/AdminLayoutSuper";
import AdminLayoutOwner from "@/components/admin/layouts/AdminLayoutOwner";

const PUBLIC_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];
const SUPERADMIN_ONLY_PATHS = ["/admin/locales", "/admin/experiencias", "/admin/owners"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { name, isSuper, loading, error, logout, restaurants, selectedRestaurantId, setSelectedRestaurant } = useAdminSession();

  // Public pages bypass layout
  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  // Loading
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFF9ED", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#F4A623", fontFamily: "var(--font-display)", fontSize: "0.85rem" }}>🧞 Cargando...</p>
      </div>
    );
  }

  // Auth error → redirect
  if (error) {
    if (typeof window !== "undefined") window.location.href = "/admin/login";
    return null;
  }

  // Owner trying to access superadmin-only routes → redirect
  if (!isSuper && SUPERADMIN_ONLY_PATHS.some(p => pathname.startsWith(p))) {
    if (typeof window !== "undefined") window.location.href = "/admin";
    return null;
  }

  // Superadmin → dark layout
  if (isSuper) {
    return <AdminLayoutSuper name={name} logout={logout}>{children}</AdminLayoutSuper>;
  }

  // Owner → warm mobile-first layout
  return (
    <AdminLayoutOwner
      name={name}
      restaurants={restaurants}
      selectedRestaurantId={selectedRestaurantId}
      setSelectedRestaurant={setSelectedRestaurant}
      logout={logout}
    >
      {children}
    </AdminLayoutOwner>
  );
}
