import { Metadata } from "next";
import { Suspense } from "react";
import Paso2Client from "./Paso2Client";

export const metadata: Metadata = {
  title: "Transformando tu carta · QuieroComer",
  description: "Estamos analizando tu carta y preparando una propuesta.",
};

export default function Paso2Page() {
  return (
    <Suspense>
      <Paso2Client />
    </Suspense>
  );
}
