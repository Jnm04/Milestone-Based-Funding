interface LogoProps {
  /** "full" = bars + name + tagline, "nav" = bars + name inline, "mark" = bars only */
  variant?: "full" | "nav" | "mark";
  className?: string;
}

export function Logo({ variant = "nav", className = "" }: LogoProps) {
  const Bars = () => (
    <div className="flex flex-col" style={{ gap: "7px" }}>
      <div style={{ width: 32, height: 4, borderRadius: 3, background: "#C4704B", opacity: 1 }} />
      <div style={{ width: 32, height: 4, borderRadius: 3, background: "#C4704B", opacity: 0.55, marginLeft: 6 }} />
      <div style={{ width: 32, height: 4, borderRadius: 3, background: "#C4704B", opacity: 0.22, marginLeft: 12 }} />
    </div>
  );

  if (variant === "mark") return <Bars />;

  if (variant === "nav") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Bars />
        <span
          style={{
            fontFamily: "var(--font-libre-franklin), sans-serif",
            fontWeight: 300,
            fontSize: 20,
            color: "#EDE6DD",
            letterSpacing: "5px",
            lineHeight: 1,
          }}
        >
          cascrow
        </span>
      </div>
    );
  }

  /* full */
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <Bars />
      <div className="flex flex-col items-center gap-1">
        <span
          style={{
            fontFamily: "var(--font-libre-franklin), sans-serif",
            fontWeight: 300,
            fontSize: 28,
            color: "#EDE6DD",
            letterSpacing: "6px",
            lineHeight: 1,
          }}
        >
          cascrow
        </span>
        <span
          style={{
            fontFamily: "var(--font-libre-franklin), sans-serif",
            fontWeight: 300,
            fontSize: 10,
            color: "#A89B8C",
            letterSpacing: "3px",
          }}
        >
          proof unlocks funds
        </span>
      </div>
    </div>
  );
}
