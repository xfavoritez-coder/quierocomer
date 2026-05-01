import { prisma } from "@/lib/prisma";
import { seedBannerVariants } from "./seedBannerVariants";

export async function selectBannerVariant() {
  let variants = await prisma.bannerVariant.findMany({ where: { isActive: true } });

  // Auto-seed on first call if table is empty (avoids manual seed step)
  if (variants.length === 0) {
    await seedBannerVariants();
    variants = await prisma.bannerVariant.findMany({ where: { isActive: true } });
    if (variants.length === 0) return null;
  }

  // If there's a winner, always return it
  const winner = variants.find((v) => v.isWinner);
  if (winner) return winner;

  // Exploration: any variant with < 100 impressions gets priority
  const underExplored = variants.filter((v) => v.impressions < 100);
  if (underExplored.length > 0) {
    return underExplored[Math.floor(Math.random() * underExplored.length)];
  }

  // Epsilon-greedy: 10% explore, 90% exploit
  if (Math.random() < 0.1) {
    return variants[Math.floor(Math.random() * variants.length)];
  }

  // Exploit: return highest conversion rate
  const ranked = variants
    .map((v) => ({ ...v, rate: v.impressions > 0 ? v.conversions / v.impressions : 0 }))
    .sort((a, b) => b.rate - a.rate);

  // Check for statistical tie (< 2% difference)
  if (ranked.length >= 2 && ranked[0].rate - ranked[1].rate < 0.02) {
    // Mark shorter text as winner (simpler = better in a tie)
    const simpler = ranked[0].text.length <= ranked[1].text.length ? ranked[0] : ranked[1];
    await prisma.bannerVariant.update({ where: { id: simpler.id }, data: { isWinner: true } });
    await prisma.bannerVariant.updateMany({ where: { id: { not: simpler.id } }, data: { isActive: false } });
    return simpler;
  }

  return ranked[0];
}

export async function recordImpression(variantId: string) {
  await prisma.bannerVariant.update({
    where: { id: variantId },
    data: { impressions: { increment: 1 } },
  });
}

export async function recordConversion(variantId: string) {
  const variant = await prisma.bannerVariant.update({
    where: { id: variantId },
    data: { conversions: { increment: 1 } },
  });

  // Auto-promote: if rate > 15% and 200+ impressions
  const rate = variant.impressions > 0 ? variant.conversions / variant.impressions : 0;
  if (rate > 0.15 && variant.impressions > 200) {
    await prisma.bannerVariant.update({ where: { id: variantId }, data: { isWinner: true } });
    await prisma.bannerVariant.updateMany({ where: { id: { not: variantId } }, data: { isActive: false } });
  }
}
