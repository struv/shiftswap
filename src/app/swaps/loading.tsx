export default function SwapsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-secondary animate-shimmer" />
            <div className="h-5 w-28 bg-surface-secondary rounded-lg animate-shimmer" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-secondary animate-shimmer" />
            <div className="w-9 h-9 rounded-full bg-surface-secondary animate-shimmer" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Filter skeleton */}
        <div className="bg-surface-secondary p-1 rounded-xl inline-flex gap-1 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-8 w-20 bg-surface rounded-lg animate-shimmer"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>

        {/* List skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface rounded-2xl border border-border p-5 animate-shimmer"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3.5 flex-1">
                  <div className="w-10 h-10 rounded-full bg-surface-secondary" />
                  <div className="space-y-2.5 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-28 bg-surface-secondary rounded-lg" />
                      <div className="h-6 w-20 bg-surface-secondary rounded-lg" />
                    </div>
                    <div className="h-3 w-56 bg-surface-secondary rounded-lg" />
                    <div className="h-3 w-36 bg-surface-secondary rounded-lg" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-24 bg-surface-secondary rounded-xl" />
                  <div className="h-9 w-20 bg-surface-secondary rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
