import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchFromConnector, ConnectorConfig } from "@/services/attestation/connectors";
import { z } from "zod";

const schema = z.object({
  system:       z.enum(["SAP", "WORKDAY", "SALESFORCE", "NETSUITE"]),
  baseUrl:      z.string().url().max(500),
  authType:     z.enum(["BASIC", "OAUTH2_CLIENT", "OAUTH1"]).default("OAUTH2_CLIENT"),
  entity:       z.string().max(500),
  filter:       z.string().max(500).optional(),
  selectFields: z.array(z.string().max(100)).max(20).optional(),
  clientId:     z.string().max(500).optional(),
  clientSecret: z.string().max(500).optional(),
  username:     z.string().max(500).optional(),
  password:     z.string().max(500).optional(),
  tokenUrl:     z.string().url().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rlAllowed = await checkRateLimit(`test-connector:${session.user.id}`, 10, 3600);
  if (!rlAllowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const config: ConnectorConfig = { ...parsed.data };

  try {
    const result = await fetchFromConnector(config);
    return NextResponse.json({
      success: true,
      preview: result.content.slice(0, 500),
      recordCount: result.recordCount ?? null,
      rawBytes: result.rawBytes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ success: false, error: message });
  }
}
