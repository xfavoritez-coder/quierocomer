import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * /test-onboarding?slug=xxx
 * Resets onboarding state for a demo restaurant and redirects to its carta.
 * Only works for demo restaurants. For testing purposes.
 */
export default async function TestOnboardingPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const { slug } = await searchParams;
  if (!slug) return <p>Agrega ?slug=nombre-del-local</p>;

  // Reset onboarding done flag
  await prisma.restaurant.updateMany({
    where: { slug, isDemo: true },
    data: { demoOnboardingDone: false },
  });

  redirect(`/qr/${slug}`);
}
