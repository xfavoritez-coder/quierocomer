import { cookies } from "next/headers";
import { getPanelId } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import VerificarEmailClient from "./VerificarEmailClient";

export default async function VerificarEmailPage() {
  const cookieStore = await cookies();
  const ownerId = getPanelId(cookieStore);

  if (!ownerId || ownerId.startsWith("tm_")) {
    redirect("/panel/login");
  }

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: ownerId },
    select: { id: true, email: true, name: true, emailVerificado: true },
  });

  if (!owner) redirect("/panel/login");

  // If already verified (e.g., someone navigates here directly), send to panel
  if (owner.emailVerificado) {
    redirect("/panel");
  }

  // Mask email: j***@gmail.com
  const [localPart, domain] = owner.email.split("@");
  const maskedLocal = localPart.length <= 2
    ? localPart[0] + "***"
    : localPart[0] + "***" + localPart.slice(-1);
  const maskedEmail = `${maskedLocal}@${domain}`;

  return (
    <VerificarEmailClient
      ownerId={owner.id}
      email={owner.email}
      maskedEmail={maskedEmail}
      ownerName={owner.name}
    />
  );
}
