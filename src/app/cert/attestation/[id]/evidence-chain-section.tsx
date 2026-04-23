"use client";

interface ChainData {
  step0: string;
  step1: string;
  step2: string;
  step3: string;
  promptHash: string;
  systemPromptVersion: string;
  chainRoot: string;
}

interface Props {
  entryId: string;
  chain: ChainData | null;
  xrplTxHash: string | null;
  fetchedAt: string;
}

function truncate(s: string) {
  return s.slice(0, 12) + "…" + s.slice(-8);
}

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://cascrow.com";

export function EvidenceChainSection({ entryId, chain, xrplTxHash, fetchedAt }: Props) {
  if (!chain) return null;

  function downloadVerificationPackage() {
    const pkg = {
      entryId,
      fetchedAt,
      xrplTxHash,
      chain: {
        step0: chain!.step0,
        step1: chain!.step1,
        step2: chain!.step2,
        step3: chain!.step3,
        chainRoot: chain!.chainRoot,
      },
      systemPromptVersion: chain!.systemPromptVersion,
      verifyUrl: `${BASE_URL}/api/attestation/verify-chain`,
      instructions:
        "POST rawContent + systemPrompt + userPrompt + aiResponse to verifyUrl to recompute the chain. Each SHA-256 step can also be verified locally.",
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cascrow-verification-${entryId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const steps = [
    { label: "Raw evidence hash", hash: chain.step0, step: "step0" },
    { label: "Prompt commitment", hash: chain.step1, step: "step1" },
    { label: "AI response commitment", hash: chain.step2, step: "step2" },
    { label: "On-chain anchor", hash: chain.step3, step: "step3" },
  ];

  return (
    <div>
      <p className="text-[#C4704B] text-xs uppercase tracking-wider mb-3">Evidence Chain Fingerprint</p>
      <div className="space-y-2 mb-4">
        {steps.map(({ label, hash }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-[#8B7355] text-xs w-44 shrink-0">{label}</span>
            <span className="font-mono text-xs text-[#8B7355] break-all">{truncate(hash)}</span>
          </div>
        ))}
      </div>
      <div className="mb-4">
        <p className="text-[#8B7355] text-xs uppercase tracking-wider mb-1">Chain Root</p>
        <p className="font-mono text-xs text-[#EDE6DD] break-all">{chain.chainRoot}</p>
      </div>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={downloadVerificationPackage}
          className="text-xs px-3 py-1.5 rounded border border-[#C4704B]/40 text-[#C4704B] hover:bg-[#C4704B]/10 transition-colors"
        >
          Download Verification Package ↓
        </button>
        <a
          href={`${BASE_URL}/api/attestation/verify-chain`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded border border-[#8B7355]/40 text-[#8B7355] hover:bg-[#8B7355]/10 transition-colors"
        >
          Verify Chain →
        </a>
      </div>
      <p className="text-[#5A4A3A] text-xs mt-2">
        Prompt version: {chain.systemPromptVersion}
      </p>
    </div>
  );
}
