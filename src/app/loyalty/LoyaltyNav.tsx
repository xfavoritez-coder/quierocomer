"use client";

import { usePathname } from "next/navigation";

const TABS = [
  { href: "/loyalty", label: "Configuración" },
  { href: "/loyalty/miembros", label: "Miembros" },
];

export default function LoyaltyNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex gap-1 border-b border-neutral-800">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <a
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-amber-500 text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
