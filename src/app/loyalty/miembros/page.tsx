import type { Metadata } from "next";
import MembersClient from "./MembersClient";

export const metadata: Metadata = {
  title: "Loyalty · Miembros | QuieroComer",
  description: "Gestiona los miembros de tu programa de fidelidad y sus sellos.",
  robots: { index: false, follow: false },
};

export default function LoyaltyMembersPage() {
  return <MembersClient />;
}
