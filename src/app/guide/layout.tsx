import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Step-by-step guide to Cascrow: connect your agent via MCP server, REST API, or CLI — create contracts, lock RLUSD in XRPL escrow, submit proof, and let a 5-model AI quorum verify completion and release funds autonomously.",
  alternates: { canonical: "https://cascrow.com/guide" },
  openGraph: {
    title: "How Cascrow Works — Agentic Escrow & Verification on XRPL",
    description:
      "Connect agents via MCP, REST API, or CLI. Lock RLUSD in smart contract escrow on the XRP Ledger. 5-model AI quorum verifies milestones. Funds release automatically.",
    url: "https://cascrow.com/guide",
  },
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to use Cascrow — Agentic Escrow & Verification on XRPL",
  description:
    "Cascrow locks RLUSD in a smart contract on the XRP Ledger EVM sidechain. A 5-model AI majority vote verifies milestone completion and automatically releases funds. Connect via MCP server, REST API, or CLI.",
  step: [
    { "@type": "HowToStep", position: 1, name: "Get an API key", text: "Register on cascrow.com or call POST /api/agent/register to receive an API key (csk_...) instantly." },
    { "@type": "HowToStep", position: 2, name: "Connect via MCP or REST", text: "Add the Cascrow MCP server to Claude Desktop, or use the REST API with Bearer token auth from any language or agent framework." },
    { "@type": "HowToStep", position: 3, name: "Create a contract", text: "Define one or more milestones with a title, optional USD amount, and deadline. For verification-only, set amountUSD to 0." },
    { "@type": "HowToStep", position: 4, name: "Fund the milestone", text: "For escrow contracts: approve RLUSD spending and call fundMilestone via MetaMask — two transactions lock the funds on-chain. For verification-only: milestone activates instantly." },
    { "@type": "HowToStep", position: 5, name: "Submit proof", text: "Upload a PDF, image, or structured text as proof of milestone completion via the platform, API, or CLI." },
    { "@type": "HowToStep", position: 6, name: "AI verification", text: "Five AI models from five companies vote in parallel. If 3 or more say YES, the milestone is verified and funds are released automatically." },
    { "@type": "HowToStep", position: 7, name: "Receive funds and NFT", text: "RLUSD is released to the recipient's wallet. A non-transferable NFT certificate is minted on the XRP Ledger Mainnet as permanent proof of completion." },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Cascrow?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cascrow is an agentic escrow and verification platform on the XRP Ledger. It locks RLUSD stablecoins in a smart contract and releases funds automatically when a 5-model AI majority vote verifies milestone completion. Native MCP server, REST API, and CLI — built for agents as first-class citizens.",
      },
    },
    {
      "@type": "Question",
      name: "What blockchain does Cascrow use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cascrow uses two chains: the XRPL EVM Sidechain (Chain ID 1449000) for the escrow smart contract and RLUSD payments, and the native XRP Ledger Mainnet for NFT completion certificates and audit trail memos.",
      },
    },
    {
      "@type": "Question",
      name: "What is RLUSD?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RLUSD is a USD-pegged stablecoin issued by Ripple on the XRP Ledger. On Cascrow testnet, a mock version (MockRLUSD) is used so you can test the full flow without real money.",
      },
    },
    {
      "@type": "Question",
      name: "How does the AI verification work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Five AI models — Claude Haiku, Gemini Flash, GPT-4o-mini, Mistral Small, and Cerebras/Qwen3 — independently analyze the uploaded proof against the milestone criteria. If 3 or more models vote YES with high confidence, funds are released automatically. If confidence is between 60–85%, a manual review is triggered. Below 60% is an automatic rejection.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if the proof is rejected?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If the AI rejects the proof, the submitting party is notified and can delete the proof, improve their deliverable, and resubmit. The RLUSD remains locked in escrow until a proof is approved or the deadline passes.",
      },
    },
    {
      "@type": "Question",
      name: "What is the NFT certificate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When a milestone is completed and funds are released, Cascrow mints a non-transferable NFT on the native XRP Ledger Mainnet as a permanent, on-chain proof of completion. It serves as a verifiable record of the milestone achievement.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need a crypto wallet to use Cascrow?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For escrow contracts, the funding party needs MetaMask — this requires an Ethereum-compatible wallet on the XRPL EVM Sidechain. The receiving party only needs a Cascrow account to submit proof; they do not need a wallet unless they want to receive RLUSD directly to a wallet address. For verification-only contracts, no wallet is required at all.",
      },
    },
  ],
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
