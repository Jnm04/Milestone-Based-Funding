"use client";

import { useEffect, useRef, useState } from "react";

interface CounterStatProps {
  value: string;
  label: string;
}

function parseTarget(value: string): { prefix: string; num: number; suffix: string } {
  const match = value.match(/^([^0-9]*)(\d+)([^0-9]*)$/);
  if (!match) return { prefix: "", num: 0, suffix: value };
  return { prefix: match[1], num: parseInt(match[2]), suffix: match[3] };
}

export function CounterStat({ value, label }: CounterStatProps) {
  const { prefix, num, suffix } = parseTarget(value);
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1400;
          const start = performance.now();
          const animate = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(Math.round(eased * num));
            if (t < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [num]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <span className="text-4xl md:text-5xl font-black tabular-nums" style={{ color: "#C1654A" }}>
        {prefix}{display}{suffix}
      </span>
      <span className="text-sm" style={{ color: "#6B7280" }}>{label}</span>
    </div>
  );
}
