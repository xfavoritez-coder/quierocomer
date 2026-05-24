/**
 * Plan feature access system.
 *
 * Re-exports everything from the central plan definition.
 * All plan data lives in @/lib/billing/plans-central.ts — edit THAT file.
 */
export type { PlanKey as Plan, Feature } from "@/lib/billing/plans-central";
export {
  canAccess,
  effectivePlan,
  normalizePlan,
  requiredPlan,
  PLAN_INFO,
  maxVisibleClients,
} from "@/lib/billing/plans-central";
