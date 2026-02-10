export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-secondary animate-shimmer" />
            <div className="h-5 w-24 bg-surface-secondary rounded-lg animate-shimmer" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-secondary animate-shimmer" />
            <div className="w-9 h-9 rounded-full bg-surface-secondary animate-shimmer" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Greeting skeleton */}
        <div className="mb-8">
          <div className="h-7 w-56 bg-surface-secondary rounded-lg animate-shimmer mb-2" />
          <div className="h-4 w-40 bg-surface-secondary rounded-lg animate-shimmer" />
        </div>

        {/* Quick actions skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface rounded-2xl border border-border p-6 h-36 animate-shimmer"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>

        {/* Upcoming shifts skeleton */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <div className="h-5 w-40 bg-surface-secondary rounded-lg animate-shimmer mb-5" />
          <div className="space-y-0 divide-y divide-border-light">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <div className="w-12 h-14 bg-surface-secondary rounded-xl animate-shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-surface-secondary rounded-lg animate-shimmer" />
                  <div className="h-3 w-48 bg-surface-secondary rounded-lg animate-shimmer" />
                </div>
                <div className="h-7 w-16 bg-surface-secondary rounded-lg animate-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
