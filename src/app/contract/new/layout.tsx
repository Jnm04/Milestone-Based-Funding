import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Contract",
  description: "Create a new milestone-based escrow contract. Define milestones, amounts, and deadlines.",
};

export default function NewContractLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
