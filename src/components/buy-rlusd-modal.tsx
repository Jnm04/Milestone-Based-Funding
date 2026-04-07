"use client";

import { useState } from "react";

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
      <button
        onClick={() => setOpen(true)}
        className="cs-btn-ghost cs-btn-sm"
        style={{ fontSize: 12 }}
      >
        Buy RLUSD
      </button>

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
                <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>Fiat on-ramp</p>
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
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(196,112,75,0.12)" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    <path d="M12 8v4M12 16h.01"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold mb-1" style={{ color: "#EDE6DD" }}>Coming soon</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
                    Fiat on-ramping is currently in development.<br />
                    Use testnet RLUSD for now.
                  </p>
                </div>
                <button onClick={() => setOpen(false)} className="cs-btn-ghost cs-btn-sm w-full">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
