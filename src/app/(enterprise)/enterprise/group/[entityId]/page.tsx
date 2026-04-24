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

const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 };
const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#A89B8C" };

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#171311", color: "#A89B8C" }}>
        Loading…
      </div>
    );
  }

  if (!data) return null;

  const entity = data.entities.find((e) => e.id === entityId);
  if (!entity) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#171311", color: "#ef4444" }}>
        Entity not found.
      </div>
    );
  }

  const entityMembers = data.members.filter((m) => m.entityId === entityId);
  const parentEntity = entity.parentEntityId
    ? data.entities.find((e) => e.id === entity.parentEntityId)
    : null;
  const childEntities = data.entities.filter((e) => e.parentEntityId === entityId);

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: "#171311", color: "#EDE6DD" }}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm" style={{ color: "#A89B8C" }}>
          <Link href="/enterprise/group" style={{ color: "#C4704B" }}>Group Overview</Link>
          <span>/</span>
          {parentEntity && (
            <>
              <Link href={`/enterprise/group/${parentEntity.id}`} style={{ color: "#C4704B" }}>
                {parentEntity.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span style={{ color: "#EDE6DD" }}>{entity.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#EDE6DD" }}>{entity.name}</h1>
            {parentEntity && (
              <p className="text-sm mt-1" style={{ color: "#A89B8C" }}>
                Part of {parentEntity.name}
              </p>
            )}
          </div>
          <Link
            href="/enterprise/settings/entities"
            className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.35)", color: "#C4704B" }}
          >
            Manage Entities →
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 flex flex-col gap-1" style={CARD}>
            <span style={LABEL}>Members</span>
            <span className="text-3xl font-bold" style={{ color: "#EDE6DD" }}>{entityMembers.length}</span>
          </div>
          <div className="p-4 flex flex-col gap-1" style={CARD}>
            <span style={LABEL}>Sub-Entities</span>
            <span className="text-3xl font-bold" style={{ color: "#EDE6DD" }}>{childEntities.length}</span>
          </div>
        </div>

        {/* Sub-entities */}
        {childEntities.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3" style={{ color: "#EDE6DD" }}>Sub-Entities</h2>
            <div className="flex flex-col gap-2">
              {childEntities.map((child) => (
                <Link key={child.id} href={`/enterprise/group/${child.id}`}>
                  <div className="flex items-center justify-between px-5 py-3 rounded-xl" style={CARD}>
                    <span className="text-sm font-medium" style={{ color: "#EDE6DD" }}>{child.name}</span>
                    <span style={{ color: "#A89B8C", fontSize: 12 }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div>
          <h2 className="text-base font-semibold mb-3" style={{ color: "#EDE6DD" }}>
            Members ({entityMembers.length})
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {entityMembers.length === 0 ? (
              <div className="px-5 py-4 text-sm" style={{ color: "#A89B8C" }}>
                No members assigned to this entity yet. Assign them from{" "}
                <Link href="/enterprise/settings/entities" style={{ color: "#C4704B" }}>
                  entity settings
                </Link>
                .
              </div>
            ) : (
              <>
                <div className="px-5 py-3 grid grid-cols-2 gap-2" style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={LABEL}>Member</span>
                  <span style={LABEL}>Role</span>
                </div>
                {entityMembers.map((m) => (
                  <div key={m.id} className="px-5 py-3 grid grid-cols-2 gap-2 items-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div>
                      <p className="text-sm" style={{ color: "#EDE6DD" }}>{m.name ?? m.email}</p>
                      {m.name && <p className="text-xs" style={{ color: "#A89B8C" }}>{m.email}</p>}
                    </div>
                    <span className="text-xs px-2 py-1 rounded w-fit" style={{ background: "rgba(196,112,75,0.12)", color: "#C4704B" }}>
                      {m.role}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
