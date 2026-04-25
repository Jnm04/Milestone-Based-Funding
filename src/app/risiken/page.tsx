import type { Metadata } from "next";
import { RisikenContent } from "./risiken-content";

export const metadata: Metadata = {
  title: "Risikohinweise / Risk Disclosure",
  description: "Cascrow Risikohinweise für Smart Contracts, Blockchain, KI-Verifikation und regulatorische Risiken",
};

export default function RisikenPage() {
  return <RisikenContent />;
}
