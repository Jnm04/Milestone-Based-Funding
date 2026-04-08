"use client";

import { useState, useRef, useEffect } from "react";

const ITEMS = [
  {
    q: "Who controls the funds?",
    a: "No one — the smart contract does. Once the Grant Giver funds the milestone, RLUSD is locked in a smart contract on the XRPL EVM Sidechain. Neither the Grant Giver nor Cascrow can withdraw funds arbitrarily. Only the contract logic itself can release them.",
  },
  {
    q: "Which wallet do I need?",
    a: "MetaMask or any EVM-compatible wallet. Cascrow runs on the XRPL EVM Sidechain, so you sign transactions directly in your browser — no mobile app required. Your private keys never leave your wallet.",
  },
  {
    q: "How does AI verification work?",
    a: "When you upload your proof PDF, five independent AI models — Claude, Gemini, OpenAI, Mistral and Qwen — each evaluate it against the agreed milestone criteria. A confidence score above 85% triggers automatic approval. Below 60% triggers automatic rejection. In between, the Grant Giver is notified to make a manual decision.",
  },
  {
    q: "What types of proof does the AI accept?",
    a: "Cascrow currently accepts PDF documents. You can include screenshots, data exports, reports, and charts — anything packaged into a single PDF. The richer and more specific the evidence, the higher the AI's confidence score.",
  },
  {
    q: "What happens if the AI rejects my proof?",
    a: "You'll see the AI's detailed reasoning directly on the contract page. You can revise your proof and resubmit — there's no limit on resubmission attempts before the deadline. If you believe the verdict is incorrect, the Grant Giver can also override it manually.",
  },
  {
    q: "Can the Grant Giver cancel after funding?",
    a: "Not before the deadline. Once funds are locked in escrow they stay locked — until either the milestone is verified or the deadline passes. If no proof is submitted in time, the Grant Giver can reclaim the RLUSD automatically.",
  },
  {
    q: "What is RLUSD and is it safe?",
    a: "RLUSD is a USD-pegged stablecoin issued by Ripple. 1 RLUSD = $1 USD, no volatility risk. It runs as an ERC-20 token on the XRPL EVM Sidechain, backed by USD deposits and US Treasuries with monthly third-party reserve attestations. On testnet, RLUSD carries no real monetary value.",
  },
  {
    q: "Where does each chain fit in?",
    a: "Cascrow uses two chains for different jobs. The XRPL EVM Sidechain handles all the money logic: RLUSD (as an ERC-20 token) is locked here, milestone payouts are triggered here, and MetaMask is the wallet you use for every signing step. The native XRP Ledger is used for transparency and proof: every escrow event (fund, release, cancel) is written as an immutable memo on-chain, and completed milestones receive an NFT certificate minted on the XRPL as permanent, verifiable proof of delivery.",
  },
  {
    q: "What is the dual audit trail?",
    a: "Every escrow action — create, release, cancel — executes on the XRPL EVM Sidechain and is simultaneously written as an immutable memo on the native XRP Ledger. Your contract history is verifiable on two independent chains at the same time.",
  },
];

function FAQItem({ item, index, isOpen, onToggle }: {
  item: { q: string; a: string };
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (bodyRef.current) {
      setHeight(isOpen ? bodyRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  return (
    <div
      style={{
        borderBottom: "1px solid rgba(196,112,75,0.1)",
        transition: "border-color 0.3s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left accent bar — grows on hover/open */}
      <div
        style={{
          position:   "absolute",
          left:       0,
          top:        0,
          bottom:     0,
          width:      2,
          background: "linear-gradient(180deg, #C4704B, rgba(196,112,75,0.2))",
          opacity:    isOpen ? 1 : hovered ? 0.6 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Hover glow */}
      <div
        style={{
          position:       "absolute",
          inset:          0,
          background:     "radial-gradient(ellipse 60% 100% at 0% 50%, rgba(196,112,75,0.04) 0%, transparent 70%)",
          opacity:        hovered || isOpen ? 1 : 0,
          transition:     "opacity 0.4s ease",
          pointerEvents:  "none",
        }}
      />

      <button
        className="w-full text-left"
        onClick={onToggle}
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            16,
          padding:        "22px 24px 22px 20px",
          cursor:         "pointer",
          background:     "transparent",
          border:         "none",
          width:          "100%",
        }}
        aria-expanded={isOpen}
      >
        {/* Index number */}
        <span
          style={{
            fontFamily:    "var(--font-libre-franklin), sans-serif",
            fontWeight:    300,
            fontSize:      12,
            color:         isOpen || hovered ? "#C4704B" : "rgba(168,155,140,0.5)",
            letterSpacing: "0.1em",
            minWidth:      24,
            transition:    "color 0.3s ease",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Question */}
        <span
          style={{
            flex:          1,
            fontFamily:    "var(--font-libre-franklin), sans-serif",
            fontWeight:    isOpen ? 500 : 400,
            fontSize:      15,
            color:         isOpen ? "#EDE6DD" : hovered ? "#EDE6DD" : "#C8BEB4",
            transition:    "color 0.3s ease, font-weight 0.2s ease",
            textAlign:     "left",
          }}
        >
          {item.q}
        </span>

        {/* Toggle icon */}
        <div
          style={{
            width:      28,
            height:     28,
            borderRadius: "50%",
            display:    "flex",
            alignItems: "center",
            justifyContent: "center",
            border:     `1px solid ${isOpen ? "#C4704B" : hovered ? "rgba(196,112,75,0.4)" : "rgba(196,112,75,0.15)"}`,
            background: isOpen ? "rgba(196,112,75,0.12)" : hovered ? "rgba(196,112,75,0.06)" : "transparent",
            transform:  isOpen ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform 0.35s cubic-bezier(0.22,1,0.36,1), background 0.3s ease, border-color 0.3s ease",
            flexShrink: 0,
            color:      isOpen ? "#C4704B" : hovered ? "rgba(196,112,75,0.8)" : "rgba(168,155,140,0.5)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5"  y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </button>

      {/* Collapsible answer */}
      <div
        style={{
          height:     height,
          overflow:   "hidden",
          transition: "height 0.4s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div ref={bodyRef}>
          <p
            style={{
              padding:     "0 24px 22px 52px",
              fontSize:    14,
              lineHeight:  1.75,
              color:       "#A89B8C",
              fontWeight:  300,
            }}
          >
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {ITEMS.map((item, i) => (
        <FAQItem
          key={i}
          item={item}
          index={i}
          isOpen={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
        />
      ))}
    </div>
  );
}
