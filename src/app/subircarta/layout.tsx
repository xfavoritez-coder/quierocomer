import type { Viewport } from "next";

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function SubirCartaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#090806", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: `html, body { background: #090806 !important; color: #F2E5CF !important; overflow-x: hidden !important; }` }} />
      {children}
    </div>
  );
}
