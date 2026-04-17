import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Cascrow account to manage your milestone-based escrow contracts.",
  alternates: { canonical: "https://cascrow.com/login" },
  robots: { index: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
