export default function SubirCartaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `body { background: #090806 !important; }` }} />
      {children}
    </>
  );
}
