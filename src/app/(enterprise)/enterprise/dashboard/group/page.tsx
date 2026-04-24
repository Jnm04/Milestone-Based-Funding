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

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--ent-border)",
  borderRadius: 12,
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--ent-muted)",
};

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
      <div style={{ padding: "32px 36px" }}>
        <div style={{ height: 28, width: 200, borderRadius: 6, background: "var(--ent-bg)", marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
          {[1,2,3,4].map((i) => <div key={i} style={{ height: 80, borderRadius: 10, background: "var(--ent-bg)" }} />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { org, summary, entities, members } = data;
  const rootEntities = entities.filter((e) => !e.parentEntityId);
  const childEntities = (parentId: string) => entities.filter((e) => e.parentEntityId === parentId);
  const unassigned = members.filter((m) => !m.entityId);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
            {org?.name ?? "Organisation"} — Group View
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ent-muted)" }}>
            Consolidated roll-up across all entities
          </p>
        </div>
        <Link
          href="/enterprise/settings/entities"
          style={{
            fontSize: 13,
            padding: "7px 16px",
            borderRadius: 8,
            fontWeight: 600,
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            color: "var(--ent-accent)",
            textDecoration: "none",
          }}
        >
          Manage Entities →
        </Link>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Contracts", value: summary.totalContracts },
          { label: "Milestones", value: summary.totalMilestones },
          { label: "Verified", value: summary.verifiedCount, color: "#059669", bg: "#ECFDF5" },
          { label: "Active", value: summary.activeCount, color: "var(--ent-accent)", bg: "#EFF6FF" },
        ].map(({ label: lbl, value, color, bg }) => (
          <div key={lbl} style={{ ...card, padding: "16px 20px", background: bg ?? "white" }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: color ?? "var(--ent-text)", letterSpacing: "-0.03em", display: "block" }}>
              {value}
            </span>
            <span style={{ fontSize: 12, color: color ?? "var(--ent-muted)", fontWeight: 500 }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* Entity Tree */}
      <div style={{ ...card, padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>Entities</h2>
          <span style={{ fontSize: 12, color: "var(--ent-muted)" }}>{entities.length} total</span>
        </div>

        {entities.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--ent-text)" }}>No entities yet</p>
            <Link href="/enterprise/settings/entities" style={{ fontSize: 13, color: "var(--ent-accent)" }}>
              Create your first entity →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

      {/* Members table */}
      <div style={{ ...card, padding: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>
          Team Members
        </h2>
        <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--ent-border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "10px 16px", background: "var(--ent-bg)", borderBottom: "1px solid var(--ent-border)" }}>
            {["Member", "Role", "Entity"].map((h) => (
              <span key={h} style={label}>{h}</span>
            ))}
          </div>
          {members.length === 0 ? (
            <div style={{ padding: "16px", fontSize: 13, color: "var(--ent-muted)" }}>No team members yet.</div>
          ) : (
            members.map((m) => {
              const entityName = entities.find((e) => e.id === m.entityId)?.name ?? "—";
              return (
                <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "10px 16px", alignItems: "center", borderBottom: "1px solid var(--ent-border)" }}>
                  <div>
                    <p style={{ margin: "0 0 1px", fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>{m.name ?? m.email}</p>
                    {m.name && <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)" }}>{m.email}</p>}
                  </div>
                  <span style={{
                    fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                    background: "#EFF6FF", color: "var(--ent-accent)", width: "fit-content",
                  }}>
                    {m.role}
                  </span>
                  <span style={{ fontSize: 13, color: m.entityId ? "var(--ent-text)" : "var(--ent-muted)" }}>
                    {entityName}
                  </span>
                </div>
              );
            })
          )}
        </div>
        {unassigned.length > 0 && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>
            {unassigned.length} member{unassigned.length !== 1 ? "s" : ""} not assigned to an entity.
          </p>
        )}
      </div>
    </div>
  );
}

function EntityRow({ entity, depth }: { entity: EntitySummary; depth: number }) {
  return (
    <Link href={`/enterprise/dashboard/group/${entity.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderRadius: 8,
          border: "1px solid var(--ent-border)",
          background: "var(--ent-bg)",
          marginLeft: depth * 24,
          cursor: "pointer",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {depth > 0 && <span style={{ color: "var(--ent-muted)" }}>└</span>}
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>{entity.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 12, color: "var(--ent-muted)" }}>
            {entity.memberCount} member{entity.memberCount !== 1 ? "s" : ""}
          </span>
          <span style={{ color: "var(--ent-muted)", fontSize: 12 }}>→</span>
        </div>
      </div>
    </Link>
  );
}
