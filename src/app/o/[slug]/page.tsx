import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function OnboardingTest({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  await prisma.restaurant.updateMany({
    where: { slug, isDemo: true },
    data: { demoOnboardingDone: false },
  });

  redirect(`/qr/${slug}`);
}
