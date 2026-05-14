import { Metadata } from "next";
import { Suspense } from "react";
import ConfirmacionClient from "./ConfirmacionClient";

export const metadata: Metadata = {
  title: "Tu carta está en preparación · QuieroComer",
  description: "Estamos transformando tu carta. Recibirás un correo con el resultado.",
};

export default function ConfirmacionPage() {
  return (
    <Suspense>
      <ConfirmacionClient />
    </Suspense>
  );
}
