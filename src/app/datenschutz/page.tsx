import type { Metadata } from "next";
import { PrivacyContent } from "./privacy-content";

export const metadata: Metadata = {
  title: "Privacy Policy / Datenschutzerklärung",
  description: "Cascrow Privacy Policy and Datenschutzerklärung (GDPR / DSGVO)",
};

export default function DatenschutzPage() {
  return <PrivacyContent />;
}
