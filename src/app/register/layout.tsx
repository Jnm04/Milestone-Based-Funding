import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your free Cascrow account and start using AI-powered milestone escrow on the XRP Ledger.",
  alternates: { canonical: "https://cascrow.com/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
