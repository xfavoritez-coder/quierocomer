"use client";
import PlanPageGate from "@/components/admin/PlanPageGate";
import AdminPromos from "@/components/admin/pages/promocionesPage";

export default function Page() {
  return (
    <PlanPageGate feature="promotions">
      <AdminPromos />
    </PlanPageGate>
  );
}
