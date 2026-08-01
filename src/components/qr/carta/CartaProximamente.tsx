"use client";

interface Props {
  restaurantName: string;
  logoUrl?: string | null;
}

export default function CartaProximamente({ restaurantName, logoUrl }: Props) {
  const initials = restaurantName
    .split(" ")
    .map(w => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0f0f0f",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      textAlign: "center",
    }}>
      {/* Logo / initials */}
      <div style={{ marginBottom: 24 }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={restaurantName}
            width={72}
            height={72}
            style={{
              width: 72, height: 72, borderRadius: "50%",
              objectFit: "cover", border: "2px solid #2a2a2a",
            }}
          />
        ) : (
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "#1a1a1a", border: "2px solid #2a2a2a",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem", fontWeight: 700, color: "#F4A623",
          }}>
            {initials}
          </div>
        )}
      </div>

      {/* Name */}
      <p style={{
        fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "#F4A623", marginBottom: 8,
      }}>
        {restaurantName}
      </p>

      {/* Headline */}
      <h1 style={{
        fontFamily: "Georgia, serif",
        fontSize: "clamp(1.4rem, 5vw, 1.8rem)",
        fontWeight: 400,
        color: "#fff",
        lineHeight: 1.3,
        margin: "0 0 16px",
        maxWidth: 340,
      }}>
        Carta en preparación
      </h1>

      <p style={{
        fontSize: "0.9rem",
        color: "#555",
        lineHeight: 1.65,
        maxWidth: 280,
        margin: "0 0 40px",
      }}>
        Pronto tendrás acceso a nuestra carta digital con fotos y toda la información de nuestros platos.
      </p>

      {/* Decorative divider */}
      <div style={{
        width: 40, height: 2, background: "#1e1e1e",
        borderRadius: 2, marginBottom: 24,
      }} />

      <p style={{ fontSize: "0.72rem", color: "#333" }}>
        Powered by{" "}
        <a
          href="https://quierocomer.com"
          style={{ color: "#F4A623", textDecoration: "none", fontWeight: 600 }}
          target="_blank"
          rel="noopener noreferrer"
        >
          QuieroComer
        </a>
      </p>
    </div>
  );
}
