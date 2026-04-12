export default function ContractLoading() {
  return (
    <div className="min-h-screen px-4 py-10" style={{ background: "#171311" }}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {/* Back link + title */}
        <div className="h-5 w-24 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="h-8 w-64 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Status card */}
        <div
          className="h-24 rounded-xl animate-pulse"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.1)" }}
        />

        {/* Milestone timeline */}
        <div
          className="h-40 rounded-xl animate-pulse"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.1)" }}
        />

        {/* Actions panel */}
        <div
          className="h-32 rounded-xl animate-pulse"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.1)" }}
        />

        {/* Audit trail */}
        <div
          className="h-48 rounded-xl animate-pulse"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.1)" }}
        />
      </div>
    </div>
  );
}
