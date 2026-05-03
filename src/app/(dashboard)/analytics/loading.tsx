export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-canvas" />
      <div className="h-72 animate-pulse rounded-xl bg-canvas" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-canvas" />
        <div className="h-48 animate-pulse rounded-xl bg-canvas" />
      </div>
    </div>
  );
}
