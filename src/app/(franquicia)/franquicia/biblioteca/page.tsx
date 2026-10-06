import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

export default function BibliotecaPage() {
  return (
    <div
      style={{
        padding: "32px 36px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: `${GOLD}18`,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <FileText size={24} color={GOLD} />
      </div>
      <h1
        style={{
          fontFamily: F,
          fontSize: "1.3rem",
          fontWeight: 700,
          color: "var(--adm-text)",
          margin: "0 0 8px",
        }}
      >
        Biblioteca
      </h1>
      <p
        style={{
          fontFamily: FB,
          fontSize: "0.9rem",
          color: "var(--adm-text3)",
          margin: 0,
          maxWidth: 360,
        }}
      >
        Próximamente. Aquí encontrarás contratos, plantillas, manuales y
        documentos compartidos entre los proyectos.
      </p>
    </div>
  );
}
