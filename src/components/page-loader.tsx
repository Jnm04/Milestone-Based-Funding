"use client";

import { LoaderDotMatrix } from "@/components/elements/loader-dot-matrix";

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "hsl(24 14% 4%)" }}>
      <style>{`[data-slot="loader-dot-matrix"] span.rounded-full { background-color: hsl(22 55% 54%) !important; }`}</style>
      <LoaderDotMatrix rows={4} cols={6} pattern="ripple" dotSize={4} />
      {label && (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: "hsl(30 10% 50%)" }}>
          {label}
        </span>
      )}
    </div>
  );
}
