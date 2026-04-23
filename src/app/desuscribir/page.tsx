"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function DesuscribirContent() {
  const params = useSearchParams();
  const email = params.get("email");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!email) return;
    fetch(`/api/platform/desuscribir?email=${encodeURIComponent(email)}`)
      .then(() => setDone(true))
      .catch(() => setDone(true));
  }, [email]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f0e8", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", maxWidth: 440, textAlign: "center", boxShadow: "0 2px 24px rgba(0,0,0,0.06)" }}>
        <p style={{ fontSize: 40, margin: "0 0 16px" }}>📭</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 12 }}>
          {done ? "Te has desuscrito" : "Procesando..."}
        </h1>
        {done && (
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.6 }}>
            No recibirás más correos de QuieroComer. Si fue un error, escríbenos a <a href="mailto:favoritez@gmail.com" style={{ color: "#d4a015" }}>favoritez@gmail.com</a>.
          </p>
        )}
      </div>
    </div>
  );
}

export default function DesuscribirPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f5f0e8" }} />}>
      <DesuscribirContent />
    </Suspense>
  );
}
