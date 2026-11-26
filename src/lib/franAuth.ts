import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readAdminSession, readPanelSession } from "@/lib/session";

/**
 * Franquicias es solo para superadmin (sesión /admin firmada, o cuenta de panel
 * con rol SUPERADMIN). Se llama en el layout Y en cada página: en Next.js la
 * página se genera en paralelo al layout, así que un redirect solo en el layout
 * no impide que la página entregue sus datos.
 */
export async function requireFranAccess(): Promise<void> {
  const cookieStore = await cookies();
  const admin = readAdminSession(cookieStore);
  const panel = readPanelSession(cookieStore);
  if (admin?.role === "SUPERADMIN" || panel?.role === "SUPERADMIN") return;
  redirect(admin || !panel ? "/admin/login" : "/panel");
}
