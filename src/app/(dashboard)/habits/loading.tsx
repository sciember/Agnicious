export default function HabitsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-9 w-36 animate-pulse rounded-lg bg-canvas" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-canvas" />
        ))}
      </div>
    </div>
  );
}
