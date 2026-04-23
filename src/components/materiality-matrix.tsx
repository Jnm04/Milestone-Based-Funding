"use client";

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

const QUADRANT_LABELS = [
  { x: 0, y: 0, label: "Monitor", color: "#94a3b8" },
  { x: 5, y: 0, label: "Manage", color: "#f59e0b" },
  { x: 0, y: 5, label: "Manage", color: "#f59e0b" },
  { x: 5, y: 5, label: "Prioritize", color: "#ef4444" },
];

export function MaterialityMatrix({ matrix }: Props) {
  const W = 480, H = 380, PAD = 48;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  function toX(v: number) { return PAD + (v / 5) * plotW; }
  function toY(v: number) { return PAD + plotH - (v / 5) * plotH; }

  const material = matrix.filter((m) => m.material);
  const nonMaterial = matrix.filter((m) => !m.material);

  return (
    <div className="space-y-8">
      {/* SVG Scatter Plot */}
      <div className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid var(--ent-border)" }}>
        <div className="p-4 pb-0">
          <p className="text-sm font-semibold" style={{ color: "var(--ent-text)" }}>Materiality Scatter Plot</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ent-muted)" }}>X = Financial Impact · Y = Environmental/Social Impact</p>
        </div>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* Quadrant backgrounds */}
          <rect x={PAD} y={PAD} width={plotW / 2} height={plotH / 2} fill="#f8fafc" />
          <rect x={PAD + plotW / 2} y={PAD} width={plotW / 2} height={plotH / 2} fill="#fff7ed" />
          <rect x={PAD} y={PAD + plotH / 2} width={plotW / 2} height={plotH / 2} fill="#fff7ed" />
          <rect x={PAD + plotW / 2} y={PAD + plotH / 2} width={plotW / 2} height={plotH / 2} fill="#fef2f2" />

          {/* Grid lines */}
          {[1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={toX(i)} y1={PAD} x2={toX(i)} y2={PAD + plotH} stroke="#e2e8f0" strokeWidth={1} />
              <line x1={PAD} y1={toY(i)} x2={PAD + plotW} y2={toY(i)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={toX(i)} y={PAD + plotH + 14} textAnchor="middle" fontSize={10} fill="#94a3b8">{i}</text>
              <text x={PAD - 8} y={toY(i) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{i}</text>
            </g>
          ))}

          {/* Threshold line */}
          <line x1={toX(3)} y1={PAD} x2={toX(3)} y2={PAD + plotH} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,3" />
          <line x1={PAD} y1={toY(3)} x2={PAD + plotW} y2={toY(3)} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,3" />

          {/* Axis labels */}
          <text x={PAD + plotW / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="#64748b">Financial Impact →</text>
          <text x={10} y={PAD + plotH / 2} textAnchor="middle" fontSize={11} fill="#64748b" transform={`rotate(-90, 10, ${PAD + plotH / 2})`}>↑ Environmental/Social Impact</text>

          {/* Non-material points */}
          {nonMaterial.map((item, i) => (
            <circle key={`nm-${i}`} cx={toX(item.financialScore)} cy={toY(item.impactScore)}
              r={5} fill="#cbd5e1" fillOpacity={0.8} stroke="white" strokeWidth={1}>
              <title>{item.topic}: F={item.financialScore} I={item.impactScore}</title>
            </circle>
          ))}

          {/* Material points */}
          {material.map((item, i) => (
            <circle key={`m-${i}`} cx={toX(item.financialScore)} cy={toY(item.impactScore)}
              r={7} fill="#1D4ED8" fillOpacity={0.85} stroke="white" strokeWidth={1.5}>
              <title>{item.topic}\n{item.rationale}</title>
            </circle>
          ))}

          {/* Axis ticks extremes */}
          <text x={toX(0)} y={PAD + plotH + 14} textAnchor="middle" fontSize={10} fill="#94a3b8">0</text>
          <text x={toX(5)} y={PAD + plotH + 14} textAnchor="middle" fontSize={10} fill="#94a3b8">5</text>
          <text x={PAD - 8} y={toY(0) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">0</text>
          <text x={PAD - 8} y={toY(5) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">5</text>
        </svg>
      </div>

      {/* Material Topics */}
      {material.length > 0 && (
        <div>
          <h3 className="font-semibold mb-4" style={{ color: "var(--ent-text)" }}>Material Topics ({material.length})</h3>
          <div className="space-y-3">
            {material.sort((a, b) => (b.financialScore + b.impactScore) - (a.financialScore + a.impactScore)).map((item, i) => (
              <div key={i} className="p-4 rounded-xl" style={{ background: "white", border: "1px solid var(--ent-border)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: "var(--ent-text)" }}>{item.topic}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--ent-muted)" }}>{item.rationale}</p>
                  </div>
                  <div className="flex gap-2 text-xs shrink-0">
                    <span className="px-2 py-0.5 rounded" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>
                      F: {item.financialScore}
                    </span>
                    <span className="px-2 py-0.5 rounded" style={{ background: "#F0FDF4", color: "#15803d" }}>
                      I: {item.impactScore}
                    </span>
                  </div>
                </div>
                {item.esrsArticles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {item.esrsArticles.map((a) => (
                      <span key={a} className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: "#DCFCE7", color: "#14532D" }}>{a}</span>
                    ))}
                    {item.griStandards.map((g) => (
                      <span key={g} className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: "#EDE9FE", color: "#3B0764" }}>{g}</span>
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
