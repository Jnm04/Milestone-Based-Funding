import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { getEnterpriseContext } from "@/lib/enterprise-context";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SOURCE_CFG: Record<string, { color: string; bg: string }> = {
  "EUR-LEX": { color: "#1D4ED8", bg: "#EFF6FF" },
  EFRAG: { color: "#6D28D9", bg: "#F5F3FF" },
  GRI: { color: "#047857", bg: "#ECFDF5" },
};

const TAG_CFG: Record<string, { color: string; bg: string }> = {
  CSRD: { color: "#1D4ED8", bg: "#DBEAFE" },
  GRI: { color: "#047857", bg: "#D1FAE5" },
  SDG: { color: "#B45309", bg: "#FEF3C7" },
  TCFD: { color: "#7C3AED", bg: "#EDE9FE" },
  ISO: { color: "#0E7490", bg: "#CFFAFE" },
};

function tagColor(tag: string) {
  const prefix = tag.split(":")[0];
  return TAG_CFG[prefix] ?? { color: "#374151", bg: "#F3F4F6" };
}

function sourceCfg(source: string) {
  return SOURCE_CFG[source] ?? { color: "#374151", bg: "#F3F4F6" };
}

export default async function RegulatoryAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await getEnterpriseContext(session.user.id);

  const { tag } = await searchParams;

  const allAlerts = await prisma.regulatoryAlert.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const alerts = tag
    ? allAlerts.filter((a) => {
        const tags = a.affectedTags as string[];
        return tags.some((t) => t.startsWith(tag));
      })
    : allAlerts;

  const major = alerts.filter((a) => a.severity === "MAJOR");
  const minor = alerts.filter((a) => a.severity === "MINOR");

  const cardStyle: React.CSSProperties = {
    background: "white",
    border: "1px solid var(--ent-border)",
    borderRadius: 12,
    padding: "20px 24px",
    marginBottom: 12,
  };

  const TAG_FILTERS = ["CSRD", "GRI", "SDG", "TCFD", "ISO"];

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900 }}>
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
            Regulatory Alerts
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
            CSRD, ESRS, GRI and TCFD updates that may affect your tracked milestones
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <a
            href="/enterprise/dashboard/regulatory"
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: !tag ? "var(--ent-accent)" : "var(--ent-bg)",
              color: !tag ? "white" : "var(--ent-muted)",
              border: `1px solid ${!tag ? "var(--ent-accent)" : "var(--ent-border)"}`,
              textDecoration: "none",
            }}
          >
            All
          </a>
          {TAG_FILTERS.map((f) => {
            const active = tag === f;
            return (
              <a
                key={f}
                href={`/enterprise/dashboard/regulatory?tag=${f}`}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: active ? "var(--ent-accent)" : "var(--ent-bg)",
                  color: active ? "white" : "var(--ent-muted)",
                  border: `1px solid ${active ? "var(--ent-accent)" : "var(--ent-border)"}`,
                  textDecoration: "none",
                }}
              >
                {f}
              </a>
            );
          })}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "64px 24px" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#EFF6FF", display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
          }}>
            <svg width="24" height="24" fill="none" stroke="var(--ent-accent)" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>No alerts yet</p>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ent-muted)" }}>
            The weekly cron monitors EUR-LEX, EFRAG and GRI for updates. Check back after the next run.
          </p>
        </div>
      ) : (
        <>
          {major.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#DC2626" }}>
                Major updates — action may be required
              </h2>
              {major.map((a) => (
                <AlertCard key={a.id} alert={a} />
              ))}
            </section>
          )}
          {minor.length > 0 && (
            <section>
              <h2 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ent-muted)" }}>
                Minor updates — informational
              </h2>
              {minor.map((a) => (
                <AlertCard key={a.id} alert={a} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AlertCard({ alert }: {
  alert: {
    id: string;
    source: string;
    title: string;
    url: string;
    affectedTags: unknown;
    severity: string;
    aiSummary: string;
    publishedAt: Date;
  };
}) {
  const isMajor = alert.severity === "MAJOR";
  const src = sourceCfg(alert.source);
  const tags = (alert.affectedTags as string[]) ?? [];

  return (
    <div style={{
      background: "white",
      border: `1px solid ${isMajor ? "#FECACA" : "var(--ent-border)"}`,
      borderLeft: `3px solid ${isMajor ? "#DC2626" : "var(--ent-border)"}`,
      borderRadius: 10,
      padding: "16px 20px",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              color: src.color, background: src.bg,
            }}>
              {alert.source}
            </span>
            {isMajor && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                color: "#DC2626", background: "#FEF2F2",
              }}>
                MAJOR
              </span>
            )}
            <span style={{ fontSize: 12, color: "var(--ent-muted)", marginLeft: "auto" }}>
              {new Date(alert.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <a
            href={alert.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ent-text)", textDecoration: "none", display: "block", marginBottom: 8 }}
          >
            {alert.title} ↗
          </a>
          <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--ent-muted)", lineHeight: 1.55 }}>
            {alert.aiSummary}
          </p>
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {tags.map((t) => {
                const tc = tagColor(t);
                return (
                  <span key={t} style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                    color: tc.color, background: tc.bg,
                  }}>
                    {t}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
