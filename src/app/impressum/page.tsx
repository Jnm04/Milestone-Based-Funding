import type { Metadata } from "next";
import { ImpressumContent } from "./impressum-content";

export const metadata: Metadata = {
  title: "Impressum / Legal Notice | cascrow",
  description: "Impressum gemäß § 5 TMG / Legal Notice pursuant to § 5 TMG — cascrow platform operator details.",
};

export default function ImpressumPage() {
  return <ImpressumContent />;
}
