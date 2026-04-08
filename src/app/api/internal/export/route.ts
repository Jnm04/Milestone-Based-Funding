import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  return key && secret && key === secret;
}

/**
 * GET /api/internal/export
 * Downloads the full labeled training dataset as JSONL.
 *
 * Two formats via ?format= query param:
 *   jsonl  (default) — Mistral/LLaMA fine-tuning format, one JSON object per line
 *   csv             — spreadsheet-friendly, all fields as columns
 *
 * The JSONL format is directly usable for supervised fine-tuning on:
 *   - Together AI  (mistralai/Mistral-7B-Instruct-v0.2)
 *   - Hugging Face Transformers (TRL SFTTrainer)
 *   - OpenAI fine-tuning API (gpt-3.5-turbo / gpt-4o-mini)
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = new URL(req.url).searchParams.get("format") ?? "jsonl";

  const entries = await prisma.trainingEntry.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      proofId: true,
      milestoneText: true,
      proofText: true,
      label: true,
      labelSource: true,
      fraudType: true,
      modelVotes: true,
      consensusLevel: true,
      notes: true,
      createdAt: true,
    },
  });

  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const header = "id,proofId,label,labelSource,consensusLevel,fraudType,milestoneText,createdAt\n";
    const rows = entries.map((e) =>
      [
        e.id,
        e.proofId,
        e.label,
        e.labelSource,
        e.consensusLevel,
        e.fraudType ?? "",
        `"${e.milestoneText.replace(/"/g, '""').slice(0, 200)}"`,
        e.createdAt.toISOString(),
      ].join(",")
    );
    const csv = header + rows.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="cascrow-dataset-${timestamp}.csv"`,
      },
    });
  }

  // Default: JSONL — Mistral/OpenAI supervised fine-tuning format
  // Each line is a training example: system prompt + user message + expected assistant output
  const lines = entries.map((e) => {
    const assistantOutput = JSON.stringify({
      decision: e.label === "APPROVED" ? "YES" : "NO",
      reasoning: Array.isArray(e.modelVotes)
        ? ((e.modelVotes as { reasoning?: string }[])[0]?.reasoning ?? "")
        : "",
      confidence: e.consensusLevel * 20, // rough proxy: 5/5 = 100, 4/5 = 80, etc.
    });

    return JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "You are a milestone verification agent. Determine whether the provided document proves that a specific milestone has been completed. Respond with ONLY a valid JSON object: {\"decision\": \"YES\" or \"NO\", \"reasoning\": \"Brief explanation (2-3 sentences)\", \"confidence\": 0-100}",
        },
        {
          role: "user",
          content:
            `Milestone to verify:\n[MILESTONE START]\n${e.milestoneText}\n[MILESTONE END]\n\n` +
            `Document content:\n[DOCUMENT START]\n${e.proofText.slice(0, 8000)}\n[DOCUMENT END]`,
        },
        {
          role: "assistant",
          content: assistantOutput,
        },
      ],
      // Metadata fields — stripped before fine-tuning, kept here for traceability
      _meta: {
        id: e.id,
        proofId: e.proofId,
        label: e.label,
        labelSource: e.labelSource,
        fraudType: e.fraudType,
        consensusLevel: e.consensusLevel,
        notes: e.notes,
        createdAt: e.createdAt.toISOString(),
      },
    });
  });

  const jsonl = lines.join("\n");

  // Also prepend a comment header (non-standard but helpful for humans reading the file)
  const header = [
    `# Cascrow training dataset — exported ${new Date().toISOString()}`,
    `# ${entries.length} labeled examples`,
    `# Format: JSONL, Mistral/OpenAI supervised fine-tuning`,
    `# Strip _meta fields before uploading to Together AI / OpenAI fine-tuning API`,
    "",
  ].join("\n");

  return new NextResponse(header + jsonl, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="cascrow-dataset-${timestamp}.jsonl"`,
    },
  });
}
