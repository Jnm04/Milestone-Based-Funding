import { prisma } from "@/lib/prisma";

export interface Prediction {
  predictedOutcome: "YES" | "NO" | "INCONCLUSIVE";
  confidence: number;       // 0.0–1.0
  weeksToDeadline: number;
  trendSlope: number;       // positive = improving, negative = worsening
  snapshotCount: number;
  lastRawValue: string | null;
}

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let ssXX = 0, ssXY = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssXX += (xs[i] - meanX) ** 2;
    ssXY += (xs[i] - meanX) * (ys[i] - meanY);
    ssTot += (ys[i] - meanY) ** 2;
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const ssRes = ys.reduce((a, y, i) => a + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

const RISK_SCORE: Record<string, number> = {
  ON_TRACK: 1.0,
  AT_RISK: 0.5,
  LIKELY_MISS: 0.0,
};

export async function computePrediction(milestoneId: string): Promise<Prediction | null> {
  const [snapshots, milestone] = await Promise.all([
    prisma.pulseCheckSnapshot.findMany({
      where: { milestoneId },
      orderBy: { capturedAt: "asc" },
    }),
    prisma.milestone.findUnique({ where: { id: milestoneId }, select: { cancelAfter: true } }),
  ]);

  if (!milestone || snapshots.length < 3) return null;

  const now = Date.now();
  const t0 = snapshots[0].capturedAt.getTime();

  const xs = snapshots.map((s) => (s.capturedAt.getTime() - t0) / (1000 * 60 * 60 * 24));
  const ys = snapshots.map((s) => RISK_SCORE[s.risk] ?? 0.5);
  const avgConfidence = snapshots.reduce((a, s) => a + s.confidence, 0) / snapshots.length;

  const { slope, intercept, r2 } = linearRegression(xs, ys);

  const deadlineDays = (milestone.cancelAfter.getTime() - t0) / (1000 * 60 * 60 * 24);
  const projectedScore = Math.max(0, Math.min(1, slope * deadlineDays + intercept));
  const weeksToDeadline = Math.max(0, (milestone.cancelAfter.getTime() - now) / (1000 * 60 * 60 * 24 * 7));

  let predictedOutcome: "YES" | "NO" | "INCONCLUSIVE";
  if (projectedScore > 0.65) predictedOutcome = "YES";
  else if (projectedScore < 0.35) predictedOutcome = "NO";
  else predictedOutcome = "INCONCLUSIVE";

  const confidence = Math.min(1, r2 * avgConfidence);
  const lastSnap = snapshots[snapshots.length - 1];

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      predictedOutcome,
      predictedConfidence: confidence,
      predictedUpdatedAt: new Date(),
    },
  });

  return {
    predictedOutcome,
    confidence,
    weeksToDeadline,
    trendSlope: slope,
    snapshotCount: snapshots.length,
    lastRawValue: lastSnap.rawValue,
  };
}
