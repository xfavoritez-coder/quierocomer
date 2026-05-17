import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OnboardingTest({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  await prisma.restaurant.updateMany({
    where: { slug, isDemo: true },
    data: { demoOnboardingDone: false },
  });

  // Use timestamp to bust cache
  redirect(`/qr/${slug}?onboarding=1&t=${Date.now()}`);
}
