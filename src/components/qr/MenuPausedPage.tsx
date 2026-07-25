export default function MenuPausedPage({
  restaurantName,
  logoUrl,
}: {
  restaurantName: string;
  logoUrl?: string | null;
}) {
  const initial = restaurantName.charAt(0).toUpperCase();

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#fafaf8",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 24,
        boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
        maxWidth: 380,
        width: "100%",
        overflow: "hidden",
        textAlign: "center",
      }}>
        {/* Franja superior ámbar */}
        <div style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
          padding: "36px 24px 40px",
        }}>
          {/* Logo o inicial */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 18,
            background: "#fff",
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
            overflow: "hidden",
          }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={restaurantName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 32, fontWeight: 800, color: "#f97316", lineHeight: 1 }}>
                {initial}
              </span>
            )}
          </div>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px" }}>
            {restaurantName}
          </div>
        </div>

        {/* Contenido */}
        <div style={{ padding: "28px 28px 32px" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a", marginBottom: 10, lineHeight: 1.35 }}>
            Este menú está temporalmente fuera de línea
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
            El local está actualizando su carta digital.<br />
            Intenta nuevamente más tarde.
          </div>

          {/* Footer dueño */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px dashed #e5e7eb" }}>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 6px" }}>
              ¿Eres el dueño de este local?
            </p>
            <a
              href="/panel"
              style={{ fontSize: 12, color: "#f97316", fontWeight: 600, textDecoration: "none" }}
            >
              Renueva tu plan en QuieroComer →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
