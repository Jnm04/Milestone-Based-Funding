"use client";

import { useEffect } from "react";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[profile/error]", error);
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
        Could not load your profile.
      </p>
      <p style={{ color: "#A89B8C", fontSize: 13, margin: 0 }}>
        Your account data is unchanged — this is a display error.
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
        Reload
      </button>
    </div>
  );
}
