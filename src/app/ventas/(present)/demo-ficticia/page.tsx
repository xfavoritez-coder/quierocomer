import DemoShell from "@/components/ventas/demo/DemoShell";
import { fictionalDemo } from "@/components/ventas/demo/fictional";
import { getDemoPlans } from "@/lib/ventas/plans";

export const dynamic = "force-dynamic";

export default async function VentasDemoFicticiaPage() {
  const { sections, storePlan } = await getDemoPlans();
  return <DemoShell data={{ ...fictionalDemo(), plans: sections, storePlan }} mode="seller" exitHref="/ventas" />;
}
