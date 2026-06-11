interface LogoProps {
  /** "full" = icon + name + tagline, "nav" = icon + name inline, "mark" = icon only */
  variant?: "full" | "nav" | "mark";
  className?: string;
  /** Icon color — defaults to copper #C4704B */
  color?: string;
}

export function CascrowIcon({ size = 32, color = "#C4704B" }: { size?: number; color?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        fill={color}
        d="M 28,68 A 35.5,35.5 0 0,1 80,20 L 68.6,32.7 A 18.5,18.5 0 0,0 41.6,57.7 Z"
      />
      <path
        fill={color}
        d="M 72,32 A 35.5,35.5 0 0,1 20,80 L 31.4,67.3 A 18.5,18.5 0 0,0 58.4,42.3 Z"
      />
    </svg>
  );
}

export function Logo({ variant = "nav", className = "", color = "#C4704B" }: LogoProps) {
  if (variant === "mark") return <CascrowIcon size={32} color={color} />;

  if (variant === "nav") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <CascrowIcon size={28} color={color} />
        <span
          style={{
            fontFamily: "var(--font-inter-tight), sans-serif",
            fontWeight: 600,
            fontSize: 17,
            color: "#EDE6DD",
            letterSpacing: "0.01em",
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
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <CascrowIcon size={52} color={color} />
      <div className="flex flex-col items-center gap-1">
        <span
          style={{
            fontFamily: "var(--font-inter-tight), sans-serif",
            fontWeight: 600,
            fontSize: 28,
            color: "#EDE6DD",
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          cascrow
        </span>
        <span
          style={{
            fontFamily: "var(--font-inter-tight), sans-serif",
            fontWeight: 400,
            fontSize: 10,
            color: "#A89B8C",
            letterSpacing: "3px",
            textTransform: "uppercase",
          }}
        >
          proof unlocks funds
        </span>
      </div>
    </div>
  );
}
