"use client";
import PlanPageGate from "@/components/admin/PlanPageGate";
import AdminAnalytics from "@/components/admin/pages/analyticsPage";

export default function Page() {
  return (
    <PlanPageGate feature="stats_basic">
      <AdminAnalytics />
    </PlanPageGate>
  );
}
