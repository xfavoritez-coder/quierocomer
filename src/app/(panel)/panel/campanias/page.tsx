"use client";
import PlanPageGate from "@/components/admin/PlanPageGate";
import AdminCampanias from "@/components/admin/pages/campaniasPage";

export default function Page() {
  return (
    <PlanPageGate feature="campaigns">
      <AdminCampanias />
    </PlanPageGate>
  );
}
