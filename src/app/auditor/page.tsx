"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

interface ClientData {
  id: string;
  email: string;
  name: string | null;
  companyName: string | null;
  createdAt: string;
}

interface AccessEntry {
  auditorId: string;
  clientId: string;
  grantedAt: string;
  client: ClientData;
}

export default function AuditorDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;

    fetch("/api/auditor/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
      .catch(() => toast.error("Failed to load clients"))
      .finally(() => setLoading(false));
  }, [status, router]);

  if (status !== "authenticated") return null;

  return (
    <div
      className="min-h-screen p-8"
      style={{ background: "#171311", color: "#EDE6DD" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "#EDE6DD" }}>Auditor Partner Portal</h1>
          <p className="text-sm mt-1" style={{ color: "#A89B8C" }}>
            Read-only access to client attestation workspaces. Logged in as {session.user.email}.
          </p>
        </div>

        {loading ? (
          <p style={{ color: "#A89B8C" }}>Loading clients…</p>
        ) : clients.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-sm" style={{ color: "#A89B8C" }}>No clients have granted you access yet.</p>
            <p className="text-xs mt-2" style={{ color: "#A89B8C" }}>
              Ask your client to go to their cascrow Settings → Auditor Access and enter your email: <strong style={{ color: "#EDE6DD" }}>{session.user.email}</strong>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {clients.map((entry) => (
              <Link
                key={entry.clientId}
                href={`/auditor/${entry.clientId}`}
                className="rounded-xl p-5 flex items-center justify-between transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none" }}
              >
                <div>
                  <div className="font-semibold text-sm" style={{ color: "#EDE6DD" }}>
                    {entry.client.companyName ?? entry.client.name ?? entry.client.email}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#A89B8C" }}>
                    {entry.client.email} · Access granted {new Date(entry.grantedAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-sm" style={{ color: "#C4704B" }}>View →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
