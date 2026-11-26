import { redirect } from "next/navigation";
import { getCurrentSeller } from "@/lib/ventas/session";

export const dynamic = "force-dynamic";

// Demo a pantalla completa (sin la barra de /ventas). Exige sesión de vendedor.
export default async function VentasPresentLayout({ children }: { children: React.ReactNode }) {
  if (!(await getCurrentSeller())) redirect("/ventas/login");
  return <>{children}</>;
}
