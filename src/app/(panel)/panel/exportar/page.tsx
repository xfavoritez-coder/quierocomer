"use client";
import PlanPageGate from "@/components/admin/PlanPageGate";
import ExportarCartaPage from "./ExportarCartaPage";

export default function Page() {
  return (
    <PlanPageGate feature="print_menu">
      <ExportarCartaPage />
    </PlanPageGate>
  );
}
