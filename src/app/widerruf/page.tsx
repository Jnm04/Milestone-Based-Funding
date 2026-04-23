import type { Metadata } from "next";
import { WiderrufContent } from "./widerruf-content";

export const metadata: Metadata = {
  title: "Widerrufsbelehrung / Right of Withdrawal",
  description: "Cascrow Widerrufsbelehrung und Muster-Widerrufsformular gemäß § 312g BGB",
  robots: { index: false },
};

export default function WiderrufPage() {
  return <WiderrufContent />;
}
