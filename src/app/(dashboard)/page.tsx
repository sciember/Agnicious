import { Suspense } from "react";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { SkeletonCard } from "@/components/ui/skeleton-card";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 p-2">
          <SkeletonCard className="h-24" lines={2} />
          <SkeletonCard className="h-40" lines={4} />
        </div>
      }
    >
      <DashboardHome />
    </Suspense>
  );
}
