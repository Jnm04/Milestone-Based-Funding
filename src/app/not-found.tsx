import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "hsl(24 14% 4%)" }}
    >
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-6">
        <div
          className="w-full flex flex-col items-center gap-5 p-8 rounded-2xl text-center"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(196,112,75,0.15)",
            borderTop: "1px solid rgba(196,112,75,0.4)",
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(196,112,75,0.1)",
              border: "1px solid rgba(196,112,75,0.25)",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <div className="flex flex-col gap-1">
            <h1
              className="text-4xl font-light tracking-tight"
              style={{ fontFamily: "var(--font-inter-tight), sans-serif", color: "hsl(32 35% 92%)" }}
            >
              404
            </h1>
            <p className="text-sm uppercase tracking-widest font-medium" style={{ color: "hsl(22 55% 54%)" }}>
              Page not found
            </p>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: "hsl(30 10% 62%)" }}>
            This page doesn&apos;t exist or the link may be outdated.
          </p>

          <div className="flex flex-col gap-2 w-full">
            <Link
              href="/dashboard/investor"
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-colors"
              style={{
                background: "rgba(196,112,75,0.15)",
                border: "1px solid rgba(196,112,75,0.3)",
                color: "hsl(22 55% 54%)",
              }}
            >
              Grant Giver Dashboard
            </Link>
            <Link
              href="/dashboard/startup"
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-colors"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(196,112,75,0.12)",
                color: "hsl(30 10% 62%)",
              }}
            >
              Receiver Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
