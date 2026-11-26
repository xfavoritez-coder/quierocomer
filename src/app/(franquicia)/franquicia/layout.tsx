import { requireFranAccess } from "@/lib/franAuth";
import { prisma } from "@/lib/prisma";
import { Toaster } from "sonner";
import FranSidebar from "@/components/fran/FranSidebar";

export const metadata = { title: "Franquicias · QuieroComer" };

export default async function FranquiciaLayout({ children }: { children: React.ReactNode }) {
  // Solo superadmin (ver requireFranAccess).
  await requireFranAccess();

  const marcas = await prisma.franMarca.findMany({
    where: { activa: true },
    include: {
      proyectos: {
        where: { estado: { not: "CANCELADO" } },
        select: { id: true, slug: true, nombre: true, estado: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div
      className="theme-dark"
      style={{
        "--font-display": '"Space Grotesk", system-ui, sans-serif',
        "--font-body": '"Inter", system-ui, sans-serif',
        display: "flex",
        minHeight: "100vh",
        background: "var(--adm-bg)",
      } as React.CSSProperties}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');`}</style>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var t=localStorage.getItem('qc_panel_theme');if(t==='light'){document.currentScript.parentElement.classList.remove('theme-dark');document.currentScript.parentElement.classList.add('theme-light');}})();`,
        }}
      />
      <FranSidebar marcas={marcas} />
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>{children}</main>
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            fontFamily: "var(--font-display), system-ui, sans-serif",
            fontSize: "0.85rem",
          },
        }}
      />
    </div>
  );
}
