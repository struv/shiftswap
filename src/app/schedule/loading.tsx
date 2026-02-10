export default function ScheduleLoading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-secondary animate-shimmer" />
            <div className="h-5 w-20 bg-surface-secondary rounded-lg animate-shimmer" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-secondary animate-shimmer" />
            <div className="w-9 h-9 rounded-full bg-surface-secondary animate-shimmer" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Navigation controls skeleton */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-surface-secondary rounded-xl animate-shimmer" />
            <div className="h-9 w-20 bg-surface-secondary rounded-xl animate-shimmer" />
            <div className="h-9 w-9 bg-surface-secondary rounded-xl animate-shimmer" />
            <div className="h-5 w-44 bg-surface-secondary rounded-lg animate-shimmer ml-2" />
          </div>
          <div className="h-9 w-28 bg-surface-secondary rounded-xl animate-shimmer" />
        </div>

        {/* Calendar skeleton */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border-light">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="px-2 py-3 text-center border-r last:border-r-0 border-border-light bg-surface-secondary/50"
              >
                <div className="h-3 w-8 bg-surface-secondary rounded animate-shimmer mx-auto mb-2" />
                <div className="h-6 w-6 bg-surface-secondary rounded-full animate-shimmer mx-auto" />
              </div>
            ))}
          </div>
          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="p-2 min-h-[200px] border-r last:border-r-0 border-border-light"
              >
                <div className="space-y-2">
                  {[1, 2].map((j) => (
                    <div
                      key={j}
                      className="h-14 bg-surface-secondary rounded-xl animate-shimmer"
                      style={{ animationDelay: `${(i * 2 + j) * 60}ms` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend skeleton */}
        <div className="flex items-center gap-4 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-surface-secondary animate-shimmer" />
              <div className="h-3 w-14 bg-surface-secondary rounded animate-shimmer" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
