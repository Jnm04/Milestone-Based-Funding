import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Receiver Dashboard",
  description: "View your contracts, submit milestone proof, and track AI verification on Cascrow.",
};

export default function StartupDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
