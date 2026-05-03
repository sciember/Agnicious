"use client";

import dynamic from "next/dynamic";

const ProductivityAnalytics = dynamic(
  () => import("@/components/analytics/productivity-analytics").then((m) => m.ProductivityAnalytics),
  {
    loading: () => <div className="h-72 animate-pulse rounded-xl bg-canvas" />,
    ssr: false,
  },
);

export default function AnalyticsPage() {
  return <ProductivityAnalytics />;
}
