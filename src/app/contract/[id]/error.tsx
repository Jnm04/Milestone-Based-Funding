"use client";

import { useEffect } from "react";

export default function ContractError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[contract/error]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <p style={{ color: "#EDE6DD", fontSize: 16, margin: 0, fontWeight: 600 }}>
        Something went wrong loading this contract.
      </p>
      <p style={{ color: "#A89B8C", fontSize: 13, margin: 0, maxWidth: 420 }}>
        If you were in the middle of a MetaMask transaction, check your wallet — the on-chain action may have succeeded even if this page errored.
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: "9px 22px",
          borderRadius: 99,
          background: "#C4704B",
          color: "#171311",
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        Try again
      </button>
    </div>
  );
}
