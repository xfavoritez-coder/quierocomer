"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuscripcionRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/panel/mi-restaurante"); }, [router]);
  return null;
}
