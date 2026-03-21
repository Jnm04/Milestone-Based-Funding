"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WalletConnectProps {
  onConnected: (address: string) => void;
  role: "INVESTOR" | "STARTUP";
}

export function WalletConnect({ onConnected, role }: WalletConnectProps) {
  const [step, setStep] = useState<"idle" | "qr" | "polling" | "done">("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [qrPng, setQrPng] = useState<string | null>(null);

  async function handleConnect() {
    setStep("qr");
    try {
      const res = await fetch("/api/auth/xumm-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create sign request");
      }

      const { uuid, qrPng: qr } = await res.json();
      setQrPng(qr);
      setStep("polling");

      // Poll until user signs or rejects (max 5 min)
      const deadline = Date.now() + 5 * 60 * 1000;
      const interval = setInterval(async () => {
        if (Date.now() > deadline) {
          clearInterval(interval);
          setStep("idle");
          toast.error("Sign request expired. Please try again.");
          return;
        }

        try {
          const poll = await fetch(`/api/auth/xumm-result?uuid=${uuid}`);
          if (!poll.ok) return; // transient error — keep polling

          const data = await poll.json();

          if (data.signed && data.address) {
            clearInterval(interval);
            setAddress(data.address);
            setStep("done");
            onConnected(data.address);
            toast.success(`Wallet connected: ${data.address.slice(0, 8)}…`);
          } else if (data.resolved && !data.signed) {
            // User explicitly rejected in Xaman
            clearInterval(interval);
            setStep("idle");
            setQrPng(null);
            toast.error("Connection rejected in Xaman.");
          }
          // else: not resolved yet → keep polling
        } catch {
          // network hiccup — keep polling
        }
      }, 2000);
    } catch (err) {
      setStep("idle");
      toast.error(err instanceof Error ? err.message : "Could not connect wallet.");
      console.error(err);
    }
  }

  if (step === "done" && address) {
    return (
      <div className="flex items-center gap-3 rounded-lg border px-4 py-3 bg-green-50 border-green-200">
        <span className="text-green-700 font-medium text-sm">Wallet connected</span>
        <code className="text-xs text-green-600 font-mono">
          {address.slice(0, 8)}…{address.slice(-6)}
        </code>
      </div>
    );
  }

  if ((step === "qr" || step === "polling") && qrPng) {
    return (
      <div className="flex flex-col items-center gap-4 p-5 border rounded-xl bg-white">
        <p className="text-sm font-medium text-gray-700">
          Scan with Xaman to connect your wallet
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrPng} alt="Xumm QR code" className="w-48 h-48 rounded-lg border" />
        <p className="text-xs text-gray-500 animate-pulse">Waiting for Xaman…</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setStep("idle"); setQrPng(null); }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  // Loading state before QR arrives
  if (step === "qr") {
    return (
      <Button disabled size="lg" className="w-full">
        Opening Xaman…
      </Button>
    );
  }

  return (
    <Button onClick={handleConnect} size="lg" className="w-full">
      Connect Xaman Wallet
    </Button>
  );
}
