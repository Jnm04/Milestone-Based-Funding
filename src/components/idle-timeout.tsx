"use client";

import { useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function IdleTimeout() {
  const { status } = useSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActiveRef = useRef<number>(Date.now());

  useEffect(() => {
    if (status !== "authenticated") return;

    function logout() {
      signOut({ callbackUrl: "/login?reason=timeout" });
    }

    function reset() {
      lastActiveRef.current = Date.now();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logout, TIMEOUT_MS);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        // Check if idle period exceeded while tab was in background
        if (Date.now() - lastActiveRef.current >= TIMEOUT_MS) {
          logout();
        } else {
          reset();
        }
      }
    }

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    reset();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [status]);

  return null;
}
