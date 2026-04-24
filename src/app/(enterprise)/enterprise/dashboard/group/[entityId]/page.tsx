"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  entityId: string | null;
}

interface EntityInfo {
  id: string;
  name: string;
  parentEntityId: string | null;
}

interface GroupData {
  org: { id: string; name: string } | null;
  entities: EntityInfo[];
  members: Member[];
}

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--ent-border)",
  borderRadius: 12,
  padding: 24,
  marginBottom: 16,
};

export default function EntityDetailPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/enterprise/group/summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        setData(d as GroupData);
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <div style={{ height: 20, width: 260, borderRadius: 6, background: "var(--ent-bg)", marginBottom: 8 }} />
        <div style={{ height: 28, width: 200, borderRadius: 6, background: "var(--ent-bg)", marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[1, 2].map((i) => <div key={i} style={{ height: 80, borderRadius: 10, background: "var(--ent-bg)" }} />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const entity = data.entities.find((e) => e.id === entityId);
  if (!entity) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <p style={{ color: "#DC2626", fontSize: 14 }}>Entity not found.</p>
        <Link href="/enterprise/dashboard/group" style={{ fontSize: 13, color: "var(--ent-accent)" }}>← Group Overview</Link>
      </div>
    );
  }

  const entityMembers = data.members.filter((m) => m.entityId === entityId);
  const parentEntity = entity.parentEntityId
    ? data.entities.find((e) => e.id === entity.parentEntityId)
    : null;
  const childEntities = data.entities.filter((e) => e.parentEntityId === entityId);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 760 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ent-muted)", marginBottom: 16 }}>
        <Link href="/enterprise/dashboard/group" style={{ color: "var(--ent-accent)", textDecoration: "none" }}>Group Overview</Link>
        <span>/</span>
        {parentEntity && (
          <>
            <Link href={`/enterprise/dashboard/group/${parentEntity.id}`} style={{ color: "var(--ent-accent)", textDecoration: "none" }}>
              {parentEntity.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span style={{ color: "var(--ent-text)", fontWeight: 600 }}>{entity.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
            {entity.name}
          </h1>
          {parentEntity && (
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ent-muted)" }}>Part of {parentEntity.name}</p>
          )}
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

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Members", value: entityMembers.length },
          { label: "Sub-Entities", value: childEntities.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ ...card, marginBottom: 0, padding: "16px 20px" }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--ent-text)", letterSpacing: "-0.03em", display: "block" }}>
              {value}
            </span>
            <span style={{ fontSize: 12, color: "var(--ent-muted)", fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Sub-entities */}
      {childEntities.length > 0 && (
        <div style={card}>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>Sub-Entities</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {childEntities.map((child) => (
              <Link key={child.id} href={`/enterprise/dashboard/group/${child.id}`} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--ent-border)",
                  background: "var(--ent-bg)",
                  cursor: "pointer",
                }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>{child.name}</span>
                  <span style={{ color: "var(--ent-muted)", fontSize: 12 }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div style={card}>
        <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>
          Members ({entityMembers.length})
        </h2>
        <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--ent-border)" }}>
          {entityMembers.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--ent-muted)" }}>
              No members assigned to this entity yet.{" "}
              <Link href="/enterprise/settings/entities" style={{ color: "var(--ent-accent)" }}>
                Assign from entity settings →
              </Link>
            </div>
          ) : (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                padding: "10px 16px",
                background: "var(--ent-bg)",
                borderBottom: "1px solid var(--ent-border)",
              }}>
                {["Member", "Role"].map((h) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ent-muted)" }}>
                    {h}
                  </span>
                ))}
              </div>
              {entityMembers.map((m) => (
                <div key={m.id} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  padding: "10px 16px",
                  alignItems: "center",
                  borderBottom: "1px solid var(--ent-border)",
                }}>
                  <div>
                    <p style={{ margin: "0 0 1px", fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>{m.name ?? m.email}</p>
                    {m.name && <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)" }}>{m.email}</p>}
                  </div>
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "#EFF6FF",
                    color: "var(--ent-accent)",
                    width: "fit-content",
                  }}>
                    {m.role}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
