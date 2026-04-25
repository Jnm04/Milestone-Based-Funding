"use client";

import { useState } from "react";

interface MatrixItem {
  topic: string;
  financialScore: number;
  impactScore: number;
  material: boolean;
  esrsArticles: string[];
  griStandards: string[];
  rationale: string;
}

interface Props {
  matrix: MatrixItem[];
}

export function MaterialityMatrix({ matrix }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const W = 580, H = 460, PAD = 60;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  function toX(v: number) { return PAD + (v / 5) * plotW; }
  function toY(v: number) { return PAD + plotH - (v / 5) * plotH; }

  const material = matrix.filter((m) => m.material);
  const nonMaterial = matrix.filter((m) => !m.material);

  const hoveredItem = hovered ? matrix.find((m) => m.topic === hovered) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Scatter plot */}
      <div style={{ background: "white", border: "1px solid var(--ent-border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--ent-text)" }}>Double Materiality Matrix</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>CSRD double materiality — financial & impact dimensions. Hover dots for details.</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0, marginTop: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="#1D4ED8" /></svg>
              <span style={{ fontSize: 11, color: "var(--ent-muted)" }}>Material</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="#CBD5E1" /></svg>
              <span style={{ fontSize: 11, color: "var(--ent-muted)" }}>Non-material</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={20} height={10}><line x1={0} y1={5} x2={20} y2={5} stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4,2" /></svg>
              <span style={{ fontSize: 11, color: "var(--ent-muted)" }}>Threshold (≥3)</span>
            </div>
          </div>
        </div>

        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
          <defs>
            <filter id="mm-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx={0} dy={2} stdDeviation={3} floodColor="#0F172A" floodOpacity={0.12} />
            </filter>
          </defs>

          {/* Quadrant backgrounds */}
          <rect x={PAD} y={PAD} width={plotW / 2} height={plotH / 2} fill="#EFF6FF" />
          <rect x={PAD + plotW / 2} y={PAD} width={plotW / 2} height={plotH / 2} fill="#F0FDF4" />
          <rect x={PAD} y={PAD + plotH / 2} width={plotW / 2} height={plotH / 2} fill="#F8FAFC" />
          <rect x={PAD + plotW / 2} y={PAD + plotH / 2} width={plotW / 2} height={plotH / 2} fill="#FFFBEB" />

          {/* Quadrant labels */}
          <text x={PAD + 8} y={PAD + 16} fontSize={9} fontWeight={700} fill="#3B82F6" opacity={0.7} letterSpacing={0.8}>IMPACT</text>
          <text x={PAD + plotW - 8} y={PAD + 16} fontSize={9} fontWeight={700} fill="#16A34A" opacity={0.8} textAnchor="end" letterSpacing={0.8}>MATERIAL</text>
          <text x={PAD + 8} y={PAD + plotH - 8} fontSize={9} fontWeight={700} fill="#94A3B8" opacity={0.7} letterSpacing={0.8}>MONITOR</text>
          <text x={PAD + plotW - 8} y={PAD + plotH - 8} fontSize={9} fontWeight={700} fill="#D97706" opacity={0.7} textAnchor="end" letterSpacing={0.8}>FINANCIAL</text>

          {/* Grid lines */}
          {[1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={toX(i)} y1={PAD} x2={toX(i)} y2={PAD + plotH} stroke="#E2E8F0" strokeWidth={1} />
              <line x1={PAD} y1={toY(i)} x2={PAD + plotW} y2={toY(i)} stroke="#E2E8F0" strokeWidth={1} />
              <text x={toX(i)} y={PAD + plotH + 18} textAnchor="middle" fontSize={10} fill="#94A3B8">{i}</text>
              <text x={PAD - 10} y={toY(i) + 4} textAnchor="end" fontSize={10} fill="#94A3B8">{i}</text>
            </g>
          ))}
          <text x={toX(0)} y={PAD + plotH + 18} textAnchor="middle" fontSize={10} fill="#94A3B8">0</text>
          <text x={toX(5)} y={PAD + plotH + 18} textAnchor="middle" fontSize={10} fill="#94A3B8">5</text>
          <text x={PAD - 10} y={toY(0) + 4} textAnchor="end" fontSize={10} fill="#94A3B8">0</text>
          <text x={PAD - 10} y={toY(5) + 4} textAnchor="end" fontSize={10} fill="#94A3B8">5</text>

          {/* Threshold lines */}
          <line x1={toX(3)} y1={PAD - 6} x2={toX(3)} y2={PAD + plotH} stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.9} />
          <line x1={PAD} y1={toY(3)} x2={PAD + plotW + 6} y2={toY(3)} stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.9} />

          {/* Axis labels */}
          <text x={PAD + plotW / 2} y={H - 8} textAnchor="middle" fontSize={11.5} fontWeight={500} fill="#64748B">Financial Impact →</text>
          <text x={14} y={PAD + plotH / 2} textAnchor="middle" fontSize={11.5} fontWeight={500} fill="#64748B" transform={`rotate(-90, 14, ${PAD + plotH / 2})`}>↑ Environmental/Social Impact</text>

          {/* Non-material dots */}
          {nonMaterial.map((item, i) => (
            <circle key={`nm-${i}`} cx={toX(item.financialScore)} cy={toY(item.impactScore)}
              r={5} fill="#CBD5E1" stroke="white" strokeWidth={1.5}>
              <title>{item.topic} — Financial: {item.financialScore}, Impact: {item.impactScore}</title>
            </circle>
          ))}

          {/* Material dots */}
          {material.map((item, i) => {
            const cx = toX(item.financialScore);
            const cy = toY(item.impactScore);
            const isH = hovered === item.topic;
            return (
              <g key={`m-${i}`} style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(item.topic)}
                onMouseLeave={() => setHovered(null)}>
                <circle cx={cx} cy={cy} r={isH ? 16 : 12} fill="#1D4ED8" fillOpacity={0.1} />
                <circle cx={cx} cy={cy} r={isH ? 9 : 7} fill="#1D4ED8" stroke="white" strokeWidth={2} filter={isH ? "url(#mm-shadow)" : undefined} />
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hoveredItem && (() => {
            const cx = toX(hoveredItem.financialScore);
            const cy = toY(hoveredItem.impactScore);
            const label = hoveredItem.topic;
            const tw = Math.min(Math.max(label.length * 6.5 + 24, 120), 200);
            const th = 48;
            const tx = cx + 14 + tw > W ? cx - tw - 14 : cx + 14;
            const ty = cy - th / 2 < PAD ? PAD : cy + th / 2 > PAD + plotH ? PAD + plotH - th : cy - th / 2;
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect x={tx} y={ty} width={tw} height={th} rx={7} fill="white" stroke="#E2E8F0" strokeWidth={1} filter="url(#mm-shadow)" />
                <text x={tx + 10} y={ty + 17} fontSize={11} fontWeight={700} fill="#1E293B">
                  {label.length > 24 ? label.slice(0, 23) + "…" : label}
                </text>
                <text x={tx + 10} y={ty + 34} fontSize={10} fill="#64748B">
                  Financial: {hoveredItem.financialScore} · Impact: {hoveredItem.impactScore}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Material topics table */}
      {material.length > 0 && (
        <div>
          <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 14, color: "var(--ent-text)" }}>
            Material Topics <span style={{ fontWeight: 400, color: "var(--ent-muted)" }}>({material.length})</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...material]
              .sort((a, b) => (b.financialScore + b.impactScore) - (a.financialScore + a.impactScore))
              .map((item, i) => (
                <div key={i} style={{ padding: "14px 16px", borderRadius: 10, background: "white", border: "1px solid var(--ent-border)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 3px", fontWeight: 600, fontSize: 13.5, color: "var(--ent-text)" }}>{item.topic}</p>
                      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)", lineHeight: 1.5 }}>{item.rationale}</p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8" }}>F {item.financialScore}</span>
                      <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#F0FDF4", color: "#15803D" }}>I {item.impactScore}</span>
                    </div>
                  </div>
                  {(item.esrsArticles.length > 0 || item.griStandards.length > 0) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                      {item.esrsArticles.map((a) => (
                        <span key={a} style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500, background: "#DCFCE7", color: "#14532D" }}>{a}</span>
                      ))}
                      {item.griStandards.map((g) => (
                        <span key={g} style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500, background: "#EDE9FE", color: "#3B0764" }}>{g}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
