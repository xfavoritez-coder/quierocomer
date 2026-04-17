import { prisma } from "@/lib/prisma";

const VARIANTS = [
  "🎂 Este restaurante tiene un regalo para tu cumpleaños. Déjanos tu fecha y te avisamos.",
  "🎁 ¿Cumpleaños próximo? Este restaurante tiene algo especial para ti.",
  "Clientes registrados reciben sorpresas en su cumpleaños aquí. ¿Te unes?",
  "🎂 Regístrate gratis y recibe un regalo de cumpleaños de este restaurante.",
  "¿Vuelves seguido? Regístrate y nunca más tendrás que decirle tus gustos al Genio.",
];

export async function seedBannerVariants() {
  const existing = await prisma.bannerVariant.count();
  if (existing > 0) return;

  await prisma.bannerVariant.createMany({
    data: VARIANTS.map((text) => ({ text })),
  });
}
