import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "cascrow Enterprise — AI-Verified KPI Attestation",
    template: "%s | cascrow Enterprise",
  },
  description:
    "Corporate KPI attestation powered by AI and blockchain. CSRD compliance, ESG reporting, and internal goal tracking — verified, tamper-proof, audit-ready.",
};

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ent-root min-h-screen" style={{ fontFamily: "var(--font-libre-franklin), var(--font-geist-sans), sans-serif" }}>
      <style>{`
        .ent-root {
          --ent-bg:       #FAFAFA;
          --ent-bg-alt:   #F1F5F9;
          --ent-border:   #E2E8F0;
          --ent-text:     #0F172A;
          --ent-muted:    #64748B;
          --ent-accent:   #1D4ED8;
          --ent-accent-h: #1E40AF;
          --ent-success:  #059669;
          background: var(--ent-bg);
          color: var(--ent-text);
        }
      `}</style>
      {children}
    </div>
  );
}
