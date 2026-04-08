"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    status: "Draft",
    statusColor: "#6B7280",
    icon: "📄",
    title: "Contract created",
    desc: "Grant Giver defined milestone: MVP Launch Proof",
    amount: "5,000 RLUSD",
    progress: 0,
  },
  {
    status: "Funded",
    statusColor: "#C1654A",
    icon: "🔐",
    title: "Milestone funded",
    desc: "5,000 RLUSD locked in smart contract via MetaMask",
    amount: "5,000 RLUSD",
    progress: 25,
  },
  {
    status: "Proof submitted",
    statusColor: "#3B82F6",
    icon: "📤",
    title: "Proof uploaded",
    desc: 'Receiver uploaded "mvp_launch_report.pdf"',
    amount: "5,000 RLUSD",
    progress: 50,
  },
  {
    status: "AI Verifying…",
    statusColor: "#8B5CF6",
    icon: "🤖",
    title: "Claude AI analyzing",
    desc: "Reading document, checking milestone criteria…",
    amount: "5,000 RLUSD",
    progress: 75,
  },
  {
    status: "Completed ✓",
    statusColor: "#10B981",
    icon: "🎉",
    title: "Milestone verified!",
    desc: "5,000 RLUSD released to Receiver wallet instantly",
    amount: "5,000 RLUSD",
    progress: 100,
  },
];

export function ContractDemo() {
  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setStep((s) => (s + 1) % STEPS.length);
        setFading(false);
      }, 350);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const s = STEPS[step];

  return (
    <div
      className="relative rounded-2xl border overflow-hidden w-full max-w-sm mx-auto"
      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <span className="text-xs font-semibold text-white">Cascrow · Contract</span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all duration-300"
          style={{ background: `${s.statusColor}20`, color: s.statusColor, opacity: fading ? 0 : 1 }}
        >
          ● {s.status}
        </span>
      </div>

      {/* Body */}
      <div
        className="px-5 py-5 flex flex-col gap-4 transition-all duration-300"
        style={{ opacity: fading ? 0 : 1, transform: fading ? "translateY(6px)" : "translateY(0)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{s.icon}</span>
          <div>
            <p className="text-sm font-semibold text-white">{s.title}</p>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{s.desc}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "#6B7280" }}>Amount locked</span>
          <span className="text-sm font-bold text-white">{s.amount}</span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs mb-1.5" style={{ color: "#6B7280" }}>
            <span>Progress</span>
            <span style={{ color: s.statusColor }}>{s.progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${s.progress}%`, background: `linear-gradient(90deg, #C1654A, ${s.statusColor})` }}
            />
          </div>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 pt-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? "20px" : "6px",
                height: "6px",
                background: i === step ? "#C1654A" : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
