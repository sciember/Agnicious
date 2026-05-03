"use client";

import dynamic from "next/dynamic";

const ProductivityAnalytics = dynamic(
  () => import("@/components/analytics/productivity-analytics").then((m) => m.ProductivityAnalytics),
  {
    loading: () => (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-canvas" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-canvas" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-canvas" />
      </div>
    ),
    ssr: false,
  },
);

export default function AnalyticsPage() {
  return <ProductivityAnalytics />;
}
