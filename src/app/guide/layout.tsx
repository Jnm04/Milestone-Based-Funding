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

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      {children}
    </>
  );
}
