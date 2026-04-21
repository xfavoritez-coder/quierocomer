"use client";
import { usePathname } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import AdminLayoutSuper from "@/components/admin/layouts/AdminLayoutSuper";

const PUBLIC_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { name, loading, error, logout } = useAdminSession();

  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#111111", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#F4A623", fontFamily: "var(--font-display)", fontSize: "0.8rem" }}>🧞 Cargando...</p>
      </div>
    );
  }

  if (error) {
    if (typeof window !== "undefined") window.location.href = "/admin/login";
    return null;
  }

  return <AdminLayoutSuper name={name} logout={logout}>{children}</AdminLayoutSuper>;
}
