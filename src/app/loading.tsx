export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center animate-fade-in">
        <div className="relative w-12 h-12 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-[3px] border-border" />
          <div className="absolute inset-0 rounded-full border-[3px] border-brand-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-text-secondary">Loading...</p>
      </div>
    </div>
  );
}
