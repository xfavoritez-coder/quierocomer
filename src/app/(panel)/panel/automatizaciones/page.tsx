"use client";
import PlanPageGate from "@/components/admin/PlanPageGate";
import AdminAutomatizaciones from "@/components/admin/pages/automatizacionesPage";

export default function Page() {
  return (
    <PlanPageGate feature="automations">
      <AdminAutomatizaciones />
    </PlanPageGate>
  );
}
