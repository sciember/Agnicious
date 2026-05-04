import { AuthModalProvider } from "@/components/auth/auth-modal-context";
import { AuthModal } from "@/components/auth/auth-modal";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { MobileSidebarDrawer } from "@/components/layout/mobile-sidebar-drawer";
import { OnboardingGate } from "@/components/layout/onboarding-gate";
import { PageFade } from "@/components/layout/page-fade";
import { ProfileSetupGate } from "@/components/layout/profile-setup-gate";
import { ShellHeader } from "@/components/layout/shell-header";
import { MobileSidebarProvider } from "@/components/layout/mobile-sidebar-context";
import { DashboardSwrProvider } from "@/components/providers/dashboard-swr-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthModalProvider>
      <MobileSidebarProvider>
        <DashboardSwrProvider>
          <ProfileSetupGate>
            <OnboardingGate>
              <div className="flex min-h-screen bg-background">
                <AppSidebar />
                <MobileSidebarDrawer />
                <div className="relative flex min-h-screen flex-1 flex-col bg-canvas pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
                  <ShellHeader />
                  <main className="flex-1 bg-canvas px-4 py-4 md:px-8 md:py-8">
                    <PageFade>{children}</PageFade>
                  </main>
                </div>
                <MobileTabBar />
                <AuthModal />
              </div>
            </OnboardingGate>
          </ProfileSetupGate>
        </DashboardSwrProvider>
      </MobileSidebarProvider>
    </AuthModalProvider>
  );
}
