"use client";

import { usePanelSession } from "@/lib/admin/usePanelSession";
import PlanGate from "./PlanGate";
import type { Feature } from "@/lib/plans";

interface Props {
  feature: Feature;
  children: React.ReactNode;
}

/**
 * Wraps a panel page with plan gating.
 * Shows blurred content + upgrade modal if the active restaurant's plan
 * doesn't include the required feature.
 */
export default function PlanPageGate({ feature, children }: Props) {
  const { activePlan } = usePanelSession();

  return (
    <PlanGate plan={activePlan} feature={feature} blur>
      {children}
    </PlanGate>
  );
}
