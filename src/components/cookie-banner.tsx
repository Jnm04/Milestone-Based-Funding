"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "cascrow_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if user hasn't acknowledged yet
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "calc(100% - 40px)",
        maxWidth: 640,
        background: "rgba(30,26,24,0.97)",
        border: "1px solid rgba(196,112,75,0.3)",
        borderRadius: 14,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <p style={{ flex: 1, fontSize: 13, color: "#A89B8C", margin: 0, lineHeight: 1.5 }}>
        We use strictly necessary session cookies to keep you logged in. No tracking or advertising.{" "}
        <Link href="/datenschutz" style={{ color: "#C4704B", textDecoration: "underline" }}>
          Privacy policy
        </Link>
      </p>
      <button
        onClick={accept}
        style={{
          flexShrink: 0,
          padding: "7px 18px",
          borderRadius: 8,
          background: "#C4704B",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        Got it
      </button>
    </div>
  );
}
