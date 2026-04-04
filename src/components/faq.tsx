"use client";

import { useState } from "react";

const ITEMS = [
  {
    q: "Who controls the funds?",
    a: "No one — the smart contract does. Once the grant giver funds the milestone, the RLUSD is locked on-chain and can only be released by the contract logic itself. Neither the grant giver nor Cascrow can withdraw funds arbitrarily.",
  },
  {
    q: "What happens if the AI rejects my proof?",
    a: "You'll receive an email with the AI's reasoning explaining exactly why it was rejected. You can then revise your proof documents and resubmit — there's no limit on resubmission attempts before the deadline.",
  },
  {
    q: "What types of proof does the AI accept?",
    a: "Claude AI can read PDFs, Word documents, spreadsheets, and analyze images (screenshots, charts, photos). You can upload multiple files at once to strengthen your case.",
  },
  {
    q: "Can the grant giver cancel the contract after funding?",
    a: "Not arbitrarily. Contracts have a defined deadline (cancelAfter date). If the receiver doesn't submit proof before the deadline, the grant giver can reclaim the funds. Before that date, the funds remain locked.",
  },
  {
    q: "Is RLUSD a real currency? What's the exchange rate?",
    a: "RLUSD is a USD-pegged stablecoin issued by Ripple. 1 RLUSD = $1 USD, with no volatility risk. On the testnet, RLUSD has no real monetary value — it's used for development and testing purposes only.",
  },
  {
    q: "What happens if the AI is unsure about my proof?",
    a: "If Claude AI's confidence is below a threshold, the milestone moves to a 'Pending Review' state and the grant giver is notified to make a manual decision. This ensures edge cases are handled fairly.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="flex flex-col divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      {ITEMS.map((item, i) => (
        <div key={i} className="py-5">
          <button
            className="w-full flex items-center justify-between text-left gap-4 group"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span
              className="font-semibold text-base transition-colors"
              style={{ color: open === i ? "#C1654A" : "#F0EDE8" }}
            >
              {item.q}
            </span>
            <span
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold transition-all"
              style={{
                background: open === i ? "rgba(193,101,74,0.15)" : "rgba(255,255,255,0.05)",
                color: open === i ? "#C1654A" : "#6B7280",
                transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
              }}
            >
              +
            </span>
          </button>

          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: open === i ? "200px" : "0px", opacity: open === i ? 1 : 0 }}
          >
            <p className="pt-4 text-sm leading-relaxed pr-10" style={{ color: "#9CA3AF" }}>
              {item.a}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
