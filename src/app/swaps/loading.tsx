export default function SwapsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
            <h1 className="text-2xl font-bold text-gray-900">Swap Requests</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filter skeleton */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>

        {/* List skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow p-6 animate-pulse"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-32 bg-gray-200 rounded" />
                    <div className="h-5 w-20 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-3 w-64 bg-gray-200 rounded" />
                  <div className="h-3 w-40 bg-gray-200 rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-gray-200 rounded-lg" />
                  <div className="h-8 w-16 bg-gray-200 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
