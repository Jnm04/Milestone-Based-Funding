import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the cascrow support assistant. cascrow is an AI-powered escrow platform on the XRPL EVM Sidechain that locks RLUSD and releases funds when AI verifies milestone completion.

You help users with:
- Contract creation (investors define milestones, amount in USD, deadlines)
- Funding escrow (two MetaMask steps: RLUSD approve + escrow fund)
- Proof submission (PDF upload or GitHub repo link)
- AI verification (5-model majority vote: 3/5 YES required)
- NFT certificates (minted on XRPL mainnet on completion)
- Status meanings: DRAFT, AWAITING_ESCROW, FUNDED, PROOF_SUBMITTED, VERIFIED, REJECTED, EXPIRED, COMPLETED

Common issues:
- MetaMask: Two separate popups required (approve ERC-20 first, then fund). If MetaMask doesn't pop up, check it's unlocked and on XRPL EVM Sidechain (Chain ID 1449000).
- Proof rejected: AI needs clear evidence. Upload a PDF with detailed metrics, not just a summary. GitHub repos should have activity within the milestone period.
- RLUSD: Obtainable on XRPL EVM testnet from the faucet. RPC: https://rpc.testnet.xrplevm.org
- Email verification required before funding contracts.

Tone: concise, helpful, direct. No markdown in responses — plain text only.
If the user's issue is technical, specific, or you genuinely can't help, say so clearly and that a support ticket will be created for the team.
Keep responses under 3 sentences unless a step-by-step is truly needed.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  let body: { messages: Message[]; createTicket?: boolean; subject?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, createTicket, subject } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Ticket creation path — called when bot couldn't help after 2 exchanges
  if (createTicket) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const ticketSubject = subject ?? lastUserMsg?.content?.slice(0, 80) ?? "Support request";

    // Classify priority
    const text = messages.map((m) => m.content).join(" ").toLowerCase();
    const priority = /urgent|critical|lost funds|can't fund|stuck|error|bug|broken/.test(text)
      ? "HIGH"
      : /problem|issue|fail|wrong|not working/.test(text)
      ? "MEDIUM"
      : "LOW";

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        subject: ticketSubject,
        messages: messages as unknown as Parameters<typeof prisma.supportTicket.create>[0]["data"]["messages"],
        priority,
        status: "OPEN",
      },
    });

    return NextResponse.json({ ticketId: ticket.id, priority });
  }

  // Chat path
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "Sorry, I couldn't generate a response.";

    // Detect if bot is stuck / can't help — signal client to offer ticket creation
    const cantHelp =
      /can't help|cannot help|don't know|escalate|create a ticket|support team|get back to you/i.test(text) ||
      messages.filter((m) => m.role === "user").length >= 4;

    return NextResponse.json({ reply: text, cantHelp });
  } catch (err) {
    console.error("[support/chat] AI error:", err);
    return NextResponse.json(
      { reply: "I'm having trouble right now. Please try again or create a support ticket.", cantHelp: true },
      { status: 200 }
    );
  }
}
