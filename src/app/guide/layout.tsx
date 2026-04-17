import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Step-by-step guide to Cascrow: lock RLUSD in XRPL escrow, upload milestone proof, and let AI automatically verify completion and release funds. No lawyers, no middlemen.",
  alternates: { canonical: "https://cascrow.com/guide" },
  openGraph: {
    title: "How Cascrow Works — AI-Powered Escrow on XRPL",
    description:
      "Lock RLUSD in smart contract escrow on the XRP Ledger. AI verifies milestone completion. Funds release automatically. Step-by-step setup guide.",
    url: "https://cascrow.com/guide",
  },
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to use Cascrow — AI-powered XRPL escrow",
  description:
    "Cascrow locks RLUSD in a smart contract on the XRP Ledger EVM sidechain. A 5-model AI majority vote verifies milestone completion and automatically releases funds to the startup.",
  step: [
    { "@type": "HowToStep", position: 1, name: "Install MetaMask", text: "Install the MetaMask browser extension and add the XRPL EVM Testnet (Chain ID 1449000)." },
    { "@type": "HowToStep", position: 2, name: "Get testnet RLUSD", text: "Get testnet XRP for gas fees and mint MockRLUSD tokens via the XRPL EVM faucet." },
    { "@type": "HowToStep", position: 3, name: "Register on Cascrow", text: "Create an account on cascrow.com and connect your MetaMask wallet." },
    { "@type": "HowToStep", position: 4, name: "Create a contract", text: "As Grant Giver (investor), define the milestone, amount in USD, and deadline." },
    { "@type": "HowToStep", position: 5, name: "Fund the escrow", text: "Approve RLUSD spending and call fundMilestone — two MetaMask transactions lock the funds on-chain." },
    { "@type": "HowToStep", position: 6, name: "Submit proof", text: "The Receiver (startup) uploads a PDF or links a GitHub repo as milestone proof." },
    { "@type": "HowToStep", position: 7, name: "AI verification", text: "Five AI models vote in parallel. If 3 or more say YES, funds are released automatically." },
    { "@type": "HowToStep", position: 8, name: "Receive funds", text: "RLUSD is transferred to the startup's wallet. An NFT certificate is minted on XRPL mainnet." },
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
        text: "Cascrow is an AI-powered escrow platform on the XRP Ledger. It locks RLUSD stablecoins in a smart contract and releases funds automatically when a 5-model AI majority vote verifies that the agreed milestone has been completed — no lawyers or middlemen required.",
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
        text: "If the AI rejects the proof, the startup is notified and can delete the proof, improve their deliverable, and resubmit. The RLUSD remains locked in escrow until a proof is approved or the deadline passes.",
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
        text: "The investor (Grant Giver) needs MetaMask to fund the escrow — this requires an Ethereum-compatible wallet on the XRPL EVM Sidechain. The startup (Receiver) only needs a Cascrow account to submit proof; they do not need a wallet unless they want to receive RLUSD directly to a wallet address.",
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
