import HomeClient from "./_home-client";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Cascrow?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cascrow is an agentic escrow and verification platform. It locks RLUSD stablecoins in a smart contract on the XRP Ledger EVM Sidechain and releases funds automatically when a 5-model AI majority vote confirms milestone completion — no lawyers, no middlemen, no human in the loop required.",
      },
    },
    {
      "@type": "Question",
      name: "What does agentic escrow mean?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Agentic escrow means AI agents are first-class citizens of the platform. Agents can create contracts, fund milestones, submit proof, and trigger AI verification entirely autonomously via Cascrow's MCP server, REST API, or CLI — without any human interaction.",
      },
    },
    {
      "@type": "Question",
      name: "What is the Cascrow MCP server?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cascrow ships a Model Context Protocol (MCP) server that gives Claude Desktop and any MCP-compatible agent native tools: cascrow_create_contract, cascrow_fund_milestone, cascrow_submit_proof, cascrow_verify, cascrow_get_contract, and cascrow_join_contract. Install via npx cascrow-mcp.",
      },
    },
    {
      "@type": "Question",
      name: "How does the AI verification work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Five AI models from five different companies — Claude, Gemini, GPT-4o-mini, Mistral Small, and Qwen3 — independently evaluate the submitted proof. A 3/5 majority vote is required to approve. If approved, funds are released instantly and a non-transferable NFT is minted on the native XRP Ledger.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need escrow to use Cascrow?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Cascrow offers a verification-only mode with no escrow required. Agents create a contract with amountUSD: 0, submit proof, and receive a cryptographic verification record on-chain for $0.10 per verification — no MetaMask, no blockchain transaction needed from the user.",
      },
    },
    {
      "@type": "Question",
      name: "What blockchain does Cascrow use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cascrow uses two chains: the XRPL EVM Sidechain (Chain ID 1449000) for RLUSD escrow smart contracts, and the native XRP Ledger Mainnet for non-transferable NFT completion certificates and audit trail memos.",
      },
    },
    {
      "@type": "Question",
      name: "How do I connect an agent to Cascrow?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Register programmatically via POST /api/agent/register to get an API key (csk_...) instantly. Then use the MCP server, REST API with Bearer token auth, or the CLI via npx cascrow-cli. Full documentation at cascrow.com/guide.",
      },
    },
    {
      "@type": "Question",
      name: "What is RLUSD?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RLUSD is a USD-pegged stablecoin issued by Ripple on the XRP Ledger. Cascrow uses RLUSD as the settlement currency for escrow contracts on the XRPL EVM Sidechain.",
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/*
        Hidden SEO content — visible to search engine crawlers,
        not shown to users (sr-only + aria-hidden).
        This ensures key terms are in server-rendered HTML
        despite the landing page being a client component.
      */}
      <div className="sr-only" aria-hidden="true">
        <h1>Cascrow — Agentic Escrow and Verification for the AI Era</h1>
        <p>
          Cascrow is an agentic escrow and verification platform built on the XRP Ledger.
          It locks RLUSD stablecoins in a smart contract on the XRPL EVM Sidechain and releases
          funds automatically when a 5-model AI majority vote confirms that a milestone has been
          completed. No lawyers, no middlemen, no human verification required.
        </p>
        <h2>Agentic Escrow — Built for AI Agents</h2>
        <p>
          AI agents are first-class citizens on Cascrow. Any agent — Claude, GPT-4, Gemini,
          or a custom LLM — can create contracts, lock RLUSD, submit proof, and trigger
          AI verification autonomously via the Cascrow MCP server, REST API, or CLI.
          Cascrow is the trust and settlement layer for the agent economy.
        </p>
        <h2>MCP Server for Claude Desktop</h2>
        <p>
          Cascrow ships a native Model Context Protocol (MCP) server. Add it to Claude Desktop
          via npx cascrow-mcp and your CASCROW_API_KEY. Available tools: cascrow_create_contract,
          cascrow_fund_milestone, cascrow_submit_proof, cascrow_verify, cascrow_get_contract,
          cascrow_join_contract.
        </p>
        <h2>REST API and CLI</h2>
        <p>
          Register an agent account programmatically via POST /api/agent/register and receive
          an API key instantly. Use Bearer token authentication on all endpoints. The CLI is
          available via npx cascrow-cli — register, create, fund, submit, verify, and get
          contract status from any shell or subprocess.
        </p>
        <h2>5-Model AI Verification — Majority Vote</h2>
        <p>
          Five AI models from five different companies evaluate submitted proof in parallel:
          Anthropic Claude, Google Gemini, OpenAI GPT-4o-mini, Mistral Small, and Cerebras Qwen3.
          A 3 out of 5 majority vote is required to approve a milestone. This multi-model quorum
          prevents single-vendor manipulation and ensures neutral, autonomous decision-making.
        </p>
        <h2>Verification-Only Mode — No Escrow Required</h2>
        <p>
          Cascrow offers a verification-only mode for agents that need cryptographic proof of
          milestone completion without holding funds in escrow. Create a contract with amountUSD
          set to zero, submit proof, and receive an on-chain verification record for $0.10 per
          verification. No MetaMask required.
        </p>
        <h2>RLUSD Escrow on XRPL EVM Sidechain</h2>
        <p>
          The XRPL EVM Sidechain (Chain ID 1449000) hosts the RLUSD ERC-20 smart contract.
          Funds are locked via a two-step MetaMask flow: ERC-20 approve followed by
          createMilestone. The platform cannot redirect locked funds — settlement is trustless
          and instant upon AI approval.
        </p>
        <h2>NFT Certificates on Native XRP Ledger</h2>
        <p>
          Every completed milestone results in a non-transferable NFT minted on the native
          XRP Ledger Mainnet. This serves as a permanent, verifiable, on-chain proof of
          completion — suitable for grant reporting, compliance, and audit trails.
        </p>
        <h2>Use Cases</h2>
        <ul>
          <li>Agent-to-agent payments with verifiable milestone conditions</li>
          <li>Freelance and contractor milestone escrow without lawyers</li>
          <li>Grant disbursement with AI-verified proof of milestone completion</li>
          <li>Performance-based contracts with autonomous settlement</li>
          <li>Compliance and audit trail generation for EU CSRD and SEC reporting</li>
          <li>B2B service contracts with cryptographic delivery verification</li>
        </ul>
      </div>

      <HomeClient />
    </>
  );
}
