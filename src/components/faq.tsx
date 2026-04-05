"use client";

import { useState, useRef, useEffect } from "react";

const ITEMS = [
  {
    q: "Who controls the funds?",
    a: "No one — the smart contract does. Once the grant giver funds the milestone, the RLUSD is locked on-chain and can only be released by the contract logic itself. Neither the grant giver nor Cascrow can withdraw funds arbitrarily.",
  },
  {
    q: "What happens if the AI rejects my proof?",
    a: "You'll receive an email with the AI's reasoning explaining exactly why it was rejected. You can then revise your proof documents and resubmit — there's no limit on resubmission attempts before the deadline.",
  },
  {
    q: "What types of proof does the AI accept?",
    a: "Claude AI can read PDFs, Word documents, spreadsheets, and analyze images (screenshots, charts, photos). You can upload multiple files at once to strengthen your case.",
  },
  {
    q: "Can the grant giver cancel the contract after funding?",
    a: "Not arbitrarily. Contracts have a defined deadline (cancelAfter date). If the receiver doesn't submit proof before the deadline, the grant giver can reclaim the funds. Before that date, the funds remain locked.",
  },
  {
    q: "Is RLUSD a real currency? What's the exchange rate?",
    a: "RLUSD is a USD-pegged stablecoin issued by Ripple. 1 RLUSD = $1 USD, with no volatility risk. On the testnet, RLUSD has no real monetary value — it's used for development and testing purposes only.",
  },
  {
    q: "What happens if the AI is unsure about my proof?",
    a: "If Claude AI's confidence is below a threshold, the milestone moves to a 'Pending Review' state and the grant giver is notified to make a manual decision. This ensures edge cases are handled fairly.",
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
