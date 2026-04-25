import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/api-key-auth";
import { encryptApiKey } from "@/lib/encrypt";
import { getEnterpriseContext } from "@/lib/enterprise-context";
import { fetchFromConnector, ConnectorConfig } from "@/services/attestation/connectors";

const VALID_SYSTEMS = ["SAP", "WORKDAY", "SALESFORCE", "NETSUITE"];
const VALID_AUTH = ["BASIC", "OAUTH2_CLIENT", "OAUTH1"];

// PUT — save & test connector config for an enterprise milestone
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(req.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const { id: contractId, milestoneId } = await params;
  const { effectiveUserId } = await getEnterpriseContext(auth.userId);

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { investorId: true, mode: true },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.investorId !== effectiveUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (contract.mode !== "ATTESTATION") return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });

  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId, contractId } });
  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  if (milestone.dataSourceLockedAt) {
    return NextResponse.json({ error: "Data source is locked and cannot be changed" }, { status: 409 });
  }

  const body = await req.json().catch(() => null) as {
    system: string;
    baseUrl: string;
    authType: string;
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
    tokenUrl?: string;
    entity?: string;
    filter?: string;
    selectFields?: string[];
    responseField?: string;
    scheduleType?: string;
    testOnly?: boolean;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  if (!VALID_SYSTEMS.includes(body.system)) {
    return NextResponse.json({ error: "Invalid system. Must be SAP, WORKDAY, SALESFORCE, or NETSUITE" }, { status: 400 });
  }
  if (!VALID_AUTH.includes(body.authType)) {
    return NextResponse.json({ error: "Invalid authType" }, { status: 400 });
  }
  if (!body.baseUrl?.startsWith("https://")) {
    return NextResponse.json({ error: "baseUrl must start with https://" }, { status: 400 });
  }

  const connectorConfig: ConnectorConfig = {
    system: body.system as ConnectorConfig["system"],
    baseUrl: body.baseUrl,
    authType: body.authType as ConnectorConfig["authType"],
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    username: body.username,
    password: body.password,
    tokenUrl: body.tokenUrl,
    entity: body.entity,
    filter: body.filter,
    selectFields: body.selectFields,
    responseField: body.responseField,
  };

  // Test connection
  let testStatus: "OK" | "ERROR" | "TIMEOUT" = "ERROR";
  let recordCount: number | undefined;
  let errorMessage: string | undefined;
  let httpStatus: number | undefined;

  try {
    const result = await fetchFromConnector(connectorConfig);
    testStatus = "OK";
    recordCount = result.recordCount;
    httpStatus = 200;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    testStatus = errorMessage?.toLowerCase().includes("timeout") ? "TIMEOUT" : "ERROR";
  }

  // Always store the health check result
  await prisma.connectorHealthCheck.create({
    data: {
      milestoneId,
      connectorUrl: body.baseUrl,
      status: testStatus,
      httpStatus,
      errorMessage,
    },
  });

  // If test-only mode, return without saving
  if (body.testOnly) {
    return NextResponse.json({
      success: testStatus === "OK",
      status: testStatus,
      recordCount,
      error: errorMessage,
    });
  }

  if (testStatus !== "OK") {
    return NextResponse.json({
      success: false,
      status: testStatus,
      error: errorMessage ?? "Connection failed",
    }, { status: 422 });
  }

  // Encrypt secrets
  const encryptedSecret = body.clientSecret ? encryptApiKey(body.clientSecret) : null;
  const encryptedPassword = body.password ? encryptApiKey(body.password) : null;

  const storedConfig = {
    system: body.system,
    baseUrl: body.baseUrl,
    authType: body.authType,
    clientId: body.clientId,
    clientSecretEnc: encryptedSecret,
    clientSecretHint: body.clientSecret?.slice(-4),
    username: body.username,
    passwordEnc: encryptedPassword,
    tokenUrl: body.tokenUrl,
    entity: body.entity,
    filter: body.filter,
    selectFields: body.selectFields,
    responseField: body.responseField,
  };

  const VALID_SCHEDULE = ["ONE_OFF", "MONTHLY", "QUARTERLY", "ANNUAL"];
  const scheduleType = VALID_SCHEDULE.includes(body.scheduleType ?? "") ? body.scheduleType! : "MONTHLY";

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      dataSourceType: "REST_API",
      dataSourceConnector: body.system,
      dataSourceUrl: body.baseUrl,
      dataSourceConfig: storedConfig,
      connectorStatus: "OK",
      connectorLastHealthy: new Date(),
      scheduleType,
    },
  });

  return NextResponse.json({ success: true, status: "OK", recordCount });
}

// GET — fetch current connector health (last 5 checks)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(req.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const { milestoneId } = await params;

  const checks = await prisma.connectorHealthCheck.findMany({
    where: { milestoneId },
    orderBy: { checkedAt: "desc" },
    take: 5,
  });

  return NextResponse.json({ checks });
}
