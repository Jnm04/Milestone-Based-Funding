import type { Metadata } from "next";
import { AvvContent } from "./avv-content";

export const metadata: Metadata = {
  title: "Auftragsverarbeitungsvertrag (AVV) / Data Processing Agreement (DPA)",
  description: "Cascrow Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO / Data Processing Agreement pursuant to Art. 28 GDPR",
  robots: { index: false },
};

export default function AvvPage() {
  return <AvvContent />;
}
