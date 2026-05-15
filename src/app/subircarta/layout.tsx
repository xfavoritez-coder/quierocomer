export default function SubirCartaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#090806", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: `html, body { background: #090806 !important; color: #F2E5CF !important; }` }} />
      {children}
    </div>
  );
}
