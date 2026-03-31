import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto min-h-screen bg-background">
        <div className="flex items-center gap-3 border-b border-border bg-card/50 px-4 py-2.5 sticky top-0 z-10 backdrop-blur-sm">
          <SidebarTrigger className="h-8 w-8" />
        </div>
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
      <Toaster />
    </SidebarProvider>
  );
}
