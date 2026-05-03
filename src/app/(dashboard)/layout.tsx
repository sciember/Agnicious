import { AuthGateProvider } from "@/components/auth/auth-gate-context";
import { AuthModal } from "@/components/auth/auth-modal";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { PageFade } from "@/components/layout/page-fade";
import { ShellHeader } from "@/components/layout/shell-header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGateProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="relative flex min-h-screen flex-1 flex-col bg-canvas pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <ShellHeader />
          <main className="flex-1 bg-canvas px-4 py-4 md:px-8 md:py-8">
            <PageFade>{children}</PageFade>
          </main>
        </div>
        <MobileTabBar />
        <AuthModal />
      </div>
    </AuthGateProvider>
  );
}
