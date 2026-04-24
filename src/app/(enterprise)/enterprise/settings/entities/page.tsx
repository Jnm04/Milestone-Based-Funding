"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Entity {
  id: string;
  name: string;
  parentEntityId: string | null;
}

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  entityId: string | null;
}

interface OrgData {
  org: { id: string; name: string } | null;
  entities: Entity[];
  members: Member[];
}

const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 };
const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#EDE6DD",
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};
const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#A89B8C" };

export default function EntitySettingsPage() {
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);

  // New entity form
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Member assignment
  const [assigningMember, setAssigningMember] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setLoading(true);
    Promise.all([
      fetch("/api/enterprise/entities").then((r) => r.json()),
      fetch("/api/enterprise/group/summary").then((r) => r.json()),
    ])
      .then(([entData, summaryData]) => {
        setData({
          org: entData.org ?? summaryData.org,
          entities: entData.entities ?? [],
          members: summaryData.members ?? [],
        });
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/enterprise/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), parentEntityId: newParent || null }),
      });
      const d = await res.json() as { error?: string; entity?: Entity };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success(`Entity "${d.entity!.name}" created`);
      setNewName("");
      setNewParent("");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/enterprise/entities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success("Entity renamed");
      setEditId(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete entity "${name}"? Members will be unassigned.`)) return;
    try {
      const res = await fetch(`/api/enterprise/entities/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Entity deleted");
      loadData();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleAssignMember(memberId: string, entityId: string | null) {
    setAssigningMember(memberId);
    try {
      const res = await fetch(`/api/enterprise/team/${memberId}/entity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success("Member assigned");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setAssigningMember(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#171311", color: "#A89B8C" }}>
        Loading…
      </div>
    );
  }

  const entities = data?.entities ?? [];
  const members = data?.members ?? [];

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: "#171311", color: "#EDE6DD" }}>
      <div className="max-w-3xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#EDE6DD" }}>Entity Management</h1>
          <p className="text-sm mt-1" style={{ color: "#A89B8C" }}>
            Create subsidiaries and business units. Assign team members to entities.
          </p>
        </div>

        {/* Create entity */}
        <div className="p-5 flex flex-col gap-4" style={CARD}>
          <h2 className="text-base font-semibold" style={{ color: "#EDE6DD" }}>Add Entity</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block mb-1" style={LABEL}>Entity Name</label>
              <input
                type="text"
                placeholder="e.g. EMEA Division, Climate Fund"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={INPUT_STYLE}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            {entities.length > 0 && (
              <div>
                <label className="block mb-1" style={LABEL}>Parent Entity (optional)</label>
                <select
                  value={newParent}
                  onChange={(e) => setNewParent(e.target.value)}
                  style={{ ...INPUT_STYLE, cursor: "pointer" }}
                >
                  <option value="">— None (top-level) —</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              disabled={creating || !newName.trim()}
              onClick={handleCreate}
              className="w-full rounded-lg py-2.5 text-sm font-semibold"
              style={{ background: "#C4704B", color: "#171311", opacity: creating || !newName.trim() ? 0.6 : 1 }}
            >
              {creating ? "Creating…" : "Create Entity"}
            </button>
          </div>
        </div>

        {/* Entities list */}
        {entities.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3" style={{ color: "#EDE6DD" }}>
              Entities ({entities.length})
            </h2>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {entities.map((entity, i) => {
                const parent = entity.parentEntityId
                  ? entities.find((e) => e.id === entity.parentEntityId)
                  : null;
                const memberCount = members.filter((m) => m.entityId === entity.id).length;

                return (
                  <div
                    key={entity.id}
                    className="px-5 py-3 flex items-center gap-3"
                    style={{ borderBottom: i < entities.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  >
                    <div className="flex-1 min-w-0">
                      {editId === entity.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{ ...INPUT_STYLE, width: "auto", flex: 1 }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(entity.id);
                              if (e.key === "Escape") setEditId(null);
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(entity.id)}
                            disabled={saving}
                            className="text-xs px-3 py-1.5 rounded"
                            style={{ background: "#C4704B", color: "#171311" }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="text-xs px-3 py-1.5 rounded"
                            style={{ background: "rgba(255,255,255,0.06)", color: "#A89B8C" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div>
                          <span className="text-sm font-medium" style={{ color: "#EDE6DD" }}>
                            {parent && <span style={{ color: "#A89B8C" }}>{parent.name} / </span>}
                            {entity.name}
                          </span>
                          <span className="text-xs ml-2" style={{ color: "#A89B8C" }}>
                            {memberCount} member{memberCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                    {editId !== entity.id && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => { setEditId(entity.id); setEditName(entity.name); }}
                          className="text-xs px-3 py-1.5 rounded"
                          style={{ background: "rgba(255,255,255,0.06)", color: "#EDE6DD" }}
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(entity.id, entity.name)}
                          className="text-xs px-3 py-1.5 rounded"
                          style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Assign members to entities */}
        {members.length > 0 && entities.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3" style={{ color: "#EDE6DD" }}>Assign Members to Entities</h2>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="px-5 py-3 grid grid-cols-2 gap-2" style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={LABEL}>Member</span>
                <span style={LABEL}>Entity</span>
              </div>
              {members.map((m) => (
                <div key={m.id} className="px-5 py-3 grid grid-cols-2 gap-2 items-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <p className="text-sm" style={{ color: "#EDE6DD" }}>{m.name ?? m.email}</p>
                    {m.name && <p className="text-xs" style={{ color: "#A89B8C" }}>{m.email}</p>}
                  </div>
                  <select
                    value={m.entityId ?? ""}
                    disabled={assigningMember === m.id}
                    onChange={(e) => handleAssignMember(m.id, e.target.value || null)}
                    style={{ ...INPUT_STYLE, cursor: "pointer", opacity: assigningMember === m.id ? 0.6 : 1 }}
                  >
                    <option value="">— Unassigned —</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {entities.length === 0 && (
          <div className="rounded-xl p-6 text-center" style={CARD}>
            <p className="text-sm" style={{ color: "#A89B8C" }}>
              Create your first entity above to start organising your team by business unit or subsidiary.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
