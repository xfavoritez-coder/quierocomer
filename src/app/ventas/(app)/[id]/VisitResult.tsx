"use client";

import { useRouter } from "next/navigation";
import CloseBar from "@/components/ventas/demo/CloseBar";

/** Resultado de la visita (después de la demo): Aceptó, Lo quiere pensar, No aceptó o Registrar ahora. */
export default function VisitResult(props: { leadId: string; color: string; email: string; whatsapp: string; planId: string | null; localName: string }) {
  const router = useRouter();
  return (
    <CloseBar inline open onClose={() => {}} onDone={() => router.refresh()} leadId={props.leadId} color={props.color}
      initialEmail={props.email} initialWhatsapp={props.whatsapp} planId={props.planId} localName={props.localName} />
  );
}
