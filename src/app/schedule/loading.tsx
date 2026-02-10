export default function ScheduleLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
            <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Controls skeleton */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-9 w-16 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-9 w-9 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse ml-2" />
          </div>
          <div className="h-9 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        {/* Calendar skeleton */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="px-2 py-3 text-center border-r last:border-r-0 border-gray-200 bg-gray-50"
              >
                <div className="h-3 w-8 bg-gray-200 rounded animate-pulse mx-auto mb-2" />
                <div className="h-5 w-6 bg-gray-200 rounded animate-pulse mx-auto" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="p-2 min-h-[200px] border-r last:border-r-0 border-gray-200"
              >
                <div className="space-y-2">
                  {[1, 2].map((j) => (
                    <div
                      key={j}
                      className="h-16 bg-gray-100 rounded animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
