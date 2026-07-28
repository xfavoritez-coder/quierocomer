import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loyalty | QuieroComer",
  description:
    "Programa de fidelización de QuieroComer. Próximamente.",
  openGraph: {
    title: "Loyalty | QuieroComer",
    description:
      "Programa de fidelización de QuieroComer. Próximamente.",
    url: "https://quierocomer.com/loyalty",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
  },
};

export default function LoyaltyPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-white px-6 text-center">
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Loyalty</h1>
      <p className="mt-4 text-neutral-400 max-w-md">
        Programa de fidelización de QuieroComer. Próximamente.
      </p>
    </main>
  );
}
