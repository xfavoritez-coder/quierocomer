import { notFound } from "next/navigation";
import { loadEcommerceTenant } from "@/lib/ecommerce/storefront-data";
import CheckoutForm from "@/components/ecommerce/CheckoutForm";

export const dynamic = "force-dynamic";

export default async function EcommerceCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadEcommerceTenant(slug);
  if (!tenant) return notFound();
  return <CheckoutForm tenant={tenant} />;
}
