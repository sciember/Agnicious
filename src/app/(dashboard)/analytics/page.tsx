export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Analytics</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="app-card h-56">Graph slot A (line/bar/candle/circular)</div>
        <div className="app-card h-56">Graph slot B (fullscreen supported)</div>
      </div>
    </div>
  );
}
