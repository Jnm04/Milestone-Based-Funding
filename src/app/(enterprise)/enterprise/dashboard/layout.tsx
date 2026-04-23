import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EnterpriseSidebar } from "@/components/enterprise/sidebar";
import { getEnterpriseContext } from "@/lib/enterprise-context";

export default async function EnterpriseDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/enterprise/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, companyName: true, isEnterprise: true },
  });

  if (!user?.isEnterprise) redirect("/enterprise/pending");

  const ctx = await getEnterpriseContext(session.user.id);
  const displayName = ctx.isTeamMember ? ctx.ownerName : user.name;
  const displayCompany = ctx.isTeamMember ? ctx.ownerCompany : user.companyName;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--ent-bg)" }}>
      <EnterpriseSidebar user={{ name: displayName ?? null, email: user.email, company: displayCompany ?? null }} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {ctx.isTeamMember && (
          <div style={{
            background: "#EFF6FF",
            borderBottom: "1px solid #BFDBFE",
            padding: "8px 24px",
            fontSize: 13,
            color: "#1D4ED8",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Viewing <strong>{displayCompany ?? displayName ?? "organization"}</strong>'s workspace
            as {ctx.role === "EDITOR" ? "Editor" : "Viewer"}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
