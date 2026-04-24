"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

interface EntitySummary {
  id: string;
  name: string;
  parentEntityId: string | null;
  memberCount: number;
}

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  entityId: string | null;
}

interface GroupData {
  org: { id: string; name: string; plan: string } | null;
  summary: {
    totalContracts: number;
    totalMilestones: number;
    verifiedCount: number;
    activeCount: number;
  };
  entities: EntitySummary[];
  members: Member[];
}

const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 };
const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#A89B8C" };

export default function GroupDashboardPage() {
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/enterprise/group/summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        setData(d as GroupData);
      })
      .catch(() => toast.error("Failed to load group data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#171311", color: "#A89B8C" }}>
        Loading…
      </div>
    );
  }

  if (!data) return null;

  const { org, summary, entities, members } = data;

  const rootEntities = entities.filter((e) => !e.parentEntityId);
  const childEntities = (parentId: string) => entities.filter((e) => e.parentEntityId === parentId);
  const unassigned = members.filter((m) => !m.entityId);

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: "#171311", color: "#EDE6DD" }}>
      <div className="max-w-4xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#EDE6DD" }}>
              {org?.name ?? "Organisation"} — Group View
            </h1>
            <p className="text-sm mt-1" style={{ color: "#A89B8C" }}>
              Consolidated roll-up across all entities
            </p>
          </div>
          <Link
            href="/enterprise/settings/entities"
            className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.35)", color: "#C4704B" }}
          >
            Manage Entities →
          </Link>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Contracts", value: summary.totalContracts },
            { label: "Milestones", value: summary.totalMilestones },
            { label: "Verified", value: summary.verifiedCount },
            { label: "Active", value: summary.activeCount },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 flex flex-col gap-1" style={CARD}>
              <span style={LABEL}>{label}</span>
              <span className="text-3xl font-bold" style={{ color: "#EDE6DD" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Entity Tree */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold" style={{ color: "#EDE6DD" }}>Entities</h2>
            <span className="text-xs" style={{ color: "#A89B8C" }}>{entities.length} total</span>
          </div>

          {entities.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={CARD}>
              <p className="text-sm" style={{ color: "#A89B8C" }}>No entities yet.</p>
              <Link
                href="/enterprise/settings/entities"
                className="text-sm mt-2 inline-block"
                style={{ color: "#C4704B" }}
              >
                Create your first entity →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rootEntities.map((entity) => (
                <div key={entity.id}>
                  <EntityRow entity={entity} depth={0} />
                  {childEntities(entity.id).map((child) => (
                    <EntityRow key={child.id} entity={child} depth={1} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members breakdown */}
        <div>
          <h2 className="text-base font-semibold mb-3" style={{ color: "#EDE6DD" }}>Team Members</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="px-5 py-3 grid grid-cols-3 gap-2" style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={LABEL}>Member</span>
              <span style={LABEL}>Role</span>
              <span style={LABEL}>Entity</span>
            </div>
            {members.length === 0 ? (
              <div className="px-5 py-4 text-sm" style={{ color: "#A89B8C" }}>No team members yet.</div>
            ) : (
              members.map((m) => {
                const entityName = entities.find((e) => e.id === m.entityId)?.name ?? "—";
                return (
                  <div key={m.id} className="px-5 py-3 grid grid-cols-3 gap-2 items-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div>
                      <p className="text-sm" style={{ color: "#EDE6DD" }}>{m.name ?? m.email}</p>
                      {m.name && <p className="text-xs" style={{ color: "#A89B8C" }}>{m.email}</p>}
                    </div>
                    <span className="text-xs px-2 py-1 rounded w-fit" style={{ background: "rgba(196,112,75,0.12)", color: "#C4704B" }}>
                      {m.role}
                    </span>
                    <span className="text-sm" style={{ color: m.entityId ? "#EDE6DD" : "#A89B8C" }}>
                      {entityName}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          {unassigned.length > 0 && (
            <p className="text-xs mt-2" style={{ color: "#A89B8C" }}>
              {unassigned.length} member{unassigned.length !== 1 ? "s" : ""} not assigned to an entity.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EntityRow({ entity, depth }: { entity: EntitySummary; depth: number }) {
  return (
    <Link href={`/enterprise/group/${entity.id}`}>
      <div
        className="flex items-center justify-between px-5 py-3 rounded-xl transition-colors cursor-pointer"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          marginLeft: depth * 24,
        }}
      >
        <div className="flex items-center gap-2">
          {depth > 0 && <span style={{ color: "#A89B8C" }}>└</span>}
          <span className="text-sm font-medium" style={{ color: "#EDE6DD" }}>{entity.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: "#A89B8C" }}>
            {entity.memberCount} member{entity.memberCount !== 1 ? "s" : ""}
          </span>
          <span style={{ color: "#A89B8C", fontSize: 12 }}>→</span>
        </div>
      </div>
    </Link>
  );
}
