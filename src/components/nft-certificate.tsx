"use client";

interface NftCertificateProps {
  tokenId: string;
  txHash: string;
  milestoneTitle: string;
  amountUSD: string;
  completedAt: string; // ISO string
}

function truncate(s: string, head = 8, tail = 6) {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

export function NftCertificate({
  tokenId,
  txHash,
  milestoneTitle,
  amountUSD,
  completedAt,
}: NftCertificateProps) {
  const explorerNft = `https://testnet.xrpl.org/nft/${tokenId}`;
  const explorerTx = `https://testnet.xrpl.org/transactions/${txHash}`;
  const date = new Date(completedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid rgba(212,184,150,0.35)",
        background: "linear-gradient(135deg, rgba(23,19,17,0.95) 0%, rgba(40,28,20,0.95) 50%, rgba(23,19,17,0.95) 100%)",
      }}
    >
      {/* Shimmer overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(105deg, transparent 30%, rgba(212,184,150,0.05) 50%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Top glow line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "linear-gradient(90deg, transparent, #D4B896, #C4704B, #D4B896, transparent)",
        }}
      />

      {/* Hex grid pattern (subtle) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath d='M14 0L28 8v16L14 32 0 24V8z' fill='none' stroke='%23D4B896' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "28px 49px",
        }}
      />

      <div style={{ position: "relative", padding: "24px 24px 20px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* XRPL hex icon */}
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path
                  d="M11 1L20 6v10l-9 5-9-5V6z"
                  fill="none"
                  stroke="#D4B896"
                  strokeWidth="1.2"
                />
                <path
                  d="M11 5L17 8.5v7L11 19 5 15.5v-7z"
                  fill="rgba(212,184,150,0.1)"
                  stroke="#C4704B"
                  strokeWidth="0.8"
                />
                <circle cx="11" cy="11" r="2" fill="#D4B896" />
              </svg>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#D4B896",
                }}
              >
                XRPL Certificate
              </span>
            </div>
            <span
              style={{
                fontSize: 13,
                color: "#EDE6DD",
                fontWeight: 500,
                maxWidth: 260,
                lineHeight: 1.4,
              }}
            >
              {milestoneTitle}
            </span>
          </div>

          {/* Amount badge */}
          <div
            style={{
              flexShrink: 0,
              padding: "6px 12px",
              borderRadius: 10,
              background: "rgba(196,112,75,0.15)",
              border: "1px solid rgba(196,112,75,0.3)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "#C4704B", lineHeight: 1.1 }}>
              ${Number(amountUSD).toLocaleString()}
            </div>
            <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#A89B8C", marginTop: 2 }}>
              RLUSD
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(212,184,150,0.2), transparent)",
            marginBottom: 16,
          }}
        />

        {/* NFT details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A89B8C" }}>
              Token ID
            </span>
            <a
              href={explorerNft}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "#D4B896",
                textDecoration: "none",
                borderBottom: "1px solid rgba(212,184,150,0.3)",
                paddingBottom: 1,
              }}
            >
              {truncate(tokenId, 10, 8)}
            </a>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A89B8C" }}>
              Minted
            </span>
            <span style={{ fontSize: 11, color: "#EDE6DD" }}>{date}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A89B8C" }}>
              Ledger
            </span>
            <span style={{ fontSize: 11, color: "#EDE6DD" }}>XRPL Testnet</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid rgba(212,184,150,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 10, color: "#A89B8C", letterSpacing: "0.08em" }}>
            Non-transferable · Permanent record
          </span>
          <div style={{ display: "flex", gap: 12 }}>
            <a
              href={explorerTx}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 10,
                color: "#C4704B",
                textDecoration: "none",
                letterSpacing: "0.08em",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Tx ↗
            </a>
            <a
              href={explorerNft}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 10,
                color: "#C4704B",
                textDecoration: "none",
                letterSpacing: "0.08em",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View NFT ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
