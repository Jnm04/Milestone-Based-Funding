"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface BuyRlusdModalProps {
  walletAddress: string;
  defaultAmount?: number;
}

export function BuyRlusdModal({ walletAddress, defaultAmount = 100 }: BuyRlusdModalProps) {
  const [open, setOpen] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_ONRAMPER_API_KEY;

  const params = new URLSearchParams({
    ...(apiKey ? { apiKey } : {}),
    defaultCrypto: "USDC",
    defaultNetwork: "polygon",
    walletAddress,
    defaultAmount: String(defaultAmount),
    darkMode: "true",
    primaryColor: "C1654A",
    hidePaymentMethods: "false",
  });

  const iframeSrc = `https://widget.onramper.com?${params.toString()}`;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="w-full font-semibold"
      >
        💳 Buy RLUSD with card
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        >
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#1a1714" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div>
                <p className="font-bold text-white text-sm">Buy RLUSD</p>
                <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                  Powered by Onramper
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                ✕
              </button>
            </div>

            {apiKey ? (
              <iframe
                src={iframeSrc}
                className="w-full"
                style={{ height: "620px", border: "none" }}
                allow="camera;microphone;payment"
                title="Buy RLUSD"
              />
            ) : (
              <div className="flex flex-col items-center gap-5 px-8 py-12 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ background: "rgba(193,101,74,0.15)" }}>
                  🔑
                </div>
                <div>
                  <p className="font-bold text-white mb-2">API Key missing</p>
                  <p className="text-sm" style={{ color: "#9CA3AF" }}>
                    Add your Onramper API key in{" "}
                    <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)" }}>
                      .env.local
                    </code>{" "}
                    ein:
                  </p>
                </div>
                <div className="w-full rounded-xl p-4 text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-xs font-mono" style={{ color: "#C1654A" }}>
                    NEXT_PUBLIC_ONRAMPER_API_KEY=your-key-here
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="w-full">
                  Close
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
