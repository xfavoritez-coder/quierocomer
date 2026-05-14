import { Metadata } from "next";
import SubirCartaClient from "./SubirCartaClient";

export const metadata: Metadata = {
  title: "Subir mi carta · QuieroComer",
  description: "Sube tu carta física, PDF o link QR y nuestra IA la transforma en una Carta Viva.",
};

export default function SubirCartaPage() {
  return <SubirCartaClient />;
}
