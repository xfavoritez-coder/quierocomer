import { redirect } from "next/navigation";

export default async function MesaRedirect({ params, searchParams }: {
  params: Promise<{ slug: string; tableId: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { slug, tableId } = await params;
  const { demo } = await searchParams;

  // Redirect to the main carta page with mesa param
  // The client-side will handle setting the mesa token
  const demoParam = demo ? "&demo=true" : "";
  redirect(`/qr/${slug}?mesa=${tableId}${demoParam}`);
}
