"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FolderKanban,
  Share2,
  PenSquare,
  CalendarDays,
  MessageSquareReply,
  Settings,
  CreditCard,
  Zap,
  Brain,
} from "lucide-react";

function useProjectId() {
  const pathname = usePathname();
  const match = pathname.match(/\/dashboard\/([^/]+)/);
  return match ? match[1] : null;
}

export function AppSidebar() {
  const pathname = usePathname();
  const projectId = useProjectId();
  const t = useTranslations("sidebar");

  const mainNav = [
    { title: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
  ];

  const projectNav = projectId
    ? [
        { title: t("overview"), href: `/dashboard/${projectId}`, icon: FolderKanban, group: "core" },
        { title: t("intelligence"), href: `/dashboard/${projectId}/intelligence`, icon: Brain, group: "core" },
        { title: t("skillsEngine"), href: `/dashboard/${projectId}/skills`, icon: Zap, group: "core" },
        { title: t("campaigns"), href: `/dashboard/${projectId}/campaigns`, icon: FolderKanban, group: "core" },
        { title: t("socialAccounts"), href: `/dashboard/${projectId}/social`, icon: Share2, group: "publish" },
        { title: t("compose"), href: `/dashboard/${projectId}/compose`, icon: PenSquare, group: "publish" },
        { title: t("calendar"), href: `/dashboard/${projectId}/calendar`, icon: CalendarDays, group: "publish" },
        { title: t("autoReply"), href: `/dashboard/${projectId}/auto-reply`, icon: MessageSquareReply, group: "publish" },
      ]
    : [];

  const settingsNav = [
    { title: t("settings"), href: "/dashboard/settings", icon: Settings },
    { title: t("billing"), href: "/dashboard/settings/billing", icon: CreditCard },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg primary-gradient text-white font-bold text-sm font-heading shrink-0">
            MP
          </div>
          <span className="font-heading font-bold text-base tracking-tight group-hover:text-primary transition-colors">
            MarketPilot
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {/* Main nav */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    className="rounded-lg h-9 px-3 gap-2.5 font-medium text-sm"
                  >
                    <Link href={item.href} className="flex items-center gap-2.5 w-full">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {projectNav.length > 0 && (
          <>
            <SidebarGroup className="p-0 mt-4">
              <SidebarGroupLabel className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                {t("marketpilot")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projectNav.filter((i) => i.group === "core").map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={pathname === item.href}
                        className="rounded-lg h-9 px-3 gap-2.5 font-medium text-sm"
                      >
                        <Link href={item.href} className="flex items-center gap-2.5 w-full">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0 mt-4">
              <SidebarGroupLabel className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                {t("publishing")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projectNav.filter((i) => i.group === "publish").map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={pathname === item.href}
                        className="rounded-lg h-9 px-3 gap-2.5 font-medium text-sm"
                      >
                        <Link href={item.href} className="flex items-center gap-2.5 w-full">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2 py-2">
        <SidebarMenu>
          {settingsNav.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname === item.href}
                className="rounded-lg h-9 px-3 gap-2.5 font-medium text-sm"
              >
                <Link href={item.href} className="flex items-center gap-2.5 w-full">
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
