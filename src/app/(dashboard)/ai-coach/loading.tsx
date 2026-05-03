export default function AICoachLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col gap-4">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-canvas" />
      <div className="flex-1 animate-pulse rounded-xl bg-canvas" />
      <div className="h-12 animate-pulse rounded-xl bg-canvas" />
    </div>
  );
}
