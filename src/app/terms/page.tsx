import type { Metadata } from "next";
import { TermsContent } from "./terms-content";

export const metadata: Metadata = {
  title: "Terms of Use / Nutzungsbedingungen",
  description: "Cascrow Terms of Use and Nutzungsbedingungen",
  robots: { index: false },
};

export default function TermsPage() {
  return <TermsContent />;
}
