import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loyalty · En construcción | QuieroComer",
  description:
    "Estamos construyendo el programa de fidelización de QuieroComer. Muy pronto podrás premiar a tus clientes frecuentes.",
  openGraph: {
    title: "Loyalty · En construcción | QuieroComer",
    description:
      "Estamos construyendo el programa de fidelización de QuieroComer. Muy pronto podrás premiar a tus clientes frecuentes.",
    url: "https://quierocomer.com/loyalty",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
  },
};

export default function LoyaltyPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-white px-6 py-16 text-center">
      <div className="text-6xl mb-6" role="img" aria-label="En construcción">
        🚧
      </div>

      <span className="inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-sm font-medium text-amber-400">
        En construcción
      </span>

      <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">
        Loyalty
      </h1>

      <p className="mt-4 max-w-md text-neutral-400 leading-relaxed">
        Estamos construyendo el programa de fidelización de QuieroComer. Muy
        pronto podrás premiar a tus clientes frecuentes y hacer que vuelvan una
        y otra vez. 🎁
      </p>

      <p className="mt-8 text-sm text-neutral-600">
        Vuelve pronto — esto va a estar muy bueno.
      </p>
    </main>
  );
}
