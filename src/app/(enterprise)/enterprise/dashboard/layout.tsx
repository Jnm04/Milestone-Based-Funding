import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EnterpriseSidebar } from "@/components/enterprise/sidebar";

export default async function EnterpriseDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/enterprise/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, companyName: true, isEnterprise: true },
  });

  if (!user?.isEnterprise) redirect("/enterprise/pending");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--ent-bg)" }}>
      <EnterpriseSidebar user={{ name: user.name, email: user.email, company: user.companyName }} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
