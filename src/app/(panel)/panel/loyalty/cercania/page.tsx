"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CercaniaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/panel/loyalty/notificaciones");
  }, [router]);
  return null;
}
