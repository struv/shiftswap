export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">ShiftSwap</h1>
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick actions skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-200 rounded-lg p-6 h-32 animate-pulse"
            />
          ))}
        </div>

        {/* Shifts skeleton */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
