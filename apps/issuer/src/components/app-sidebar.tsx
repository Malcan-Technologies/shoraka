"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@cashsouk/ui";
import { APP_VERSION } from "@cashsouk/config";
import { HomeIcon, PlusIcon } from "@heroicons/react/24/outline";

import { NavUser } from "@/components/nav-user";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding-start";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show skeleton while not mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <div className="flex h-16 items-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-0 px-3">
            <Skeleton className="h-14 w-14 rounded group-data-[collapsible=icon]:block hidden" />
            <div className="flex items-center group-data-[collapsible=icon]:hidden">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="ml-2 h-4 w-16" />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Skeleton className="h-8 w-full rounded-md" />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <div className="px-2">
            <Separator className="my-2" />
          </div>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Skeleton className="h-8 w-full rounded-md" />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="cursor-default">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="group-data-[collapsible=icon]:hidden">
            <Separator className="my-2" />
            <Skeleton className="mx-3 h-3 w-16" />
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex h-16 items-center justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-0 px-3">
          <div className="relative w-full">
            <img
              src="/shoraka_favicon.svg"
              alt="CashSouk"
              className="h-14 w-14 opacity-0 group-data-[collapsible=icon]:opacity-100 transition-opacity duration-200 absolute left-1/2 -translate-x-1/2"
            />
            <div className="flex items-center opacity-100 group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200">
              <Logo />
              <span className="ml-2 text-xs font-medium text-muted-foreground">Issuer</span>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Quick Action */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {isOnboarding ? (
                  <SidebarMenuButton
                    disabled
                    tooltip="Complete onboarding to access"
                    className="opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Get Financed</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    asChild
                    tooltip="Get Financed"
                    className="group/btn bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  >
                    <Link href="/loans/new">
                      <PlusIcon className="h-4 w-4 transition-transform duration-200 group-hover/btn:rotate-90" />
                      <span>Get Financed</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="px-2">
          <Separator className="my-2" />
        </div>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {isOnboarding ? (
                  <SidebarMenuButton
                    disabled
                    tooltip="Complete onboarding to access"
                    className="opacity-50 cursor-not-allowed"
                  >
                    <HomeIcon className="h-4 w-4" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Dashboard">
                    <Link href="/">
                      <HomeIcon className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
        <div className="group-data-[collapsible=icon]:hidden">
          <Separator className="my-2" />
          <div className="flex px-3 justify-start py-2 text-xs text-sidebar-foreground/70">
            {APP_VERSION}
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
