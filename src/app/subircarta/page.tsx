import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subir mi carta · QuieroComer",
  description: "Sube tu carta física, PDF o link QR y nuestra IA la transforma en una Carta Viva.",
};

export default function SubirCartaPage() {
  return (
    <iframe
      src="/subircarta.html"
      style={{ width: "100%", height: "100vh", border: "none", display: "block" }}
      title="Subir carta — QuieroComer"
    />
  );
}
