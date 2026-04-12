export default function InvestorDashboardLoading() {
  return (
    <div className="min-h-screen flex" style={{ background: "#171311" }}>
      {/* Sidebar skeleton */}
      <div className="w-64 shrink-0 border-r" style={{ borderColor: "rgba(196,112,75,0.12)", background: "rgba(255,255,255,0.02)" }}>
        <div className="p-6 flex flex-col gap-6">
          <div className="h-7 w-28 rounded-lg animate-pulse" style={{ background: "rgba(196,112,75,0.15)" }} />
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-8 flex flex-col gap-6">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl animate-pulse"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.1)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
