import LoyaltyGate from "@/components/admin/LoyaltyGate";

export default function LoyaltyLayout({ children }: { children: React.ReactNode }) {
  return <LoyaltyGate>{children}</LoyaltyGate>;
}
