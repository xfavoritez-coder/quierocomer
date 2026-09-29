export default function MenuPausedPage({
  restaurantName,
  logoUrl,
  mode = "qr",
}: {
  restaurantName: string;
  logoUrl?: string | null;
  mode?: "qr" | "ordering";
}) {
  const initial = restaurantName.charAt(0).toUpperCase();

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      background: "rgba(0,0,0,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 20,
        boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
        maxWidth: 320,
        width: "100%",
        overflow: "hidden",
        textAlign: "center",
      }}>
        {/* Franja superior */}
        <div style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
          padding: "20px 20px 22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: "#fff",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
            overflow: "hidden",
          }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={restaurantName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 22, fontWeight: 800, color: "#f97316", lineHeight: 1 }}>{initial}</span>
            )}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{restaurantName}</div>
          </div>
        </div>

        {/* Contenido */}
        <div style={{ padding: "20px 20px 22px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 8, lineHeight: 1.35 }}>
            Este menú está temporalmente fuera de línea
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
            El local está realizando cambios en su carta digital.
            Intenta nuevamente más tarde.
          </div>
        </div>
      </div>
    </div>
  );
}
