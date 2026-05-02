"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ContractForm } from "@/components/contract-form";


function NewContractContent() {
  const params = useSearchParams();
  const { data: session } = useSession();
  const investorAddress = params.get("investor") ?? "";
  const isEnterprise = session?.user?.isEnterprise ?? false;

  if (!investorAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
          style={{ background: "hsl(22 55% 54% / 0.1)", border: "1px solid hsl(22 55% 54% / 0.2)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p style={{ color: "hsl(32 35% 92%)", fontFamily: "var(--font-inter-tight)", fontWeight: 300, fontSize: 20 }}>
          No wallet connected
        </p>
        <p style={{ color: "hsl(30 10% 62%)", fontSize: 14 }}>You need to connect a wallet before creating a contract.</p>
        <Link href="/dashboard/investor" className="cs-btn-primary cs-btn-sm mt-2">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-6 flex flex-col gap-8">

      {/* Breadcrumb */}
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard/investor"
          className="text-xs uppercase tracking-widest font-medium transition-colors"
          style={{ color: "hsl(22 55% 54%)" }}
        >
          ← Dashboard
        </Link>
        <h1
          className="mt-2 tracking-tight"
          style={{
            fontFamily: "var(--font-inter-tight), sans-serif",
            fontWeight: 300,
            fontSize: "clamp(28px, 5vw, 38px)",
            color: "hsl(32 35% 92%)",
          }}
        >
          New Contract
        </h1>
        <p className="text-sm mt-1" style={{ color: "hsl(30 10% 62%)" }}>
          Define the milestone criteria and lock RLUSD in escrow for the Builder.
        </p>
      </div>

      {/* Wallet chip */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{
          background: "hsl(22 55% 54% / 0.06)",
          border: "1px solid hsl(22 55% 54% / 0.2)",
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "hsl(22 55% 54% / 0.15)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V22H4V12" />
            <path d="M22 7H2v5h20V7z" />
            <path d="M12 22V7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs uppercase tracking-widest" style={{ color: "hsl(30 10% 62%)" }}>Requester Wallet</span>
          <code className="text-xs font-mono mt-0.5 truncate" style={{ color: "hsl(32 35% 92%)" }}>{investorAddress}</code>
        </div>
      </div>

      {/* Form card */}
      <div
        className="rounded-2xl p-8 flex flex-col gap-6"
        style={{
          background: "hsl(24 12% 6% / 0.5)",
          border: "1px solid hsl(22 55% 54% / 0.15)",
          borderTop: "1px solid hsl(22 55% 54%)",
        }}
      >
        <ContractForm investorAddress={investorAddress} isEnterprise={isEnterprise} />
      </div>
    </div>
  );
}

export default function NewContractPage() {
  return (
    <main className="min-h-screen" style={{ background: "hsl(24 14% 4%)", color: "hsl(32 35% 92%)" }}>

      {/* Nav */}
      <nav
        className="sticky top-0 z-40 border-b"
        style={{
          background: "hsl(24 14% 4% / 0.92)",
          backdropFilter: "blur(20px)",
          borderBottomColor: "hsl(22 55% 54% / 0.12)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>cascrow</span>
          </Link>
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest"
              style={{
                background: "hsl(22 55% 54% / 0.1)",
                border: "1px solid hsl(22 55% 54% / 0.3)",
                color: "hsl(22 55% 54%)",
              }}
            >
              Requester
            </span>
          </div>
        </div>
      </nav>

      <Suspense fallback={null}>
        <NewContractContent />
      </Suspense>
    </main>
  );
}
