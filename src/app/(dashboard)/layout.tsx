import { AppSidebar } from "@/components/layout/app-sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
