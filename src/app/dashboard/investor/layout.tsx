import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Grant Giver Dashboard",
  description: "Overview of your milestone escrow contracts. Fund milestones and track AI verification results.",
};

export default function InvestorDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
