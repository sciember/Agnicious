export default function TasksLoading() {
  return (
    <div className="space-y-4">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-canvas" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-canvas" />
        ))}
      </div>
    </div>
  );
}
