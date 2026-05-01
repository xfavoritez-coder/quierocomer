"use client";
import PlanPageGate from "@/components/admin/PlanPageGate";
import AdminAnuncios from "@/components/admin/pages/anunciosPage";

export default function Page() {
  return (
    <PlanPageGate feature="announcements">
      <AdminAnuncios />
    </PlanPageGate>
  );
}
