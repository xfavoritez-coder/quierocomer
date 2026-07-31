import LoyaltyGate from "@/components/admin/LoyaltyGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <LoyaltyGate>{children}</LoyaltyGate>;
}
