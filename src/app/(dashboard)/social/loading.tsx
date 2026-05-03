export default function SocialLoading() {
  return (
    <div className="space-y-10">
      <div className="h-10 w-40 animate-pulse rounded-lg bg-canvas" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="app-card h-[420px] animate-pulse bg-canvas" />
        <div className="app-card h-[380px] animate-pulse bg-canvas" />
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-canvas" />
      <div className="app-card h-72 animate-pulse bg-canvas" />
    </div>
  );
}
